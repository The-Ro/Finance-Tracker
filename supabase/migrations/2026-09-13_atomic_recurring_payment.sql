-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- Safe to re-run: creates/replaces the atomic recurring-payment RPC.

create or replace function public.mark_recurring_item_paid(recurring_item_id uuid, paid_on date)
returns void as $$
declare
  item public.recurring_items%rowtype;
  next_due_date date;
  payment_fingerprint text;
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

  next_due_date := case item.cadence
    when 'weekly' then paid_on + 7
    when 'biweekly' then paid_on + 14
    when 'monthly' then (paid_on + interval '1 month')::date
    when 'quarterly' then (paid_on + interval '3 months')::date
    when 'half-yearly' then (paid_on + interval '6 months')::date
    when 'annual' then (paid_on + interval '1 year')::date
  end;

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

  update public.recurring_items
  set next_date = next_due_date
  where id = item.id;
end;
$$ language plpgsql security definer set search_path = '';

revoke execute on function public.mark_recurring_item_paid(uuid, date) from public;
revoke execute on function public.mark_recurring_item_paid(uuid, date) from anon;
grant execute on function public.mark_recurring_item_paid(uuid, date) to authenticated;
