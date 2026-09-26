-- Security / integrity regression checks for LedgeEaze.
--
-- Run the whole file in the Supabase SQL editor (or via execute_sql). It runs
-- inside one transaction that is ROLLED BACK at the end, so it never changes
-- data. Each check RAISEs on failure; if you reach the final SELECT, every
-- check passed.
--
-- Uses the two standing accounts from CLAUDE.md's QA section:
--   QA15  fc22382b-37cf-444b-af9f-4827294c3330 (rohith24112+qa15@gmail.com)
--   admin 8330b931-4022-40ba-bef2-79af3dc8035f (rohith24112@gmail.com)
-- Re-run after every migration that touches RLS, grants, or functions.
-- The checks were validated by deliberately breaking three of them (granting
-- anon EXECUTE, re-adding an "any authenticated user" profiles policy, making
-- QA15 an admin) in a rolled-back transaction -- each raised as expected.

begin;

-- ---------------------------------------------------------------------------
-- 1. Structural: grants and RLS (run as the table owner)
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  -- No SECURITY DEFINER function in public may be callable without signing in.
  for r in
    select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
  loop
    raise exception 'FAIL: anon can execute SECURITY DEFINER function %', r.fn;
  end loop;

  -- Trigger/event-trigger functions are never RPCs: nobody should hold EXECUTE.
  for r in
    select unnest(array['public.handle_new_user()', 'public.handle_user_email_update()', 'public.rls_auto_enable()'])::regprocedure as fn
  loop
    if has_function_privilege('authenticated', r.fn, 'execute') then
      raise exception 'FAIL: authenticated can execute trigger function %', r.fn;
    end if;
  end loop;

  -- The RPCs the app actually calls must stay callable by signed-in users.
  for r in
    select unnest(array[
      'public.delete_own_account()', 'public.mark_feedback_reply_seen(uuid)', 'public.find_profile_by_email(text)',
      'public.mark_recurring_item_paid(uuid,date)', 'public.set_account_opening_balance(text,numeric)', 'public.is_admin()'
    ])::regprocedure as fn
  loop
    if not has_function_privilege('authenticated', r.fn, 'execute') then
      raise exception 'FAIL: authenticated lost EXECUTE on %', r.fn;
    end if;
  end loop;

  -- Every public table has RLS on.
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception 'FAIL: RLS is disabled on public.%', r.relname;
  end loop;

  -- admin_users is not reachable through the API at all.
  if has_table_privilege('authenticated', 'public.admin_users', 'select')
     or has_table_privilege('authenticated', 'public.admin_users', 'insert')
     or has_table_privilege('anon', 'public.admin_users', 'select') then
    raise exception 'FAIL: admin_users is granted to anon/authenticated';
  end if;

  -- No policy may reintroduce the hardcoded admin email.
  if exists (select 1 from pg_policies where qual ilike '%rohith24112@gmail.com%' or with_check ilike '%rohith24112@gmail.com%') then
    raise exception 'FAIL: a policy checks the admin email instead of is_admin()';
  end if;

  -- profiles must not be readable by every signed-in user again.
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
             and qual ilike '%auth.role()%authenticated%') then
    raise exception 'FAIL: profiles has an "any authenticated user" select policy';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. As QA15 (ordinary user)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"fc22382b-37cf-444b-af9f-4827294c3330","email":"rohith24112+qa15@gmail.com","role":"authenticated"}', true);

