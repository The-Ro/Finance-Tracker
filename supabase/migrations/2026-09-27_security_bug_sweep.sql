-- Run this once in the Supabase SQL editor (or via `supabase db push`), then
-- run supabase/tests/security_regression.sql and expect ALL SECURITY CHECKS PASSED.
-- Safe to re-run. Mirrored into schema.sql (appended) and policies.sql.
--
-- 1. Shared viewers see only receipts attached to transactions they can see.
-- 2. Split total can't exceed the expense; a split's people/transaction can't change.
-- 3. The payer can settle splits after the connection is paused or revoked.
-- 4. Access requests need the target's exact email (no creating requests by
--    user id); avatars can't be listed; profiles.email can't be edited.
-- 5. mark_recurring_item_paid advances from next_date and keeps the day of month.
-- 6. Size limits on client_errors and the avatars bucket.

-- ===== schema =====

create index if not exists transactions_receipt_document_idx
  on public.transactions (receipt_document_id) where receipt_document_id is not null;

-- profiles.email mirrors auth.users.email; undo any edits made while it was writable.
update public.profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, display_name text, email text, avatar text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, u.email::text, p.avatar
  from auth.users u
  join public.profiles p on p.id = u.id
  where auth.uid() is not null
    and lower(u.email) = lower(trim(p_email))
    and u.id <> auth.uid()
  order by u.created_at, u.id
  limit 1;
$$;
revoke execute on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;

create or replace function public.request_viewer_access(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select u.id into target
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email)) and u.id <> auth.uid()
  order by u.created_at, u.id
  limit 1;
  if target is null then
    raise exception 'No LedgeEaze account with that exact email.' using errcode = 'P0002';
  end if;
  insert into public.viewer_access (requester_user_id, owner_user_id, status)
  values (auth.uid(), target, 'pending');
end;
$$;
revoke execute on function public.request_viewer_access(text) from public, anon;
grant execute on function public.request_viewer_access(text) to authenticated;

create or replace function public.transaction_splits_cap_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expense_amount numeric;
  already_split numeric;
begin
  select t.amount into expense_amount
  from public.transactions t
  where t.id = new.transaction_id
  for update;
  select coalesce(sum(s.amount), 0) into already_split
  from public.transaction_splits s
  where s.transaction_id = new.transaction_id and s.id <> new.id;
  if expense_amount is not null and already_split + new.amount > expense_amount then
    raise exception 'Splits can''t add up to more than the expense' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists transaction_splits_cap_total on public.transaction_splits;
create trigger transaction_splits_cap_total
  before insert or update of amount, transaction_id on public.transaction_splits
  for each row execute function public.transaction_splits_cap_total();
revoke execute on function public.transaction_splits_cap_total() from public, anon, authenticated;

alter table public.recurring_items add column if not exists anchor_day smallint;
alter table public.recurring_items drop constraint if exists recurring_items_anchor_day_check;
alter table public.recurring_items add constraint recurring_items_anchor_day_check
  check (anchor_day is null or anchor_day between 1 and 31);
update public.recurring_items set anchor_day = extract(day from next_date) where anchor_day is null;

-- A next_date that agrees with the anchor (e.g. Feb 28 for a 31st bill) keeps
-- it; any other date change is a user edit and becomes the new anchor.
create or replace function public.recurring_items_keep_anchor_day()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  month_days int := extract(day from (date_trunc('month', new.next_date::timestamp) + interval '1 month - 1 day'))::int;
begin
  if tg_op = 'INSERT' then
    new.anchor_day := coalesce(new.anchor_day, extract(day from new.next_date)::int);
  elsif new.next_date is distinct from old.next_date
    and new.anchor_day is not distinct from old.anchor_day
    and (old.anchor_day is null
         or extract(day from new.next_date)::int <> least(old.anchor_day, month_days)) then
    new.anchor_day := extract(day from new.next_date)::int;
  end if;
  return new;
end;
$$;
drop trigger if exists recurring_items_keep_anchor_day on public.recurring_items;
create trigger recurring_items_keep_anchor_day
  before insert or update of next_date, anchor_day on public.recurring_items
  for each row execute function public.recurring_items_keep_anchor_day();
