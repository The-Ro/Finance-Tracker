-- Pay day goes into the bell's history too (not only the 9 AM phone
-- reminder): the app files a 'salary' note once per month, like it does for
-- budget and overdue-bill alerts. Safe to re-run; mirrored into schema.sql
-- and policies.sql.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'access_request', 'access_approved', 'access_declined', 'feedback_reply',
  'split_added', 'split_settled', 'budget', 'bill_overdue', 'reminder', 'salary'));

drop policy if exists notifications_insert_own_alerts on public.notifications;
create policy notifications_insert_own_alerts on public.notifications for insert to authenticated
  with check (auth.uid() = owner_user_id and kind in ('budget', 'bill_overdue', 'salary'));
