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
  -- rls_auto_enable() only exists where Supabase's auto-enable-RLS setting made it.
  for r in
    select fn from (
      select to_regprocedure(f) as fn
      from unnest(array[
        'public.handle_new_user()', 'public.handle_user_email_update()', 'public.rls_auto_enable()',
        'public.transaction_splits_cap_total()', 'public.recurring_items_keep_anchor_day()',
        'public.debit_cards_normalize()', 'public.transactions_check_debit_card()',
        'public.debit_cards_block_account_move()', 'public.accounts_keep_cash()'
      ]) as f
    ) s where fn is not null
  loop
    if has_function_privilege('authenticated', r.fn, 'execute') then
      raise exception 'FAIL: authenticated can execute trigger function %', r.fn;
    end if;
  end loop;

  -- The RPCs the app actually calls must stay callable by signed-in users.
  for r in
    select unnest(array[
      'public.delete_own_account()', 'public.mark_feedback_reply_seen(uuid)', 'public.find_profile_by_email(text)',
      'public.mark_recurring_item_paid(uuid,date)', 'public.set_account_opening_balance(text,numeric)', 'public.is_admin()',
      'public.set_account_details(text,text,numeric,integer,integer)', 'public.set_account_closed(text,boolean)',
      'public.request_viewer_access(text)', 'public.convert_account_to_debit_card(text,text,text)',
      'public.admin_overview()', 'public.admin_list_users()', 'public.admin_client_errors(integer)'
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

  -- profiles.email mirrors auth.users; users may only edit display_name/avatar.
  if has_column_privilege('authenticated', 'public.profiles', 'email', 'update')
     or has_table_privilege('authenticated', 'public.profiles', 'insert') then
    raise exception 'FAIL: authenticated can write profiles.email';
  end if;

  -- Access requests only via request_viewer_access(email); the two user ids are fixed.
  if has_table_privilege('authenticated', 'public.viewer_access', 'insert')
     or has_column_privilege('authenticated', 'public.viewer_access', 'requester_user_id', 'update')
     or has_column_privilege('authenticated', 'public.viewer_access', 'owner_user_id', 'update') then
    raise exception 'FAIL: viewer_access can be inserted or re-pointed directly';
  end if;

  -- A split can only be settled after creation, never re-pointed or resized.
  if has_column_privilege('authenticated', 'public.transaction_splits', 'with_user_id', 'update')
     or has_column_privilege('authenticated', 'public.transaction_splits', 'transaction_id', 'update')
     or has_column_privilege('authenticated', 'public.transaction_splits', 'amount', 'update') then
    raise exception 'FAIL: transaction_splits columns other than settled_at are updatable';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'transaction_splits_cap_total'
                 and tgrelid = 'public.transaction_splits'::regclass) then
    raise exception 'FAIL: the split total cap trigger is missing';
  end if;

  -- Shared viewers only get documents attached to a shared transaction.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'documents'
                 and policyname = 'documents_select_shared' and qual ilike '%receipt_document_id%')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'documents_storage_select_shared' and qual ilike '%receipt_document_id%') then
    raise exception 'FAIL: shared document policies are not scoped to attached receipts';
  end if;

  -- The avatars bucket can't be listed by everyone (top-level folders are user ids).
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and cmd = 'SELECT' and qual ilike '%avatars%' and qual not ilike '%auth.uid()%') then
    raise exception 'FAIL: the avatars bucket is listable by everyone';
  end if;

  -- Account kinds: only the current set, and card fields only on credit cards.
  if exists (select 1 from public.accounts where kind not in ('savings', 'current', 'credit_card', 'cash', 'wallet')) then
    raise exception 'FAIL: an account has an unknown kind';
  end if;
  if exists (select 1 from public.accounts where kind <> 'credit_card'
             and (credit_limit is not null or statement_day is not null or due_day is not null)) then
    raise exception 'FAIL: a non-card account has credit card fields';
  end if;

  -- Debit cards: private to their owner, never handed to someone else, and
  -- card payments are checked by trigger.
  if has_table_privilege('anon', 'public.debit_cards', 'select')
     or has_table_privilege('anon', 'public.debit_cards', 'insert') then
    raise exception 'FAIL: anon has access to debit_cards';
  end if;
  if has_column_privilege('authenticated', 'public.debit_cards', 'owner_user_id', 'update') then
    raise exception 'FAIL: a debit card''s owner is updatable';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'debit_cards_normalize'
                 and tgrelid = 'public.debit_cards'::regclass)
     or not exists (select 1 from pg_trigger where tgname = 'debit_cards_block_account_move'
                    and tgrelid = 'public.debit_cards'::regclass)
     or not exists (select 1 from pg_trigger where tgname = 'transactions_check_debit_card'
                    and tgrelid = 'public.transactions'::regclass) then
    raise exception 'FAIL: a debit card trigger is missing';
  end if;

  -- Cash is always kept: every user has an open cash account, guarded by trigger.
  if not exists (select 1 from pg_trigger where tgname = 'accounts_keep_cash'
                 and tgrelid = 'public.accounts'::regclass) then
    raise exception 'FAIL: the keep-cash trigger is missing';
  end if;
  if exists (select 1 from public.profiles p where not exists (
               select 1 from public.accounts a
               where a.owner_user_id = p.id and a.kind = 'cash' and a.closed_at is null)) then
    raise exception 'FAIL: a user has no open cash account';
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

  -- Profiles: only self, a viewer_access connection, or a split partner (either direction).
  if exists (
    select 1 from public.profiles p
    where p.id <> me and not exists (
      select 1 from public.viewer_access va
      where (va.requester_user_id = me and va.owner_user_id = p.id)
         or (va.owner_user_id = me and va.requester_user_id = p.id))
    and not exists (
      select 1 from public.transaction_splits s
      where (s.owner_user_id = me and s.with_user_id = p.id)
         or (s.with_user_id = me and s.owner_user_id = p.id))
  ) then raise exception 'FAIL: QA15 can read an unconnected profile'; end if;

  -- Nobody can change their own profile email.
  begin
    update public.profiles set email = 'spoof@example.com' where id = me;
    raise exception 'FAIL: QA15 changed their profile email';
  exception when insufficient_privilege then null;
  end;

  -- Documents of another user: only receipts on transactions shared with QA15.
  if exists (
    select 1 from public.documents d
    where d.owner_user_id <> me and not exists (
      select 1 from public.transactions t
      join public.viewer_access va
        on va.owner_user_id = t.owner_user_id and va.requester_user_id = me and va.status = 'approved'
      where t.receipt_document_id = d.id)
  ) then raise exception 'FAIL: QA15 can read a document not attached to a shared transaction'; end if;

  -- Avatar files: only QA15's own folder is listable.
  if exists (select 1 from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] <> me::text) then
    raise exception 'FAIL: QA15 can list another user''s avatar files';
  end if;

  -- Direct viewer_access inserts are refused (requests go through the RPC).
  begin
    insert into public.viewer_access (requester_user_id, owner_user_id)
    values (me, '8330b931-4022-40ba-bef2-79af3dc8035f');
    raise exception 'FAIL: QA15 inserted a viewer_access row directly';
  exception when insufficient_privilege then null;
  end;

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

  -- Account details RPC only touches the caller's own accounts.
  begin
    perform public.set_account_details('__no_such_account__', 'credit_card', 1000, 12, 2);
    raise exception 'FAIL: set_account_details accepted an unknown account';
  exception when others then
    if sqlerrm <> 'Account not found' then raise; end if;
  end;

  -- Writes to someone else's rows silently affect nothing.
  update public.transactions set merchant = 'hijack' where owner_user_id <> me;
  if found then raise exception 'FAIL: QA15 updated another user''s transaction'; end if;
  delete from public.transactions where owner_user_id <> me;
  if found then raise exception 'FAIL: QA15 deleted another user''s transaction'; end if;
  -- Splits: only your own, only on your own expense, only with an approved connection.
  if exists (select 1 from public.transaction_splits where owner_user_id <> me and with_user_id <> me) then
    raise exception 'FAIL: QA15 can read a split they are not part of';
  end if;
  begin
    insert into public.transaction_splits (transaction_id, owner_user_id, with_user_id, description, date, amount)
    select id, me, '8330b931-4022-40ba-bef2-79af3dc8035f', 'sec-test', '2026-01-01', 1
    from public.transactions where owner_user_id = me and type = 'expense' limit 1;
    if found then raise exception 'FAIL: split with an unconnected user was accepted'; end if;
  exception when insufficient_privilege then null;
  end;
  -- Split amounts: one share can't exceed its expense, all shares together
  -- can't either, and a split can't be re-pointed. Needs an approved
  -- connection and an unsplit expense; skipped when QA15 has neither.
  declare
    partners uuid[];
    tx_id uuid;
    tx_amount numeric;
  begin
    select array_agg(p) into partners from (
      select case when va.owner_user_id = me then va.requester_user_id else va.owner_user_id end as p
      from public.viewer_access va
      where va.status = 'approved' and (va.owner_user_id = me or va.requester_user_id = me)
      limit 2
    ) c;
    select t.id, t.amount into tx_id, tx_amount
    from public.transactions t
    where t.owner_user_id = me and t.type = 'expense'
      and not exists (select 1 from public.transaction_splits s where s.transaction_id = t.id)
    limit 1;
    if partners is not null and tx_id is not null then
      begin
        insert into public.transaction_splits (transaction_id, owner_user_id, with_user_id, description, date, amount)
        values (tx_id, me, partners[1], 'sec-test', '2026-01-01', tx_amount + 1);
        raise exception 'FAIL: a split larger than its expense was accepted';
      exception when insufficient_privilege or check_violation then null;
      end;
      insert into public.transaction_splits (transaction_id, owner_user_id, with_user_id, description, date, amount)
      values (tx_id, me, partners[1], 'sec-test', '2026-01-01', tx_amount);
      if array_length(partners, 1) > 1 then
        begin
          insert into public.transaction_splits (transaction_id, owner_user_id, with_user_id, description, date, amount)
          values (tx_id, me, partners[2], 'sec-test', '2026-01-01', 0.01);
          raise exception 'FAIL: splits adding up to more than their expense were accepted';
        exception when check_violation then null;
        end;
      end if;
      begin
        update public.transaction_splits set with_user_id = me where transaction_id = tx_id;
        raise exception 'FAIL: a split was re-pointed at another user';
      exception when insufficient_privilege then null;
      end;
    end if;
  end;
  update public.budgets set rollover = true where owner_user_id <> me;
  if found then raise exception 'FAIL: QA15 changed another user''s budget rollover'; end if;

  -- Debit cards: own-only, on one of your own savings/current accounts; a
  -- card payment stays on that account, is spending or a transfer out, and is
  -- always recorded as 'Debit card'. Uses throwaway accounts where needed.
  declare
    bank text;
    bank2 text := '__sec_test_bank2__';
    fake text := '__sec_test_fake_debit__';
    wallet text := '__sec_test_wallet__';
    closed_acct text := '__sec_test_closed__';
    card uuid;
    card2 uuid;
    cat text;
    pm text;
    fp text;
  begin
    if exists (select 1 from public.debit_cards where owner_user_id <> me) then
      raise exception 'FAIL: QA15 can read another user''s debit cards';
    end if;
    select name into bank from public.accounts
    where owner_user_id = me and kind in ('savings', 'current') order by name limit 1;
    if bank is null then
      bank := '__sec_test_bank__';
      insert into public.accounts (owner_user_id, name) values (me, bank);
    end if;
    insert into public.accounts (owner_user_id, name) values (me, wallet);
    perform public.set_account_details(wallet, 'wallet', null, null, null);

    insert into public.debit_cards (owner_user_id, name, last4, account)
    values (me, '  sec-test card  ', '1234', bank) returning id into card;
    if (select name from public.debit_cards where id = card) <> 'sec-test card' then
      raise exception 'FAIL: a debit card name was not trimmed';
    end if;
    perform set_config('sectest.card', card::text, true);

    begin
      insert into public.debit_cards (owner_user_id, name, account)
      values ('8330b931-4022-40ba-bef2-79af3dc8035f', 'sec-test other', bank);
      raise exception 'FAIL: QA15 created a debit card for another user';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.debit_cards set owner_user_id = '8330b931-4022-40ba-bef2-79af3dc8035f' where id = card;
      raise exception 'FAIL: QA15 handed a debit card to another user';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.debit_cards (owner_user_id, name, account) values (me, 'sec-test wallet card', wallet);
      raise exception 'FAIL: a debit card drawing from a wallet was accepted';
    exception when check_violation then null;
    end;
    insert into public.accounts (owner_user_id, name) values (me, closed_acct);
    perform public.set_account_closed(closed_acct, true);
    begin
      insert into public.debit_cards (owner_user_id, name, account) values (me, 'sec-test closed card', closed_acct);
      raise exception 'FAIL: a debit card on a closed account was accepted';
    exception when check_violation then null;
    end;

    select name into cat from public.categories where owner_user_id = me and kind = 'expense' order by name limit 1;
    if cat is not null then
      begin
        insert into public.transactions (owner_user_id, date, merchant, category, amount, type, account, fingerprint, debit_card_id)
        values (me, '2026-01-01', 'sec-test', cat, 1, 'expense', wallet, 'sec-test-debit-elsewhere', card);
        raise exception 'FAIL: a debit card payment from another account was accepted';
      exception when check_violation then null;
      end;
      begin
        insert into public.transactions (owner_user_id, date, merchant, category, amount, type, account, fingerprint, debit_card_id)
        values (me, '2026-01-01', 'sec-test', cat, 1, 'income', bank, 'sec-test-debit-income', card);
        raise exception 'FAIL: income paid by debit card was accepted';
      exception when check_violation then null;
      end;
      insert into public.transactions (owner_user_id, date, merchant, category, amount, type, account, fingerprint, debit_card_id, payment_method)
      values (me, '2026-01-01', 'sec-test', cat, 1, 'expense', bank, 'sec-test-debit', card, 'UPI')
      returning payment_method into pm;
      if pm is distinct from 'Debit card' then
        raise exception 'FAIL: a debit card payment was saved with payment method %', pm;
      end if;
    end if;

    -- A card with purchases can't move to another account (they'd stay
    -- behind); a card without purchases can.
    insert into public.accounts (owner_user_id, name) values (me, bank2);
    if cat is not null then
      begin
        update public.debit_cards set account = bank2 where id = card;
        raise exception 'FAIL: a debit card with purchases moved to another account';
      exception when others then
        if sqlerrm <> format('This card already has purchases on %s. Add a new card for the other account instead.', bank) then
          raise;
        end if;
      end;
    end if;
    insert into public.debit_cards (owner_user_id, name, account) values (me, 'sec-test card 2', bank) returning id into card2;
    update public.debit_cards set account = bank2 where id = card2;
    if (select account from public.debit_cards where id = card2) is distinct from bank2 then
      raise exception 'FAIL: a debit card without purchases could not move';
    end if;

    -- Converting a fake debit-card account re-fingerprints its purchases for
    -- the linked account, so re-importing that account's statement matches them.
    if cat is not null then
      insert into public.accounts (owner_user_id, name) values (me, fake);
      insert into public.transactions (owner_user_id, date, merchant, category, amount, type, account, fingerprint)
      values (me, '2026-01-02', ' Sec Test Shop ', cat, 12.5, 'expense', fake, '2026-01-02|sec test shop|12.50|' || fake);
      perform public.convert_account_to_debit_card(fake, bank2, null);
      select t.fingerprint into fp from public.transactions t
      where t.owner_user_id = me and t.date = '2026-01-02' and t.merchant = ' Sec Test Shop ';
      if fp is distinct from '2026-01-02|sec test shop|12.50|' || bank2 then
        raise exception 'FAIL: a converted purchase kept a fingerprint for the old account (%)', fp;
      end if;
    end if;

    begin
      perform public.set_account_details(bank, 'credit_card', null, null, null);
      raise exception 'FAIL: an account with debit cards changed to a credit card';
    exception when others then
      if sqlerrm <> 'Move or remove its debit cards first' then raise; end if;
    end;
    begin
      perform public.convert_account_to_debit_card('__no_such_account__', bank, null);
      raise exception 'FAIL: convert_account_to_debit_card accepted an unknown account';
    exception when others then
      if sqlerrm <> 'Account not found' then raise; end if;
    end;
  end;

  -- Cash is always kept: the last open cash account can't be deleted, closed or
  -- changed to another kind; an extra cash account can be deleted.
  declare
    last_cash text;
    extra_cash text := '__sec_test_cash2__';
    r record;
  begin
    select name into last_cash from public.accounts
    where owner_user_id = me and kind = 'cash' and closed_at is null order by name limit 1;
    if last_cash is null then
      raise exception 'FAIL: QA15 has no open cash account';
    end if;
    -- Leave last_cash as the only open one (rolled back at the end).
    for r in select name from public.accounts
             where owner_user_id = me and kind = 'cash' and closed_at is null and name <> last_cash loop
      perform public.set_account_closed(r.name, true);
    end loop;
    begin
      delete from public.accounts where owner_user_id = me and name = last_cash;
      raise exception 'FAIL: the last cash account was deleted';
    exception when others then
      if sqlerrm <> 'Cash is always kept' then raise; end if;
    end;
    begin
      perform public.set_account_closed(last_cash, true);
      raise exception 'FAIL: the last cash account was closed';
    exception when others then
      if sqlerrm <> 'Cash is always kept' then raise; end if;
    end;
    begin
      perform public.set_account_details(last_cash, 'wallet', null, null, null);
      raise exception 'FAIL: the last cash account changed to another kind';
    exception when others then
      if sqlerrm <> 'Cash is always kept' then raise; end if;
    end;
    insert into public.accounts (owner_user_id, name) values (me, extra_cash);
    perform public.set_account_details(extra_cash, 'cash', null, null, null);
    delete from public.accounts where owner_user_id = me and name = extra_cash;
    if exists (select 1 from public.accounts where owner_user_id = me and name = extra_cash) then
      raise exception 'FAIL: an extra cash account could not be deleted';
    end if;
  end;

  -- Admin dashboard: every admin_* function refuses a non-admin, and only
  -- admins can write announcements.
  begin
    perform public.admin_overview();
    raise exception 'FAIL: QA15 called admin_overview';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.admin_list_users();
    raise exception 'FAIL: QA15 listed users';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.admin_client_errors(30);
    raise exception 'FAIL: QA15 read client errors';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.app_announcements (message) values ('sec-test');
    raise exception 'FAIL: QA15 posted an announcement';
  exception when insufficient_privilege then null;
  end;
  update public.app_announcements set message = 'hijack';
  if found then raise exception 'FAIL: QA15 edited an announcement'; end if;

  -- Loan details: all three or none.
  begin
    insert into public.recurring_items (owner_user_id, kind, name, category, amount, cadence, next_date, account, loan_amount)
    values (me, 'recurring', 'sec-test loan', 'Other', 1, 'monthly', '2026-01-01', 'Cash', 1000);
    raise exception 'FAIL: a recurring item with partial loan details was accepted';
  exception when check_violation then null;
  end;

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