revoke execute on function public.recurring_items_keep_anchor_day() from public, anon, authenticated;

create or replace function public.mark_recurring_item_paid(recurring_item_id uuid, paid_on date)
returns void as $$
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

  -- One payment covers one period: step from the due date, not the payment
  -- date, and keep the original day of month (a 31st bill is due Feb 28, then Mar 31).
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

  -- Must remain identical to buildFingerprint() in src/lib/fingerprint.ts.
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

revoke execute on function public.mark_recurring_item_paid(uuid, date) from public, anon;
grant execute on function public.mark_recurring_item_paid(uuid, date) to authenticated;

alter table public.client_errors drop constraint if exists client_errors_size_check;
alter table public.client_errors add constraint client_errors_size_check check (
  char_length(message) <= 5000
  and (stack is null or char_length(stack) <= 50000)
  and (url is null or char_length(url) <= 4096)
  and (user_agent is null or char_length(user_agent) <= 1024)
) not valid;

-- ===== policies and grants =====

drop policy if exists profiles_select_own_or_connected on public.profiles;
create policy profiles_select_own_or_connected on public.profiles for select to authenticated
  using (
    auth.uid() = id
    or public.is_admin()
    or exists (
      select 1 from public.viewer_access va
      where (va.requester_user_id = auth.uid() and va.owner_user_id = profiles.id)
         or (va.owner_user_id = auth.uid() and va.requester_user_id = profiles.id)
    )
    or exists (
      select 1 from public.transaction_splits s
      where (s.owner_user_id = auth.uid() and s.with_user_id = profiles.id)
         or (s.with_user_id = auth.uid() and s.owner_user_id = profiles.id)
    )
  );

drop policy if exists profiles_insert_self on public.profiles;
revoke insert, update on public.profiles from anon, authenticated;
grant update (display_name, avatar) on public.profiles to authenticated;

drop policy if exists viewer_access_insert on public.viewer_access;
revoke insert, update on public.viewer_access from anon, authenticated;
grant update (status, responded_at) on public.viewer_access to authenticated;

drop policy if exists documents_select_shared on public.documents;
create policy documents_select_shared on public.documents for select
  using (
    exists (
      select 1 from public.transactions t
      join public.viewer_access va
        on va.owner_user_id = t.owner_user_id
       and va.requester_user_id = auth.uid()
       and va.status = 'approved'
      where t.receipt_document_id = documents.id
        and t.owner_user_id = documents.owner_user_id
    )
  );

drop policy if exists documents_storage_select_shared on storage.objects;
create policy documents_storage_select_shared on storage.objects for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      join public.transactions t
        on t.receipt_document_id = d.id and t.owner_user_id = d.owner_user_id
      join public.viewer_access va
        on va.owner_user_id = t.owner_user_id
       and va.requester_user_id = auth.uid()
       and va.status = 'approved'
      where d.storage_path = objects.name
        and d.owner_user_id::text = (storage.foldername(objects.name))[2]
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_storage_select_all on storage.objects;
drop policy if exists avatars_storage_select_own on storage.objects;
create policy avatars_storage_select_own on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Account deletion and avatar replacement list + remove the caller's own folder.
drop policy if exists avatars_storage_delete_own on storage.objects;
create policy avatars_storage_delete_own on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists transaction_splits_insert_own on public.transaction_splits;
create policy transaction_splits_insert_own on public.transaction_splits
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (select 1 from public.transactions t
                where t.id = transaction_splits.transaction_id and t.owner_user_id = auth.uid()
                  and t.type = 'expense' and transaction_splits.amount <= t.amount)
    and exists (select 1 from public.viewer_access va where va.status = 'approved'
                and ((va.owner_user_id = auth.uid() and va.requester_user_id = transaction_splits.with_user_id)
                  or (va.requester_user_id = auth.uid() and va.owner_user_id = transaction_splits.with_user_id)))
  );

drop policy if exists transaction_splits_update_own on public.transaction_splits;
create policy transaction_splits_update_own on public.transaction_splits
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

revoke update on public.transaction_splits from authenticated;
grant update (settled_at) on public.transaction_splits to authenticated;
revoke all on public.transaction_splits from anon;
