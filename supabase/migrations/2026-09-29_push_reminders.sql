-- Phone reminders (Web Push) while the app is closed. The one scheduled job in
-- LedgeEaze: every day at 9:00 IST pg_cron calls the send-reminders Edge
-- Function, which asks push_digest() what each person should hear about
-- (bills due or overdue, card bills due soon, salary day, lent money due) and
-- pushes one notification per device that turned reminders on.
--
-- Secrets live in Vault, never in this file. Create them once per project:
--   select vault.create_secret('<{"publicKey":JWK,"privateKey":JWK}>', 'push_vapid_keys');
--   select vault.create_secret('<random string>', 'push_cron_secret');
-- The app's public key (src/lib/push.ts VAPID_PUBLIC_KEY) must match push_vapid_keys.
-- Safe to re-run; mirrored into schema.sql and policies.sql.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ===== Devices that turned reminders on =====
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_sent_on date
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated
  using (auth.uid() = owner_user_id);
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated
  using (auth.uid() = owner_user_id);

-- Saving goes through this RPC: a device's endpoint belongs to whoever turned
-- reminders on last, so a shared phone never gets the previous person's.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Invalid subscription' using errcode = '22023';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (owner_user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ===== What to say =====
create or replace function public.push_money(p_amount numeric, p_currency text)
returns text
language sql immutable set search_path = ''
as $$
  select case coalesce(p_currency, 'INR')
           when 'INR' then '₹' when 'USD' then '$' when 'EUR' then '€' when 'GBP' then '£'
           else coalesce(p_currency, '') || ' ' end
         || to_char(p_amount, case when p_amount = trunc(p_amount) then 'FM999,999,999,999' else 'FM999,999,999,990.00' end);
$$;
revoke execute on function public.push_money(numeric, text) from public, anon, authenticated;

-- One row per person with something to hear about today (only people with a
-- device that hasn't had today's reminder yet). Service role only.
create or replace function public.push_digest(p_today date)
returns table (owner_user_id uuid, title text, body text, url text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  u record;
  lines text[];
  cur text;
  n_overdue int;
  n_bills int;
  names text;
  go_to text;
begin
  for u in
    select distinct s.owner_user_id as id from public.push_subscriptions s
    where s.last_sent_on is null or s.last_sent_on < p_today
  loop
    lines := '{}';
    go_to := null;
    select coalesce(us.currency, 'INR') into cur from public.user_settings us where us.owner_user_id = u.id;

    -- Bills and subscriptions: overdue, due today, due tomorrow.
    select count(*), string_agg(r.name || ' ' || public.push_money(r.amount, cur), ', ' order by r.next_date, r.name)
      into n_overdue, names
      from public.recurring_items r where r.owner_user_id = u.id and r.active and r.next_date < p_today;
    if n_overdue > 0 then
      lines := lines || ('Overdue: ' || names);
      go_to := '/bills';
    end if;
    select count(*), string_agg(r.name || ' ' || public.push_money(r.amount, cur), ', ' order by r.name)
      into n_bills, names
      from public.recurring_items r where r.owner_user_id = u.id and r.active and r.next_date = p_today;
    if n_bills > 0 then
      lines := lines || ('Due today: ' || names);
      go_to := coalesce(go_to, '/bills');
    end if;
    select count(*), string_agg(r.name || ' ' || public.push_money(r.amount, cur), ', ' order by r.name)
      into n_bills, names
      from public.recurring_items r where r.owner_user_id = u.id and r.active and r.next_date = p_today + 1;
    if n_bills > 0 then
      lines := lines || ('Due tomorrow: ' || names);
      go_to := coalesce(go_to, '/bills');
    end if;

    -- Credit card bills due today or in 2 days, when something is owed.
    select string_agg(c.name || ' bill due ' || case when c.due = p_today then 'today' else to_char(c.due, 'FMMon FMDD') end, ', ')
      into names
      from (
        select a.name,
               case when d.this_month >= p_today then d.this_month else d.next_month end as due,
               a.opening_balance + coalesce((
                 select sum(case
                   when t.type = 'income' and t.account = a.name then t.amount
                   when t.type = 'expense' and t.account = a.name then -t.amount
                   when t.type = 'transfer' and t.account = a.name then -t.amount
                   when t.type = 'transfer' and t.to_account = a.name then t.amount
                   else 0 end)
                 from public.transactions t
                 where t.owner_user_id = u.id and (t.account = a.name or t.to_account = a.name)), 0) as balance
        from public.accounts a
        cross join lateral (
          select make_date(extract(year from p_today)::int, extract(month from p_today)::int,
                   least(a.due_day, extract(day from (date_trunc('month', p_today) + interval '1 month - 1 day'))::int)) as this_month,
                 make_date(extract(year from p_today + interval '1 month')::int, extract(month from p_today + interval '1 month')::int,
                   least(a.due_day, extract(day from (date_trunc('month', p_today + interval '1 month') + interval '1 month - 1 day'))::int)) as next_month
        ) d
        where a.owner_user_id = u.id and a.kind = 'credit_card' and a.closed_at is null and a.due_day is not null
      ) c
      where c.balance < 0 and c.due in (p_today, p_today + 2);
    if names is not null then
      lines := lines || names;
      go_to := coalesce(go_to, '/bills');
    end if;

    -- Salary day: from pay day until it's confirmed for the month.
    if exists (
      select 1 from public.user_settings us
      where us.owner_user_id = u.id and us.salary_day is not null
        and coalesce(us.salary_confirmed_month, '') <> to_char(p_today, 'YYYY-MM')
        and extract(day from p_today)::int >= least(us.salary_day,
              extract(day from (date_trunc('month', p_today) + interval '1 month - 1 day'))::int)
    ) then
      lines := lines || 'Did your salary arrive? Tap to confirm.'::text;
      go_to := coalesce(go_to, '/');
    end if;

    -- Lent & borrowed with a pay-back date that has come.
    select string_agg(case when i.direction = 'lent'
                        then i.person || ' should pay you back ' || public.push_money(i.left_amount, cur)
                        else 'Pay back ' || i.person || ' ' || public.push_money(i.left_amount, cur) end, ', ')
      into names
      from (
        select x.person, x.direction, x.amount - coalesce((select sum(p.amount) from public.iou_payments p where p.iou_id = x.id), 0) as left_amount
        from public.ious x
        where x.owner_user_id = u.id and x.due_date is not null and x.due_date <= p_today
      ) i
      where i.left_amount > 0;
    if names is not null then
      lines := lines || names;
      go_to := coalesce(go_to, '/lent');
    end if;

    if array_length(lines, 1) > 0 then
      owner_user_id := u.id;
      title := case when n_overdue > 0 then 'Payment overdue' else 'Today in LedgeEaze' end;
      body := array_to_string(lines[1:4], E'\n');
      url := coalesce(go_to, '/');
      return next;
    end if;
  end loop;
end;
$$;
revoke execute on function public.push_digest(date) from public, anon, authenticated;
grant execute on function public.push_digest(date) to service_role;

-- The Edge Function reads its keys through this (service role only).
create or replace function public.push_server_config()
returns table (vapid_keys text, cron_secret text)
language sql stable security definer set search_path = ''
as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_keys'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret');
$$;
revoke execute on function public.push_server_config() from public, anon, authenticated;
grant execute on function public.push_server_config() to service_role;

-- ===== Every day at 03:30 UTC = 09:00 IST =====
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ledgeeaze-daily-reminders') then
    perform cron.unschedule('ledgeeaze-daily-reminders');
  end if;
end $$;
select cron.schedule(
  'ledgeeaze-daily-reminders',
  '30 3 * * *',
  $job$
    select net.http_post(
      url := 'https://izidxazhknyoxeqgnqdb.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);