-- Being admin grants nothing on debit cards: QA15's card (made above) stays
-- invisible, untouchable, and unusable on the admin's own transactions.
do $$
declare
  me uuid := '8330b931-4022-40ba-bef2-79af3dc8035f';
  qa_card uuid := nullif(current_setting('sectest.card', true), '')::uuid;
  acct text;
  cat text;
begin
  if exists (select 1 from public.debit_cards where owner_user_id <> me) then
    raise exception 'FAIL: the admin can read another user''s debit cards';
  end if;
  update public.debit_cards set name = 'hijack' where owner_user_id <> me;
  if found then raise exception 'FAIL: the admin renamed another user''s debit card'; end if;
  delete from public.debit_cards where owner_user_id <> me;
  if found then raise exception 'FAIL: the admin deleted another user''s debit card'; end if;
  select name into acct from public.accounts where owner_user_id = me and kind in ('savings', 'current') order by name limit 1;
  select name into cat from public.categories where owner_user_id = me and kind = 'expense' order by name limit 1;
  if qa_card is not null and acct is not null and cat is not null then
    begin
      insert into public.transactions (owner_user_id, date, merchant, category, amount, type, account, fingerprint, debit_card_id)
      values (me, '2026-01-01', 'sec-test', cat, 1, 'expense', acct, 'sec-test-foreign-card', qa_card);
      raise exception 'FAIL: the admin paid with another user''s debit card';
    exception when foreign_key_violation then null;
    end;
  end if;
