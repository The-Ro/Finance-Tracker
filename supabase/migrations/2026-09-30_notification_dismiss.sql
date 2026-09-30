-- Clear (x) on a notification hides it instead of deleting it. The row stays
-- so its unique `ref` keeps the app from filing the same budget / overdue /
-- pay-day alert again on the next load. Safe to re-run; mirrored into
-- schema.sql and policies.sql.
alter table public.notifications add column if not exists dismissed_at timestamptz;
grant update (read_at, dismissed_at) on public.notifications to authenticated;
