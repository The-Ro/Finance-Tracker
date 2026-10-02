-- SIP history: when an investment started, so payments made before the app
-- are counted (every due date from started_on up to next_date counts as paid,
-- like loanProgress counts EMIs), and the due dates the user marked missed.
alter table public.recurring_items add column if not exists started_on date;
alter table public.recurring_items add column if not exists missed_dates date[] not null default '{}';
alter table public.recurring_items drop constraint if exists recurring_items_started_on_check;
alter table public.recurring_items add constraint recurring_items_started_on_check
  check (started_on is null or (is_investment and started_on <= next_date));
