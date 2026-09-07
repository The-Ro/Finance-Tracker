-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- Safe to re-run: every statement is idempotent.
-- Adds: category kind (expense/income split) + transactions.payment_method.
-- (Also folded into supabase/schema.sql as the source of truth going forward.)

-- ===== categories.kind =====
alter table public.categories add column if not exists kind text;
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories add constraint categories_kind_check check (kind in ('expense','income') or kind is null);

update public.categories set kind = 'expense' where kind is null and name in (
  'Housing','Utilities','Groceries','Dining','Transportation','Shopping','Health','Insurance',
  'Entertainment','Subscriptions','Education','Travel','Personal care','Gifts & donations','Fees & charges','Other'
);
update public.categories set kind = 'income' where kind is null and name in (
  'Income','Salary','Freelance / business','Interest','Dividends','Rental income','Bonus',
  'Refund / reimbursement','Gift received','Other income'
);

insert into public.categories (owner_user_id, name, kind)
select p.id, c.name, c.kind from public.profiles p cross join (values
  ('Housing','expense'), ('Utilities','expense'), ('Groceries','expense'), ('Dining','expense'),
  ('Transportation','expense'), ('Shopping','expense'), ('Health','expense'), ('Insurance','expense'),
  ('Entertainment','expense'), ('Subscriptions','expense'), ('Education','expense'), ('Travel','expense'),
  ('Personal care','expense'), ('Gifts & donations','expense'), ('Fees & charges','expense'), ('Other','expense'),
  ('Salary','income'), ('Freelance / business','income'), ('Interest','income'), ('Dividends','income'),
  ('Rental income','income'), ('Bonus','income'), ('Refund / reimbursement','income'),
  ('Gift received','income'), ('Other income','income')
) as c(name, kind)
on conflict (owner_user_id, name) do nothing;

-- ===== transactions.payment_method =====
alter table public.transactions add column if not exists payment_method text;
alter table public.transactions drop constraint if exists transactions_payment_method_check;
alter table public.transactions add constraint transactions_payment_method_check check (
  payment_method is null or payment_method in
    ('UPI','Cash','Debit card','Credit card','Net banking','Cheque','NEFT/RTGS/IMPS','Other')
);

-- ===== handle_new_user(): seed both category lists for new signups =====
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.categories (owner_user_id, name, kind) values
    (new.id, 'Housing', 'expense'), (new.id, 'Utilities', 'expense'), (new.id, 'Groceries', 'expense'),
    (new.id, 'Dining', 'expense'), (new.id, 'Transportation', 'expense'), (new.id, 'Shopping', 'expense'),
    (new.id, 'Health', 'expense'), (new.id, 'Insurance', 'expense'), (new.id, 'Entertainment', 'expense'),
    (new.id, 'Subscriptions', 'expense'), (new.id, 'Education', 'expense'), (new.id, 'Travel', 'expense'),
    (new.id, 'Personal care', 'expense'), (new.id, 'Gifts & donations', 'expense'), (new.id, 'Fees & charges', 'expense'),
    (new.id, 'Other', 'expense'),
    (new.id, 'Salary', 'income'), (new.id, 'Freelance / business', 'income'), (new.id, 'Interest', 'income'),
    (new.id, 'Dividends', 'income'), (new.id, 'Rental income', 'income'), (new.id, 'Bonus', 'income'),
    (new.id, 'Refund / reimbursement', 'income'), (new.id, 'Gift received', 'income'), (new.id, 'Other income', 'income'),
    (new.id, 'Needs review', null)
  on conflict (owner_user_id, name) do nothing;

  -- Indian banks/payment banks by default -- deletable per-user like any other account.
  insert into public.accounts (owner_user_id, name)
  select new.id, b.name from (values
    ('Cash'),
    ('State Bank of India'), ('HDFC Bank'), ('ICICI Bank'), ('Axis Bank'), ('Kotak Mahindra Bank'),
    ('Punjab National Bank'), ('Bank of Baroda'), ('Canara Bank'), ('Union Bank of India'),
    ('Indian Bank'), ('Indian Overseas Bank'), ('UCO Bank'), ('Central Bank of India'),
    ('Bank of India'), ('Bank of Maharashtra'), ('Punjab & Sind Bank'), ('IDBI Bank'),
    ('IndusInd Bank'), ('Yes Bank'), ('IDFC First Bank'), ('Federal Bank'), ('South Indian Bank'),
    ('Karnataka Bank'), ('RBL Bank'), ('City Union Bank'), ('DCB Bank'), ('Bandhan Bank'),
    ('CSB Bank'), ('Karur Vysya Bank'), ('Tamilnad Mercantile Bank'), ('AU Small Finance Bank'),
    ('Equitas Small Finance Bank'), ('Ujjivan Small Finance Bank'), ('Jana Small Finance Bank'),
    ('ESAF Small Finance Bank'), ('Paytm Payments Bank'), ('India Post Payments Bank'),
    ('Airtel Payments Bank'), ('Fino Payments Bank'), ('HSBC'), ('Standard Chartered'),
    ('Citibank'), ('Deutsche Bank')
  ) as b(name)
  on conflict (owner_user_id, name) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