do $$
declare me uuid := 'fc22382b-37cf-444b-af9f-4827294c3330';
begin
  if public.is_admin() then raise exception 'FAIL: QA15 is admin'; end if;

  -- Profiles: only self or a viewer_access connection (either direction).
  if exists (
    select 1 from public.profiles p
    where p.id <> me and not exists (
      select 1 from public.viewer_access va
      where (va.requester_user_id = me and va.owner_user_id = p.id)
         or (va.owner_user_id = me and va.requester_user_id = p.id))
  ) then raise exception 'FAIL: QA15 can read an unconnected profile'; end if;

  -- Transactions: own, or an owner who approved QA15 as a viewer.
  if exists (
    select 1 from public.transactions t
    where t.owner_user_id <> me and not exists (
      select 1 from public.viewer_access va
      where va.owner_user_id = t.owner_user_id and va.requester_user_id = me and va.status = 'approved')
  ) then raise exception 'FAIL: QA15 can read an unshared transaction'; end if;

  -- Feedback: only their own.
  if exists (select 1 from public.feedback where owner_user_id <> me) then
    raise exception 'FAIL: QA15 can read someone else''s feedback';
  end if;

  -- Private per-user tables never leak.
  if exists (select 1 from public.budgets where owner_user_id <> me)
     or exists (select 1 from public.accounts where owner_user_id <> me)
     or exists (select 1 from public.categories where owner_user_id <> me) then
    raise exception 'FAIL: QA15 can read another user''s budgets/accounts/categories';
  end if;

  -- Exact-email lookup only: no prefix match, never yourself.
  if exists (select 1 from public.find_profile_by_email('rohith24112+qa')) then
    raise exception 'FAIL: find_profile_by_email matched a partial email';
  end if;
  if exists (select 1 from public.find_profile_by_email('rohith24112+qa15@gmail.com')) then
    raise exception 'FAIL: find_profile_by_email returned the caller';
  end if;

  -- Opening balance RPC only touches the caller's own accounts.
  begin
    perform public.set_account_opening_balance('__no_such_account__', 1);
    raise exception 'FAIL: set_account_opening_balance accepted an unknown account';
  exception when others then
    if sqlerrm <> 'Account not found' then raise; end if;
  end;

  -- Writes to someone else's rows silently affect nothing.
  update public.transactions set merchant = 'hijack' where owner_user_id <> me;
  if found then raise exception 'FAIL: QA15 updated another user''s transaction'; end if;
  delete from public.transactions where owner_user_id <> me;
  if found then raise exception 'FAIL: QA15 deleted another user''s transaction'; end if;

  -- Integrity constraints.
  begin
    insert into public.transactions (owner_user_id, date, merchant, amount, type, account, fingerprint)
    values (me, '2026-01-01', 'sec-test', 1, 'transfer', 'Cash', 'sec-test-transfer');
    raise exception 'FAIL: a transfer without a destination was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.transactions (owner_user_id, date, merchant, category, amount, type, account, fingerprint, original_currency)
    values (me, '2026-01-01', 'sec-test', 'Dining', 1, 'expense', 'Cash', 'sec-test-fx', 'EUR');
    raise exception 'FAIL: a partial foreign-currency row was accepted';
  exception when check_violation then null;
  end;
end $$;

-- A spoofed admin-email claim grants nothing: admin is by user id now.
select set_config('request.jwt.claims',
  '{"sub":"fc22382b-37cf-444b-af9f-4827294c3330","email":"rohith24112@gmail.com","role":"authenticated"}', true);
do $$
begin
  if public.is_admin() then raise exception 'FAIL: admin-email claim made QA15 an admin'; end if;
  if exists (select 1 from public.feedback where owner_user_id <> 'fc22382b-37cf-444b-af9f-4827294c3330') then
    raise exception 'FAIL: admin-email claim exposed other users'' feedback';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. As the admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"8330b931-4022-40ba-bef2-79af3dc8035f","email":"rohith24112@gmail.com","role":"authenticated"}', true);
do $$
declare visible int; total int;
begin
  if not public.is_admin() then raise exception 'FAIL: the admin is not is_admin()'; end if;
  select count(*) into visible from public.profiles;
  reset role;
  select count(*) into total from public.profiles;
  if visible <> total then raise exception 'FAIL: admin sees % of % profiles', visible, total; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. As anon (no session)
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  if exists (select 1 from public.transactions) or exists (select 1 from public.budgets)
     or exists (select 1 from public.viewer_access) then
    raise exception 'FAIL: anon can read user data';
  end if;
end $$;

reset role;
select 'ALL SECURITY CHECKS PASSED' as result;
rollback;
