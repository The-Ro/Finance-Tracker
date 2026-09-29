-- "Wallet" payment mode (Paytm, Amazon Pay balance, ...): Add entry shows only
-- wallet accounts for it. Safe to re-run; mirrored into schema.sql.
alter table public.transactions drop constraint if exists transactions_payment_method_check;
alter table public.transactions add constraint transactions_payment_method_check check (
  payment_method is null or payment_method in
    ('UPI','Cash','Debit card','Credit card','Wallet','Net banking','Cheque','NEFT/RTGS/IMPS','Other')
);
