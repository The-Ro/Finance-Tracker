-- Starter lookup lists. These are configuration/definitions, not financial data --
-- safe to seed even though the empty-start contract forbids seeding transactions,
-- balances, budgets, goals, etc. Run once after schema.sql + policies.sql.

insert into public.categories (name) values
  ('Housing'), ('Groceries'), ('Shopping'), ('Dining'), ('Transportation'),
  ('Utilities'), ('Subscriptions'), ('Insurance'), ('Health'), ('Entertainment'),
  ('Income'), ('Needs review'), ('Other')
on conflict (name) do nothing;

insert into public.accounts (name) values
  ('Main Checking'), ('Everyday Visa'), ('Rewards Card'), ('Cash')
on conflict (name) do nothing;
