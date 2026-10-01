-- Investments: a recurring payment can be marked as an investment (a SIP, RD,
-- PPF, NPS...). Marking one paid tags the logged entry #invest, which is how
-- the Investments page (and any one-off investment the user tags #invest)
-- counts money put into investments. Nothing here tracks market value.
alter table public.recurring_items add column if not exists is_investment boolean not null default false;

create or replace function public.mark_recurring_item_paid(recurring_item_id uuid, paid_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.recurring_items%rowtype;
  next_due_date date;
  payment_fingerprint text;
  anchor int;
  step_months int;
  month_start date;
  month_days int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into item
  from public.recurring_items
  where id = recurring_item_id and owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Recurring item not found' using errcode = 'P0002';
  end if;
  if not item.active then
    raise exception 'Recurring item is inactive' using errcode = 'P0001';
  end if;
  if item.account is null then
    raise exception 'Add an account before marking this item paid' using errcode = 'P0001';
  end if;
  if paid_on is null then
    raise exception 'Payment date is required' using errcode = '22004';
  end if;

  if item.cadence in ('weekly', 'biweekly') then
    next_due_date := item.next_date + case item.cadence when 'weekly' then 7 else 14 end;
  else
    anchor := coalesce(item.anchor_day, extract(day from item.next_date)::int);
    step_months := case item.cadence
      when 'monthly' then 1
      when 'quarterly' then 3
      when 'half-yearly' then 6
      when 'annual' then 12
    end;
    month_start := (date_trunc('month', item.next_date::timestamp) + make_interval(months => step_months))::date;
    month_days := extract(day from (month_start + interval '1 month - 1 day'))::int;
    next_due_date := month_start + (least(anchor, month_days) - 1);
  end if;

  payment_fingerprint := concat_ws(
    '|',
    paid_on::text,
    lower(trim(item.name)),
    to_char(item.amount, 'FM9999999990.00'),
    lower(trim(item.account))
  );

  insert into public.transactions (
    owner_user_id, date, merchant, category, amount, type, account,
    to_account, remarks, payment_method, tags, receipt, receipt_document_id,
    source, fingerprint
  ) values (
    auth.uid(), paid_on, item.name, item.category, item.amount, 'expense', item.account,
    null, null, null,
    case when item.is_investment then array['invest']::text[] else '{}'::text[] end,
    false, null, 'manual', payment_fingerprint
  );

  if item.goal_id is not null then
    update public.goals
       set current_amount = current_amount + item.amount
     where id = item.goal_id and owner_user_id = auth.uid();
  end if;

  update public.recurring_items
  set next_date = next_due_date
  where id = item.id;
end;
$$;
revoke execute on function public.mark_recurring_item_paid(uuid, date) from public, anon;
grant execute on function public.mark_recurring_item_paid(uuid, date) to authenticated;
