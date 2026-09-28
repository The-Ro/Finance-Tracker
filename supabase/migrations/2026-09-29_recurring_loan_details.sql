-- Loan / EMI details on a recurring payment: amount borrowed, tenure and the
-- month of the first EMI. All three or none (explicit IS NOT NULLs -- a CHECK
-- passes when its expression is NULL). The app derives "EMIs paid" from these
-- plus next_date (src/lib/loans.ts); nothing else reads them.
-- Additive and safe to re-run; mirrored into schema.sql. No policy changes:
-- recurring_items' own-row policies already cover every column.

alter table public.recurring_items
  add column if not exists loan_amount numeric(14, 2),
  add column if not exists loan_tenure_months smallint,
  add column if not exists loan_start_date date;

alter table public.recurring_items drop constraint if exists recurring_items_loan_details_check;
alter table public.recurring_items add constraint recurring_items_loan_details_check check (
  (loan_amount is null and loan_tenure_months is null and loan_start_date is null)
  or (
    loan_amount is not null and loan_amount > 0
    and loan_tenure_months is not null and loan_tenure_months between 1 and 600
    and loan_start_date is not null
  )
);

-- Annual interest rate (%), optional even on a loan: it only feeds the EMI
-- suggestion and the row's label. 0-100 or null.
alter table public.recurring_items add column if not exists loan_interest_rate numeric(5, 2);
alter table public.recurring_items drop constraint if exists recurring_items_loan_interest_rate_check;
alter table public.recurring_items add constraint recurring_items_loan_interest_rate_check
  check (loan_interest_rate is null or (loan_interest_rate >= 0 and loan_interest_rate <= 100 and loan_amount is not null));
