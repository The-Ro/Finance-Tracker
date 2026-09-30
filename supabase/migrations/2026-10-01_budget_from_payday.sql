-- "Start budgets on pay day": budgets count spending from the day the salary
-- arrived (src/lib/budgetPeriod.ts) instead of the 1st of the month.
alter table public.user_settings add column if not exists budget_from_payday boolean not null default false;
