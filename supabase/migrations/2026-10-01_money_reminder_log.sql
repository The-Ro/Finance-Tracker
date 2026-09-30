-- Money to send: optionally log the entry when "Sent" is tapped, with the
-- account, mode and category chosen on the reminder. All four go together:
-- log_entry on needs an account and an amount.
alter table public.money_reminders add column if not exists log_entry boolean not null default false;
alter table public.money_reminders add column if not exists account text;
alter table public.money_reminders add column if not exists payment_method text;
alter table public.money_reminders add column if not exists category text;
alter table public.money_reminders drop constraint if exists money_reminders_log_entry_check;
alter table public.money_reminders add constraint money_reminders_log_entry_check
  check (not log_entry or (account is not null and amount is not null));
