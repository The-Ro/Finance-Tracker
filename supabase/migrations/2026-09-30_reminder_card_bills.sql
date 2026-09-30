-- The daily reminder said "card bill due" whenever the card's due day came
-- and the card owed anything -- even when no bill had been made (spends after
-- the statement date go on the NEXT bill). It now uses the app's own rule
-- (src/lib/creditCards.ts cardStatus): the bill is what was owed at the end
-- of the last statement date, minus payments into the card since; it's due on
-- the first due day after that statement date. Only a bill above zero is
-- mentioned, with its amount, when due today / in 2 days, or past due.
-- Safe to re-run; mirrored into schema.sql.

-- Day `p_day` of the month starting `p_month`, clamped to that month's length
-- (src/lib/creditCards.ts dayOfMonth).
create or replace function public.push_day_in_month(p_month date, p_day int)
returns date
language sql immutable set search_path = ''
as $$
  select date_trunc('month', p_month)::date
         + (least(greatest(p_day, 1), extract(day from date_trunc('month', p_month) + interval '1 month - 1 day')::int) - 1);
$$;
revoke execute on function public.push_day_in_month(date, int) from public, anon, authenticated;

-- One card's current bill: statement date, due date and what's still to pay.
create or replace function public.push_card_bill(p_owner uuid, p_account text, p_opening numeric, p_statement_day int, p_due_day int, p_today date)
returns table (statement_date date, due_date date, due numeric)
language sql stable security definer set search_path = ''
as $$
  with s as (
    select case
             when public.push_day_in_month(p_today, p_statement_day) <= p_today then public.push_day_in_month(p_today, p_statement_day)
             else public.push_day_in_month((p_today - interval '1 month')::date, p_statement_day)
           end as stmt
  ), d as (
    select s.stmt,
           case
             when public.push_day_in_month(s.stmt, p_due_day) > s.stmt then public.push_day_in_month(s.stmt, p_due_day)
             else public.push_day_in_month((s.stmt + interval '1 month')::date, p_due_day)
           end as due_on
    from s
  ), tx as (
    select t.date, t.type, t.amount,
           case
             when t.type = 'income' and t.account = p_account then t.amount
             when t.type = 'expense' and t.account = p_account then -t.amount
             when t.type = 'transfer' and t.account = p_account then -t.amount
             when t.type = 'transfer' and t.to_account = p_account then t.amount
             else 0
           end as effect
    from public.transactions t
    where t.owner_user_id = p_owner and (t.account = p_account or t.to_account = p_account)
  )
  select d.stmt, d.due_on,
         greatest(0, round(
           greatest(0, -(p_opening + coalesce((select sum(effect) from tx where tx.date <= d.stmt), 0)))
           - coalesce((select sum(amount) from tx where tx.date > d.stmt and tx.date <= p_today and tx.type <> 'expense' and tx.effect > 0), 0),
         2))
  from d;
$$;
revoke execute on function public.push_card_bill(uuid, text, numeric, int, int, date) from public, anon, authenticated;

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

    -- Credit card bills: only a real bill (made on the last statement date,
    -- not yet paid off), due today, in 2 days, or already past due.
    select string_agg(
             a.name || ' bill ' || public.push_money(b.due, cur) || ' ' ||
             case when b.due_date < p_today then 'overdue since ' || to_char(b.due_date, 'FMMon FMDD')
                  when b.due_date = p_today then 'due today'
                  else 'due ' || to_char(b.due_date, 'FMMon FMDD') end,
             ', ' order by b.due_date, a.name)
      into names
      from public.accounts a
      cross join lateral public.push_card_bill(u.id, a.name, a.opening_balance, a.statement_day, a.due_day, p_today) b
      where a.owner_user_id = u.id and a.kind = 'credit_card' and a.closed_at is null
        and a.statement_day is not null and a.due_day is not null
        and b.due > 0 and b.due_date <= p_today + 2;
    if names is not null then
      lines := lines || names;
      go_to := coalesce(go_to, '/bills');
    end if;

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
