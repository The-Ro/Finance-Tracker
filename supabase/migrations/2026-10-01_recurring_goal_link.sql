-- SIPs and goals: a recurring payment (a SIP, an RD, a savings transfer) can
-- feed a goal. Each "Mark paid" then also adds its amount to the goal, in the
-- same call that logs the payment. The link can only point at the owner's own
-- goal (composite FK), and deleting the goal just clears the link.

alter table public.goals drop constraint if exists goals_id_owner_key;
alter table public.goals add constraint goals_id_owner_key unique (id, owner_user_id);

alter table public.recurring_items add column if not exists goal_id uuid;
alter table public.recurring_items drop constraint if exists recurring_items_goal_fkey;
alter table public.recurring_items add constraint recurring_items_goal_fkey
  foreign key (goal_id, owner_user_id) references public.goals (id, owner_user_id) on delete set null (goal_id);

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
    null, null, null, '{}', false, null, 'manual', payment_fingerprint
  );

  -- A SIP (or any payment) linked to a goal adds to it.
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
