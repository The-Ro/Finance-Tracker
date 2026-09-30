-- "Count my salary toward the next month" (Settings -> Salary): a salary that
-- lands in a month's last 7 days counts in the next month's summaries (Home,
-- Money kept each month, Monthly review). Entries keep their real date.
alter table public.user_settings add column if not exists salary_next_month boolean not null default false;