end $$;

do $
declare visible int; total int;
begin
  if not public.is_admin() then raise exception 'FAIL: the admin is not is_admin()'; end if;
  if (public.admin_overview() ->> 'users')::int < 1 then raise exception 'FAIL: admin_overview returned no users'; end if;
  if not exists (select 1 from public.admin_list_users()) then raise exception 'FAIL: admin_list_users returned nothing'; end if;
  insert into public.app_announcements (message) values ('sec-test announcement');
  select count(*) into visible from public.profiles;
  reset role;
  select count(*) into total from public.profiles;
  if visible <> total then raise exception 'FAIL: admin sees % of % profiles', visible, total; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. As anon (no session). transaction_splits isn't granted to anon at all.
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  if has_table_privilege('anon', 'public.transaction_splits', 'select') then
    raise exception 'FAIL: anon has SELECT on transaction_splits';
  end if;
  if has_table_privilege('anon', 'public.debit_cards', 'select') then
    raise exception 'FAIL: anon has SELECT on debit_cards';
  end if;
  if has_table_privilege('anon', 'public.app_announcements', 'select') then
    raise exception 'FAIL: anon can read announcements';
  end if;
  if has_function_privilege('anon', 'public.convert_account_to_debit_card(text,text,text)', 'execute') then
    raise exception 'FAIL: anon can call convert_account_to_debit_card';
  end if;
  if exists (select 1 from public.transactions) or exists (select 1 from public.budgets)
     or exists (select 1 from public.viewer_access) then
    raise exception 'FAIL: anon can read user data';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'avatars') then
    raise exception 'FAIL: anon can list avatar files (user ids)';
  end if;
end $$;

reset role;
select 'ALL SECURITY CHECKS PASSED' as result;
rollback;
