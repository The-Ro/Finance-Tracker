-- LedgeEaze schema.
-- Apply this in the Supabase SQL editor (or via `supabase db push`) before policies.sql.
-- Safe to re-run: every statement is idempotent.

create extension if not exists "pgcrypto";

-- ===== profiles =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  avatar text,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists avatar text;

-- Auto-create a profile row whenever a new auth user is created.
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

  -- Indian banks/payment banks by default (replaces the earlier generic
  -- placeholder accounts) -- deletable per-user like any other account.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keeps profiles.email in sync once a user confirms an email change (Supabase
-- only updates auth.users.email after the confirmation link is clicked).
create or replace function public.handle_user_email_update()
returns trigger as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute procedure public.handle_user_email_update();

-- ===== per-user lookup lists (categories/accounts/tags; additive-only in v1) =====
-- Personal to each user -- not shared with anyone else, even though transactions are.
create table if not exists public.categories (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, name)
);

-- Split expense vs. income category lists (added after initial launch). `kind`
-- is left null for shared/legacy categories ('Needs review', plus anything
-- from before this column existed that doesn't match a known name) so they
-- keep showing in *both* pickers rather than silently disappearing from one --
-- names stay globally unique per user either way, so the existing composite
-- FK from transactions/budgets/recurring_items doesn't need to change at all.
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

-- Backfill the newly-finalized category names for every existing user
-- (additive -- on conflict do nothing, so nobody's existing custom
-- categories or already-classified rows above are touched).
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

create table if not exists public.accounts (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, name)
);

create table if not exists public.tags (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, name)
);

-- Migrate an existing install from the old global (name-only) shape to the
-- per-user shape above: give every existing user their own copy of what used
-- to be shared, then drop the old ownerless rows.
alter table public.categories add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;
alter table public.accounts add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;
alter table public.tags add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'categories_pkey') then
    alter table public.categories drop constraint categories_pkey cascade;
  end if;
  if exists (select 1 from pg_constraint where conname = 'accounts_pkey') then
    alter table public.accounts drop constraint accounts_pkey cascade;
  end if;
  if exists (select 1 from pg_constraint where conname = 'tags_pkey') then
    alter table public.tags drop constraint tags_pkey cascade;
  end if;
end $$;

insert into public.categories (owner_user_id, name, created_by, created_at)
  select p.id, c.name, c.created_by, c.created_at from public.profiles p cross join public.categories c
  where c.owner_user_id is null;
delete from public.categories where owner_user_id is null;

insert into public.accounts (owner_user_id, name, created_by, created_at)
  select p.id, a.name, a.created_by, a.created_at from public.profiles p cross join public.accounts a
  where a.owner_user_id is null;
delete from public.accounts where owner_user_id is null;

insert into public.tags (owner_user_id, name, created_by, created_at)
  select p.id, t.name, t.created_by, t.created_at from public.profiles p cross join public.tags t
  where t.owner_user_id is null;
delete from public.tags where owner_user_id is null;

alter table public.categories alter column owner_user_id set not null;
alter table public.accounts alter column owner_user_id set not null;
alter table public.tags alter column owner_user_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_pkey') then
    alter table public.categories add primary key (owner_user_id, name);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'accounts_pkey') then
    alter table public.accounts add primary key (owner_user_id, name);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tags_pkey') then
    alter table public.tags add primary key (owner_user_id, name);
  end if;
end $$;

-- ===== transactions (shared read, owner-only write) =====
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  merchant text not null,
  category text not null default 'Needs review',
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('expense','income')),
  account text not null,
  to_account text,
  remarks text,
  tags text[] not null default '{}',
  receipt boolean not null default false,
  receipt_document_id uuid,
  source text not null default 'manual' check (source in ('manual','csv')),
  fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, fingerprint)
);
create index if not exists transactions_owner_date_idx on public.transactions (owner_user_id, date desc);
create index if not exists transactions_date_idx on public.transactions (date desc);

-- Self-transfers between two of the owner's own accounts (added after initial launch).
alter table public.transactions add column if not exists to_account text;
alter table public.transactions add column if not exists remarks text;
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (type in ('expense','income','transfer'));
alter table public.transactions drop constraint if exists transactions_to_account_owner_fkey;
alter table public.transactions add constraint transactions_to_account_owner_fkey
  foreign key (owner_user_id, to_account) references public.accounts (owner_user_id, name);

-- Transfers were being force-categorized as 'Needs review', a category row
-- that isn't guaranteed to exist for every user -- it's a normal per-user
-- category row, not a protected sentinel, so any account missing it got a
-- category FK violation on every transfer attempt. A transfer isn't
-- spending/income in the first place, so it doesn't need a category at all.
alter table public.transactions alter column category drop not null;
alter table public.transactions drop constraint if exists transactions_category_required_unless_transfer;
alter table public.transactions add constraint transactions_category_required_unless_transfer
  check (category is not null or type = 'transfer');

-- How the transaction was made (UPI/Cash/Card/etc.) -- a fixed small set, not
-- a personal per-user list like categories/accounts, so a plain check
-- constraint instead of its own owned lookup table. Optional/descriptive
-- only -- never read by any aggregate or chart.
alter table public.transactions add column if not exists payment_method text;
alter table public.transactions drop constraint if exists transactions_payment_method_check;
alter table public.transactions add constraint transactions_payment_method_check check (
  payment_method is null or payment_method in
    ('UPI','Cash','Debit card','Credit card','Net banking','Cheque','NEFT/RTGS/IMPS','Other')
);

-- A transfer's source and destination account can't be the same account --
-- the client already prevents this in the Add Entry form, but a DB-level
-- guard makes it impossible via any other write path (API, RPC, a future bug).
alter table public.transactions drop constraint if exists transactions_transfer_distinct_accounts;
alter table public.transactions add constraint transactions_transfer_distinct_accounts
  check (type <> 'transfer' or account <> to_account);

-- ===== budgets (own-only) =====
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_user_id, category)
);

-- ===== goals (own-only) =====
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  due_date date,
  note text,
  created_at timestamptz not null default now()
);

-- ===== recurring items + subscriptions (own-only) =====
create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('recurring','subscription')),
  name text not null,
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  cadence text not null check (cadence in ('weekly','biweekly','monthly','quarterly','half-yearly','annual')),
  next_date date not null,
  account text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.recurring_items drop constraint if exists recurring_items_cadence_check;
alter table public.recurring_items add constraint recurring_items_cadence_check check (
  cadence in ('weekly','biweekly','monthly','quarterly','half-yearly','annual')
);

-- Composite FKs (owner_user_id, name) so a transaction/budget/recurring item's category
-- and account must belong to that same owner's personal lookup lists.
alter table public.transactions drop constraint if exists transactions_category_fkey;
alter table public.transactions drop constraint if exists transactions_category_owner_fkey;
alter table public.transactions add constraint transactions_category_owner_fkey
  foreign key (owner_user_id, category) references public.categories (owner_user_id, name);

alter table public.transactions drop constraint if exists transactions_account_fkey;
alter table public.transactions drop constraint if exists transactions_account_owner_fkey;
alter table public.transactions add constraint transactions_account_owner_fkey
  foreign key (owner_user_id, account) references public.accounts (owner_user_id, name);

alter table public.budgets drop constraint if exists budgets_category_fkey;
alter table public.budgets drop constraint if exists budgets_category_owner_fkey;
alter table public.budgets add constraint budgets_category_owner_fkey
  foreign key (owner_user_id, category) references public.categories (owner_user_id, name);

alter table public.recurring_items drop constraint if exists recurring_items_category_fkey;
alter table public.recurring_items drop constraint if exists recurring_items_category_owner_fkey;
alter table public.recurring_items add constraint recurring_items_category_owner_fkey
  foreign key (owner_user_id, category) references public.categories (owner_user_id, name);

alter table public.recurring_items drop constraint if exists recurring_items_account_fkey;
alter table public.recurring_items drop constraint if exists recurring_items_account_owner_fkey;
alter table public.recurring_items add constraint recurring_items_account_owner_fkey
  foreign key (owner_user_id, account) references public.accounts (owner_user_id, name);

create table if not exists public.dismissed_patterns (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pattern_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, pattern_key)
);

-- ===== documents (own-only; original bytes live in Supabase Storage) =====
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size integer not null check (size > 0 and size <= 20 * 1024 * 1024),
  storage_path text not null unique,
  status text not null default 'stored' check (status in ('stored','review')),
  source text not null default 'upload' check (source = 'upload'),
  created_at timestamptz not null default now()
);

alter table public.transactions
  drop constraint if exists transactions_receipt_document_id_fkey;
alter table public.transactions
  add constraint transactions_receipt_document_id_fkey
  foreign key (receipt_document_id) references public.documents(id) on delete set null;

-- ===== categorization rules (own-only) =====
create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  when_text text not null,
  then_text text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===== feedback (own-only: insert + read your own submissions) =====
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(trim(message)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists feedback_owner_idx on public.feedback (owner_user_id, created_at desc);

-- Admin (by email, see policies.sql) can reply to a submission; the
-- submitter sees it as a notification until reply_seen_at is set (via the
-- mark_feedback_reply_seen() RPC below, not a direct update -- see
-- policies.sql for why).
alter table public.feedback add column if not exists admin_reply text;
alter table public.feedback add column if not exists replied_at timestamptz;
alter table public.feedback add column if not exists reply_seen_at timestamptz;
-- Lets the admin clear a handled item out of their own inbox view without
-- affecting the submitter's copy at all -- covered by the existing
-- feedback_update_admin_reply policy (admin can already update any row).
alter table public.feedback add column if not exists admin_dismissed_at timestamptz;

create or replace function public.mark_feedback_reply_seen(feedback_id uuid)
returns void as $$
begin
  update public.feedback
  set reply_seen_at = now()
  where id = feedback_id and owner_user_id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.mark_feedback_reply_seen(uuid) from public;
grant execute on function public.mark_feedback_reply_seen(uuid) to authenticated;

-- ===== client_errors (write-only crash reporting) =====
-- owner_user_id is nullable -- a crash can happen before sign-in (e.g. on
-- the Login page itself). Diagnostic data for whoever runs the project, not
-- a user-facing feature -- see policies.sql, there's no select policy.
create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  message text not null,
  stack text,
  url text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);

-- ===== viewer access: private-by-default sharing of transactions =====
-- A row is both the request AND, once approved, the standing grant. The
-- requester wants to see the owner's transactions; only the owner can flip
-- status to 'approved'. Deleting a row cancels a pending request, declines
-- one, or revokes previously-approved access -- all the same action.
create table if not exists public.viewer_access (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_user_id, owner_user_id),
  check (requester_user_id <> owner_user_id)
);
create index if not exists viewer_access_owner_idx on public.viewer_access (owner_user_id, status);
create index if not exists viewer_access_requester_idx on public.viewer_access (requester_user_id, status);

-- 'paused' lets an owner temporarily hide their transactions from someone
-- without revoking (deleting) the grant outright -- behaves like 'approved'
-- everywhere except transactions_select_own_or_approved (policies.sql),
-- which only grants visibility for 'approved'.
alter table public.viewer_access drop constraint if exists viewer_access_status_check;
alter table public.viewer_access add constraint viewer_access_status_check
  check (status in ('pending','approved','paused'));

-- ===== per-user settings (own-only) =====
create table if not exists public.user_settings (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  assets_total numeric(14,2) not null default 0,
  liabilities_total numeric(14,2) not null default 0,
  net_worth_configured boolean not null default false,
  selected_period text not null default 'all-time' check (
    selected_period in ('all-time','this-month','last-month','last-3-months','last-6-months','this-year')
  ),
  currency text not null default 'USD',
  theme_mode text not null default 'system' check (theme_mode in ('light','dark','system')),
  theme_accent text not null default 'violet' check (theme_accent in ('violet','ocean','sunset','pink','green','sage','mauve','plum','crimson','charcoal','custom')),
  theme_custom_color text check (theme_custom_color is null or theme_custom_color ~ '^#[0-9A-Fa-f]{6}$'),
  gender text check (gender in ('male','female','prefer_not_to_say')),
  date_of_birth date,
  onboarding_completed boolean not null default false,
  interests text[] not null default '{}',
  zodiac_sign text,
  whats_new_seen_version text,
  dashboard_order text[] not null default array['summary','cashflow','categoryChart','accountChart','activity','review'],
  dashboard_hidden text[] not null default '{}',
  summary_card_order text[] not null default array['netWorth','income','spending','savingsRate'],
  updated_at timestamptz not null default now()
);
alter table public.user_settings add column if not exists currency text not null default 'USD';
alter table public.user_settings add column if not exists theme_mode text not null default 'system';
alter table public.user_settings add column if not exists theme_accent text not null default 'violet';
alter table public.user_settings add column if not exists gender text;
alter table public.user_settings add column if not exists date_of_birth date;
alter table public.user_settings add column if not exists onboarding_completed boolean not null default false;
alter table public.user_settings add column if not exists interests text[] not null default '{}';
alter table public.user_settings add column if not exists zodiac_sign text;
alter table public.user_settings add column if not exists whats_new_seen_version text;
alter table public.user_settings add column if not exists dashboard_order text[]
  not null default array['summary','cashflow','categoryChart','accountChart','activity','review'];
alter table public.user_settings add column if not exists dashboard_hidden text[] not null default '{}';
-- Dashboard section ids changed twice after initial launch: 'spending' was
-- split out of 'summary' then folded back in, and 'breakdown' split into
-- 'categoryChart'/'accountChart'. Keep the column default current for any
-- fresh install running this file from scratch.
alter table public.user_settings alter column dashboard_order
  set default array['summary','cashflow','categoryChart','accountChart','activity','review'];
alter table public.user_settings add column if not exists theme_custom_color text;
alter table public.user_settings add column if not exists summary_card_order text[]
  not null default array['netWorth','income','spending','savingsRate'];
alter table public.user_settings drop constraint if exists user_settings_theme_custom_color_check;
alter table public.user_settings add constraint user_settings_theme_custom_color_check check (
  theme_custom_color is null or theme_custom_color ~ '^#[0-9A-Fa-f]{6}$'
);
alter table public.user_settings drop constraint if exists user_settings_zodiac_sign_check;
alter table public.user_settings add constraint user_settings_zodiac_sign_check check (zodiac_sign in (
  'aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'
));
alter table public.user_settings drop constraint if exists user_settings_theme_mode_check;
alter table public.user_settings add constraint user_settings_theme_mode_check check (theme_mode in ('light','dark','system'));
alter table public.user_settings drop constraint if exists user_settings_theme_accent_check;
alter table public.user_settings add constraint user_settings_theme_accent_check check (theme_accent in ('violet','ocean','sunset','pink','green','sage','mauve','plum','crimson','charcoal','custom'));
alter table public.user_settings drop constraint if exists user_settings_gender_check;
alter table public.user_settings add constraint user_settings_gender_check check (gender in ('male','female','prefer_not_to_say'));

-- ===== self-service account deletion =====
-- security definer so it can delete the auth.users row directly; every table's
-- owner_user_id FK is "on delete cascade", so this wipes all of that user's data too.
create or replace function public.delete_own_account()
returns void as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.delete_own_account() to authenticated;

-- Postgres grants EXECUTE to PUBLIC by default on function creation, which
-- left every SECURITY DEFINER function above publicly callable as a
-- /rest/v1/rpc/* endpoint -- including the two auth triggers and the RLS
-- auto-enable event trigger, none of which are meant to be invoked directly
-- (calling them outside their trigger/event-trigger context just errors).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_user_email_update() from public;
-- rls_auto_enable() is created by Supabase's "auto-enable RLS" project
-- setting, not by this file -- skip it on a project that doesn't have it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public;
  end if;
end $$;
revoke execute on function public.delete_own_account() from public;

-- 'accountBalances' (a live per-account balance list, derived from
-- transaction history) briefly existed as its own top-level dashboard
-- section, then moved into the "summary" section's nested card list
-- instead -- same "small at-a-glance stat" family as net worth/income/
-- spending/savings rate. Keep the column defaults current for any fresh
-- install running this file from scratch.
alter table public.user_settings alter column dashboard_order
  set default array['summary','cashflow','categoryChart','accountChart','activity','review'];

-- Individually hideable summary cards, mirroring dashboard_hidden but for
-- the cards nested inside the "summary" section rather than top-level
-- sections.
alter table public.user_settings add column if not exists summary_card_hidden text[] not null default '{}';

alter table public.user_settings alter column summary_card_order
  set default array['netWorth','income','spending','savingsRate','accountBalances'];

-- Reverted: accountBalances moved back out to its own top-level section --
-- kept separate from the 4 core summary cards after all.
alter table public.user_settings alter column dashboard_order
  set default array['summary','cashflow','categoryChart','accountChart','accountBalances','activity','review'];
alter table public.user_settings alter column summary_card_order
  set default array['netWorth','income','spending','savingsRate'];

-- These three constraints were live without an ON DELETE clause (defaults
-- to RESTRICT) despite the CREATE TABLE statements above already declaring
-- "on delete set null" -- a drift between what this file describes and what
-- actually existed in the database, probably from before these tables were
-- reshaped into their current owner_user_id/created_by split. In practice
-- this meant delete_own_account() failed for any account that had ever
-- added its own custom account/category/tag: every other owner_user_id
-- cascade on that row would succeed, then this one FK would reject the
-- whole `delete from auth.users`, rolling everything back -- read by the
-- user simply as "delete my account doesn't work".
alter table public.categories drop constraint if exists categories_created_by_fkey;
alter table public.categories add constraint categories_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.accounts drop constraint if exists accounts_created_by_fkey;
alter table public.accounts add constraint accounts_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.tags drop constraint if exists tags_created_by_fkey;
alter table public.tags add constraint tags_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- Atomically record a recurring/subscription payment and advance its next
-- due date. Keeping both writes in the database transaction prevents the
-- old client-side two-step workflow from recording an expense without moving
-- the schedule forward if the connection fails between requests.
create or replace function public.mark_recurring_item_paid(recurring_item_id uuid, paid_on date)
returns void as $$
declare
  item public.recurring_items%rowtype;
  next_due_date date;
  payment_fingerprint text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into item
  from public.recurring_items
  where id = recurring_item_id and owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Recurring item not found' using errcode = 'P0002';
  end if;
  if not item.active then
    raise exception 'Recurring item is inactive' using errcode = 'P0001';
  end if;
  if item.account is null then
    raise exception 'Add an account before marking this item paid' using errcode = 'P0001';
  end if;
  if paid_on is null then
    raise exception 'Payment date is required' using errcode = '22004';
  end if;

  next_due_date := case item.cadence
    when 'weekly' then paid_on + 7
    when 'biweekly' then paid_on + 14
    when 'monthly' then (paid_on + interval '1 month')::date
    when 'quarterly' then (paid_on + interval '3 months')::date
    when 'half-yearly' then (paid_on + interval '6 months')::date
    when 'annual' then (paid_on + interval '1 year')::date
  end;

  -- Must remain identical to buildFingerprint() in src/lib/fingerprint.ts.
  payment_fingerprint := concat_ws(
    '|',
    paid_on::text,
    lower(trim(item.name)),
    to_char(item.amount, 'FM9999999990.00'),
    lower(trim(item.account))
  );

  insert into public.transactions (
    owner_user_id, date, merchant, category, amount, type, account,
    to_account, remarks, payment_method, tags, receipt, receipt_document_id,
    source, fingerprint
  ) values (
    auth.uid(), paid_on, item.name, item.category, item.amount, 'expense', item.account,
    null, null, null, '{}', false, null, 'manual', payment_fingerprint
  );

  update public.recurring_items
  set next_date = next_due_date
  where id = item.id;
end;
$$ language plpgsql security definer set search_path = '';

revoke execute on function public.mark_recurring_item_paid(uuid, date) from public;
revoke execute on function public.mark_recurring_item_paid(uuid, date) from anon;
grant execute on function public.mark_recurring_item_paid(uuid, date) to authenticated;

-- Brand refresh: 'oxblood' becomes the new default accent preset (the
-- CREATE TABLE above still says 'violet' -- append-only, so the current
-- default lives here instead). Existing rows are untouched; this only
-- changes what a session with no saved preference falls back to.
alter table public.user_settings alter column theme_accent set default 'oxblood';

alter table public.user_settings drop constraint if exists user_settings_theme_accent_check;
alter table public.user_settings add constraint user_settings_theme_accent_check
  check (theme_accent in ('violet','ocean','sunset','pink','green','sage','mauve','plum','crimson','charcoal','oxblood','custom'));

-- Exact (case-insensitive) email lookup, used by Settings -> Sharing now that
-- profiles are no longer readable as a directory (see profiles_select_own_or_connected
-- in policies.sql). Exact match only, so it can't be used to enumerate users.
create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, display_name text, email text, avatar text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.email, p.avatar
  from public.profiles p
  where auth.uid() is not null
    and lower(p.email) = lower(trim(p_email))
    and p.id <> auth.uid()
  limit 1;
$$;
revoke execute on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;

-- Supabase grants EXECUTE on new public functions to anon/authenticated
-- explicitly, so "revoke ... from public" alone never removed those grants.
-- Real RPC endpoints: signed-in users only.
revoke execute on function public.delete_own_account() from public, anon;
revoke execute on function public.mark_feedback_reply_seen(uuid) from public, anon;
-- Trigger / event-trigger functions are never RPCs; Postgres only checks
-- EXECUTE on a trigger function at CREATE TRIGGER time, not when it fires.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_update() from public, anon, authenticated;
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- Per-account starting balance, added to the transaction-derived balance
-- (calculateAccountBalances). accounts deliberately has no UPDATE policy --
-- a broad one would allow renames that orphan transactions' account
-- references -- so this narrow RPC is the only way to change it.
alter table public.accounts add column if not exists opening_balance numeric(12,2) not null default 0;

create or replace function public.set_account_opening_balance(p_account text, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_amount is null or abs(p_amount) >= 10000000000 then
    raise exception 'Invalid amount';
  end if;
  update public.accounts
     set opening_balance = round(p_amount, 2)
   where owner_user_id = auth.uid() and name = p_account;
  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;
revoke execute on function public.set_account_opening_balance(text, numeric) from public, anon;
grant execute on function public.set_account_opening_balance(text, numeric) to authenticated;

-- ===== admin_users (admin as a role, replacing the hardcoded email) =====
-- RLS on with no policies and no grants: not readable or writable through the
-- API at all. Grant/revoke admin from the SQL editor only:
--   insert into public.admin_users (user_id) select id from auth.users where email = '...';
--   delete from public.admin_users where user_id = (select id from auth.users where email = '...');
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

-- Bootstrap the first admin once, by hand, with the insert snippet above --
-- not on every run of this file (that re-granted admin after a revoke, and
-- would grant it to whoever registered that email).

-- Used by RLS policies (policies.sql) and the client (useIsAdmin). SECURITY
-- DEFINER so it can read admin_users, which also avoids recursive RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Multi-currency entry. `amount` stays in the owner's home currency, so every
-- sum/budget/balance is unchanged; a foreign-currency entry also records what
-- was actually paid and the rate used, fixed at entry time (no background
-- re-conversion -- there's no cron). All three set, or all three null: the
-- explicit IS NOT NULLs matter, because a CHECK treats NULL as passing and
-- the first version of this constraint accepted a currency with no amount.
alter table public.transactions add column if not exists original_currency text;
alter table public.transactions add column if not exists original_amount numeric(14,2);
alter table public.transactions add column if not exists fx_rate numeric(18,8);
alter table public.transactions drop constraint if exists transactions_original_currency_check;
alter table public.transactions add constraint transactions_original_currency_check check (
  (original_currency is null and original_amount is null and fx_rate is null)
  or (
    original_currency is not null and original_amount is not null and fx_rate is not null
    and original_currency ~ '^[A-Z]{3}$'
    and original_amount > 0
    and fx_rate > 0
  )
);

-- A transfer must also have a destination: the earlier distinct-accounts check
-- passed for a NULL to_account (a CHECK treats NULL as passing).
alter table public.transactions drop constraint if exists transactions_transfer_distinct_accounts;
alter table public.transactions add constraint transactions_transfer_distinct_accounts
  check (type <> 'transfer' or (to_account is not null and account <> to_account));

-- Budget rollover (opt-in): carry last month's unspent amount into this month.
alter table public.budgets add column if not exists rollover boolean not null default false;

-- Split and settle up: the payer (owner of an expense) records a share owed by
-- a connected person. description/date are copied from the transaction so the
-- other person has context even when they can't read the payer's transactions.
create table if not exists public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  with_user_id uuid not null references auth.users(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 120),
  date date not null,
  amount numeric(12,2) not null check (amount > 0),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (transaction_id, with_user_id),
  check (owner_user_id <> with_user_id)
);
create index if not exists transaction_splits_with_user_idx on public.transaction_splits (with_user_id);
create index if not exists transaction_splits_owner_idx on public.transaction_splits (owner_user_id);

-- Account types and credit-card details. A credit card's balance is money
-- owed (negative); its bill = what was owed on the last statement day minus
-- payments into it since. Debit cards are not accounts (payment_method on the
-- bank account). Card-only fields must be null for other kinds.
alter table public.accounts
  add column if not exists kind text not null default 'bank',
  add column if not exists credit_limit numeric(12,2),
  add column if not exists statement_day smallint,
  add column if not exists due_day smallint;
alter table public.accounts
  drop constraint if exists accounts_kind_check,
  drop constraint if exists accounts_credit_limit_check,
  drop constraint if exists accounts_statement_day_check,
  drop constraint if exists accounts_due_day_check,
  drop constraint if exists accounts_card_fields_only_on_cards;
-- Also admits the later kinds, so re-running this file over a database that
-- already has savings/current rows passes; the account-types block at the end
-- of the file narrows it to the current set.
alter table public.accounts
  add constraint accounts_kind_check check (kind in ('bank', 'savings', 'current', 'credit_card', 'cash', 'wallet')),
  add constraint accounts_credit_limit_check check (credit_limit is null or credit_limit > 0),
  add constraint accounts_statement_day_check check (statement_day is null or statement_day between 1 and 31),
  add constraint accounts_due_day_check check (due_day is null or due_day between 1 and 31),
  add constraint accounts_card_fields_only_on_cards check (
    kind = 'credit_card' or (credit_limit is null and statement_day is null and due_day is null)
  );

-- Narrow setter: accounts has no UPDATE policy on purpose (renames would orphan transactions).
create or replace function public.set_account_details(
  p_account text, p_kind text, p_credit_limit numeric, p_statement_day int, p_due_day int
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.accounts
     set kind = p_kind,
         credit_limit = case when p_kind = 'credit_card' then p_credit_limit end,
         statement_day = case when p_kind = 'credit_card' then p_statement_day end,
         due_day = case when p_kind = 'credit_card' then p_due_day end
   where owner_user_id = auth.uid() and name = p_account;
  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;
revoke execute on function public.set_account_details(text, text, numeric, int, int) from public, anon;
grant execute on function public.set_account_details(text, text, numeric, int, int) to authenticated;

-- Closed accounts keep their history but leave pickers, totals and bills.
alter table public.accounts add column if not exists closed_at date;
create or replace function public.set_account_closed(p_account text, p_closed boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.accounts
     set closed_at = case when p_closed then coalesce(closed_at, current_date) end
   where owner_user_id = auth.uid() and name = p_account;
  if not found then
    raise exception 'Account not found';
  end if;
end;
$$;
revoke execute on function public.set_account_closed(text, boolean) from public, anon;
grant execute on function public.set_account_closed(text, boolean) to authenticated;

-- ===== 2026-09-27 security bug sweep (migrations/2026-09-27_security_bug_sweep.sql) =====

-- documents_select_shared (policies.sql) looks receipts up by this.
create index if not exists transactions_receipt_document_idx
  on public.transactions (receipt_document_id) where receipt_document_id is not null;

-- profiles.email is no longer user-editable (column grants in policies.sql);
-- it mirrors auth.users.email. Undo any edits made while it was writable.
update public.profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- Match on auth.users.email (the verified address), oldest account first, so
-- the lookup is deterministic and can't be steered by a profile edit.
create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, display_name text, email text, avatar text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, u.email::text, p.avatar
  from auth.users u
  join public.profiles p on p.id = u.id
  where auth.uid() is not null
    and lower(u.email) = lower(trim(p_email))
    and u.id <> auth.uid()
  order by u.created_at, u.id
  limit 1;
$$;
revoke execute on function public.find_profile_by_email(text) from public, anon;
grant execute on function public.find_profile_by_email(text) to authenticated;

-- The only way to create an access request: it takes the person's exact
-- email, so a request (and the profile visibility a request grants) can't be
-- aimed at a bare user id. viewer_access has no insert policy or grant.
create or replace function public.request_viewer_access(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select u.id into target
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email)) and u.id <> auth.uid()
  order by u.created_at, u.id
  limit 1;
  if target is null then
    raise exception 'No LedgeEaze account with that exact email.' using errcode = 'P0002';
  end if;
  insert into public.viewer_access (requester_user_id, owner_user_id, status)
  values (auth.uid(), target, 'pending');
end;
$$;
revoke execute on function public.request_viewer_access(text) from public, anon;
grant execute on function public.request_viewer_access(text) to authenticated;

-- All splits on an expense together can't exceed it. The parent row lock
-- serialises concurrent inserts on the same expense.
create or replace function public.transaction_splits_cap_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expense_amount numeric;
  already_split numeric;
begin
  select t.amount into expense_amount
  from public.transactions t
  where t.id = new.transaction_id
  for update;
  select coalesce(sum(s.amount), 0) into already_split
  from public.transaction_splits s
  where s.transaction_id = new.transaction_id and s.id <> new.id;
  if expense_amount is not null and already_split + new.amount > expense_amount then
    raise exception 'Splits can''t add up to more than the expense' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists transaction_splits_cap_total on public.transaction_splits;
create trigger transaction_splits_cap_total
  before insert or update of amount, transaction_id on public.transaction_splits
  for each row execute function public.transaction_splits_cap_total();
revoke execute on function public.transaction_splits_cap_total() from public, anon, authenticated;

-- Day of month a monthly/quarterly/half-yearly/annual item is due on, so a
-- 31st bill clamped to Feb 28 goes back to Mar 31 instead of drifting.
alter table public.recurring_items add column if not exists anchor_day smallint;
alter table public.recurring_items drop constraint if exists recurring_items_anchor_day_check;
alter table public.recurring_items add constraint recurring_items_anchor_day_check
  check (anchor_day is null or anchor_day between 1 and 31);
update public.recurring_items set anchor_day = extract(day from next_date) where anchor_day is null;

-- A next_date that agrees with the anchor (e.g. Feb 28 for a 31st bill) keeps
-- it; any other date change is a user edit and becomes the new anchor.
create or replace function public.recurring_items_keep_anchor_day()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  month_days int := extract(day from (date_trunc('month', new.next_date::timestamp) + interval '1 month - 1 day'))::int;
begin
  if tg_op = 'INSERT' then
    new.anchor_day := coalesce(new.anchor_day, extract(day from new.next_date)::int);
  elsif new.next_date is distinct from old.next_date
    and new.anchor_day is not distinct from old.anchor_day
    and (old.anchor_day is null
         or extract(day from new.next_date)::int <> least(old.anchor_day, month_days)) then
    new.anchor_day := extract(day from new.next_date)::int;
  end if;
  return new;
end;
$$;
drop trigger if exists recurring_items_keep_anchor_day on public.recurring_items;
create trigger recurring_items_keep_anchor_day
  before insert or update of next_date, anchor_day on public.recurring_items
  for each row execute function public.recurring_items_keep_anchor_day();
revoke execute on function public.recurring_items_keep_anchor_day() from public, anon, authenticated;

-- Supersedes the definition above: one payment covers one period, so step
-- from the due date (not the payment date) and keep the anchor day.
create or replace function public.mark_recurring_item_paid(recurring_item_id uuid, paid_on date)
returns void as $$
declare
  item public.recurring_items%rowtype;
  next_due_date date;
  payment_fingerprint text;
  anchor int;
  step_months int;
  month_start date;
  month_days int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into item
  from public.recurring_items
  where id = recurring_item_id and owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Recurring item not found' using errcode = 'P0002';
  end if;
  if not item.active then
    raise exception 'Recurring item is inactive' using errcode = 'P0001';
  end if;
  if item.account is null then
    raise exception 'Add an account before marking this item paid' using errcode = 'P0001';
  end if;
  if paid_on is null then
    raise exception 'Payment date is required' using errcode = '22004';
  end if;

  if item.cadence in ('weekly', 'biweekly') then
    next_due_date := item.next_date + case item.cadence when 'weekly' then 7 else 14 end;
  else
    anchor := coalesce(item.anchor_day, extract(day from item.next_date)::int);
    step_months := case item.cadence
      when 'monthly' then 1
      when 'quarterly' then 3
      when 'half-yearly' then 6
      when 'annual' then 12
    end;
    month_start := (date_trunc('month', item.next_date::timestamp) + make_interval(months => step_months))::date;
    month_days := extract(day from (month_start + interval '1 month - 1 day'))::int;
    next_due_date := month_start + (least(anchor, month_days) - 1);
  end if;

  -- Must remain identical to buildFingerprint() in src/lib/fingerprint.ts.
  payment_fingerprint := concat_ws(
    '|',
    paid_on::text,
    lower(trim(item.name)),
    to_char(item.amount, 'FM9999999990.00'),
    lower(trim(item.account))
  );

  insert into public.transactions (
    owner_user_id, date, merchant, category, amount, type, account,
    to_account, remarks, payment_method, tags, receipt, receipt_document_id,
    source, fingerprint
  ) values (
    auth.uid(), paid_on, item.name, item.category, item.amount, 'expense', item.account,
    null, null, null, '{}', false, null, 'manual', payment_fingerprint
  );

  update public.recurring_items
  set next_date = next_due_date
  where id = item.id;
end;
$$ language plpgsql security definer set search_path = '';

revoke execute on function public.mark_recurring_item_paid(uuid, date) from public, anon;
grant execute on function public.mark_recurring_item_paid(uuid, date) to authenticated;

-- client_errors is writable by anyone (including signed-out visitors); cap
-- what one row can hold. NOT VALID: existing rows aren't re-checked.
alter table public.client_errors drop constraint if exists client_errors_size_check;
alter table public.client_errors add constraint client_errors_size_check check (
  char_length(message) <= 5000
  and (stack is null or char_length(stack) <= 50000)
  and (url is null or char_length(url) <= 4096)
  and (user_agent is null or char_length(user_agent) <= 1024)
) not valid;

-- ===== 2026-09-27 account types and debit cards (migrations/2026-09-27_account_types_debit_cards.sql) =====

-- Already live (closed accounts); repeated so this block also runs on a
-- database that doesn't have it yet.
alter table public.accounts add column if not exists closed_at date;

-- Same behaviour as before, now with an explicit sign-in check and an empty
-- search_path like every other SECURITY DEFINER function here. Cash is always
-- kept: the last open cash account can't be closed.
create or replace function public.set_account_closed(p_account text, p_closed boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text;
  v_closed date;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select kind, closed_at into v_kind, v_closed from public.accounts
   where owner_user_id = auth.uid() and name = p_account
   for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if p_closed and v_kind = 'cash' and v_closed is null and not exists (
    select 1 from public.accounts
     where owner_user_id = auth.uid() and kind = 'cash' and closed_at is null and name <> p_account
  ) then
    raise exception 'Cash is always kept' using errcode = 'P0001';
  end if;
  update public.accounts
     set closed_at = case when p_closed then coalesce(closed_at, current_date) end
   where owner_user_id = auth.uid() and name = p_account;
end;
$$;
revoke execute on function public.set_account_closed(text, boolean) from public, anon;
grant execute on function public.set_account_closed(text, boolean) to authenticated;

-- Account kinds ---------------------------------------------------------------
alter table public.accounts drop constraint if exists accounts_kind_check;
update public.accounts set kind = 'cash' where kind = 'bank' and name = 'Cash';
update public.accounts set kind = 'savings' where kind = 'bank';
alter table public.accounts alter column kind set default 'savings';
alter table public.accounts add constraint accounts_kind_check
  check (kind in ('savings', 'current', 'credit_card', 'cash', 'wallet'));

-- Seeded accounts get their kind at signup (Cash was being created as a bank).
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

  insert into public.accounts (owner_user_id, name, kind)
  select new.id, b.name, case when b.name = 'Cash' then 'cash' else 'savings' end from (values
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
$$ language plpgsql security definer set search_path = '';
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Debit cards -------------------------------------------------------------------
create table if not exists public.debit_cards (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  last4 text,
  account text not null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, name)
);
alter table public.debit_cards drop constraint if exists debit_cards_name_check;
alter table public.debit_cards add constraint debit_cards_name_check
  check (char_length(name) between 1 and 60);
alter table public.debit_cards drop constraint if exists debit_cards_last4_check;
alter table public.debit_cards add constraint debit_cards_last4_check
  check (last4 is null or last4 ~ '^[0-9]{4}$');
-- Deleting the account deletes its cards (and clears them off transactions).
alter table public.debit_cards drop constraint if exists debit_cards_account_owner_fkey;
alter table public.debit_cards add constraint debit_cards_account_owner_fkey
  foreign key (owner_user_id, account) references public.accounts (owner_user_id, name) on delete cascade;
create index if not exists debit_cards_owner_account_idx on public.debit_cards (owner_user_id, account);

-- Trims the name/last4 and keeps cards on savings/current accounts only. A
-- new card (or a card being moved) can't go on a closed account; renaming a
-- card whose account was closed later still works.
create or replace function public.debit_cards_normalize()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  linked_kind text;
  linked_closed date;
begin
  new.name := btrim(new.name);
  new.last4 := nullif(btrim(new.last4), '');
  select a.kind, a.closed_at into linked_kind, linked_closed
  from public.accounts a
  where a.owner_user_id = new.owner_user_id and a.name = new.account;
  if linked_kind is not null and linked_kind not in ('savings', 'current') then
    raise exception 'A debit card must draw from a savings or current account' using errcode = '23514';
  end if;
  if linked_closed is not null and (tg_op = 'INSERT' or new.account is distinct from old.account) then
    raise exception 'That account is closed' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists debit_cards_normalize on public.debit_cards;
create trigger debit_cards_normalize
  before insert or update of name, last4, account on public.debit_cards
  for each row execute function public.debit_cards_normalize();
revoke execute on function public.debit_cards_normalize() from public, anon, authenticated;

-- A card's past purchases came out of the account it was on, so once it has
-- purchases it can't be moved to another account (they'd stay behind while the
-- card showed under the new one). A card with no purchases can still move.
create or replace function public.debit_cards_block_account_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account is distinct from old.account
     and exists (select 1 from public.transactions t where t.debit_card_id = old.id) then
    raise exception 'This card already has purchases on %. Add a new card for the other account instead.', old.account
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists debit_cards_block_account_move on public.debit_cards;
create trigger debit_cards_block_account_move
  before update of account on public.debit_cards
  for each row execute function public.debit_cards_block_account_move();
revoke execute on function public.debit_cards_block_account_move() from public, anon, authenticated;

-- Transactions paid with a debit card ------------------------------------------
alter table public.transactions add column if not exists debit_card_id uuid;
alter table public.transactions drop constraint if exists transactions_debit_card_id_fkey;
alter table public.transactions add constraint transactions_debit_card_id_fkey
  foreign key (debit_card_id) references public.debit_cards(id) on delete set null;
create index if not exists transactions_debit_card_idx
  on public.transactions (debit_card_id) where debit_card_id is not null;

-- A card payment stays on the card's own account (so that account's balance
-- includes it), is spending or a transfer out (an ATM withdrawal), and is
-- always recorded as paid by 'Debit card'. Runs with the caller's rights, so
-- someone else's card simply isn't found.
create or replace function public.transactions_check_debit_card()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  card_owner uuid;
  card_account text;
begin
  if new.debit_card_id is null then
    return new;
  end if;
  select c.owner_user_id, c.account into card_owner, card_account
  from public.debit_cards c
  where c.id = new.debit_card_id;
  if card_owner is null or card_owner <> new.owner_user_id then
    raise exception 'Debit card not found' using errcode = '23503';
  end if;
  if new.account is distinct from card_account then
    raise exception 'A debit card payment must come from the card''s account (%)', card_account using errcode = '23514';
  end if;
  if new.type not in ('expense', 'transfer') then
    raise exception 'Only spending and transfers out can be paid with a debit card' using errcode = '23514';
  end if;
  new.payment_method := 'Debit card';
  return new;
end;
$$;
drop trigger if exists transactions_check_debit_card on public.transactions;
create trigger transactions_check_debit_card
  before insert or update of debit_card_id, account, type, payment_method on public.transactions
  for each row execute function public.transactions_check_debit_card();
revoke execute on function public.transactions_check_debit_card() from public, anon, authenticated;

-- Cash is always kept ---------------------------------------------------------------
-- Every user keeps an open cash account. Backfill: a leftover 'Cash' of another
-- kind (with no debit cards) becomes cash, a closed 'Cash' is reopened when it
-- was the only cash account, and anyone still without one gets 'Cash'.
update public.accounts a
   set kind = 'cash', credit_limit = null, statement_day = null, due_day = null
 where a.name = 'Cash' and a.kind <> 'cash'
   and not exists (select 1 from public.accounts c where c.owner_user_id = a.owner_user_id and c.kind = 'cash')
   and not exists (select 1 from public.debit_cards d where d.owner_user_id = a.owner_user_id and d.account = a.name);
update public.accounts a
   set closed_at = null
 where a.name = 'Cash' and a.kind = 'cash' and a.closed_at is not null
   and not exists (select 1 from public.accounts c
                   where c.owner_user_id = a.owner_user_id and c.kind = 'cash' and c.closed_at is null);
insert into public.accounts (owner_user_id, name, kind)
select p.id, 'Cash', 'cash'
  from public.profiles p
 where not exists (select 1 from public.accounts c
                   where c.owner_user_id = p.id and c.kind = 'cash' and c.closed_at is null)
on conflict (owner_user_id, name) do nothing;

-- Deleting the last open cash account is refused while its owner exists, so
-- deleting the whole user (delete_own_account -> auth.users cascade) still
-- works. SECURITY DEFINER only to see auth.users; never callable directly.
create or replace function public.accounts_keep_cash()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.kind = 'cash' and old.closed_at is null
     and exists (select 1 from auth.users u where u.id = old.owner_user_id)
     and not exists (
       select 1 from public.accounts a
        where a.owner_user_id = old.owner_user_id and a.kind = 'cash'
          and a.closed_at is null and a.name <> old.name
     ) then
    raise exception 'Cash is always kept' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
drop trigger if exists accounts_keep_cash on public.accounts;
create trigger accounts_keep_cash
  before delete on public.accounts
  for each row execute function public.accounts_keep_cash();
revoke execute on function public.accounts_keep_cash() from public, anon, authenticated;

-- Account details setter ----------------------------------------------------------
-- Same signature as before. A legacy 'bank' from a not-yet-updated client
-- means 'savings'. A savings/current account can't become another kind while
-- debit cards still draw from it.
create or replace function public.set_account_details(
  p_account text, p_kind text, p_credit_limit numeric, p_statement_day int, p_due_day int
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text := case when p_kind = 'bank' then 'savings' else p_kind end;
  v_current text;
  v_closed date;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if v_kind is null or v_kind not in ('savings', 'current', 'credit_card', 'cash', 'wallet') then
    raise exception 'Unknown account type' using errcode = '22023';
  end if;
  select kind, closed_at into v_current, v_closed from public.accounts
   where owner_user_id = auth.uid() and name = p_account
   for update;
  if not found then
    raise exception 'Account not found';
  end if;
  -- Cash is always kept: the last open cash account can't become another kind.
  if v_current = 'cash' and v_kind <> 'cash' and v_closed is null and not exists (
    select 1 from public.accounts
     where owner_user_id = auth.uid() and kind = 'cash' and closed_at is null and name <> p_account
  ) then
    raise exception 'Cash is always kept' using errcode = 'P0001';
  end if;
  if v_kind not in ('savings', 'current') and exists (
    select 1 from public.debit_cards where owner_user_id = auth.uid() and account = p_account
  ) then
    raise exception 'Move or remove its debit cards first' using errcode = '23514';
  end if;
  update public.accounts
     set kind = v_kind,
         credit_limit = case when v_kind = 'credit_card' then p_credit_limit end,
         statement_day = case when v_kind = 'credit_card' then p_statement_day end,
         due_day = case when v_kind = 'credit_card' then p_due_day end
   where owner_user_id = auth.uid() and name = p_account;
end;
$$;
revoke execute on function public.set_account_details(text, text, numeric, int, int) from public, anon;
grant execute on function public.set_account_details(text, text, numeric, int, int) to authenticated;

-- Account -> debit card conversion ------------------------------------------------
-- For an account that was really a debit card. Creates a card named after
-- p_account on p_linked_account, then: deletes transfers between the two
-- (they'd become transfers from an account to itself), moves spending and
-- transfers out onto the linked account paid by the new card, re-points
-- income, incoming transfers and recurring items to the linked account, adds
-- p_account's starting balance to the linked account's, and deletes p_account.
-- Every moved row's fingerprint is recomputed for its new account, exactly as
-- buildFingerprint() in src/lib/fingerprint.ts builds it (keeping a "Save
-- anyway" '|dup-xxxxxxxx' override on the end), so re-importing the linked
-- account's statement recognises it. A row keeps its old fingerprint when the
-- new one is already taken (the same purchase already logged on the linked
-- account). Returns one row (a single JSON object over the API): the new
-- card's id, how many transactions moved, how many transfers were removed.
create or replace function public.convert_account_to_debit_card(
  p_account text, p_linked_account text, p_last4 text,
  out card_id uuid, out moved int, out removed_transfers int
)
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  src_opening numeric;
  dst_kind text;
  dst_closed date;
  v_name text := left(btrim(p_account), 60);
  v_last4 text := nullif(btrim(p_last4), '');
  v_ids uuid[];
  v_more uuid[];
  mv record;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_account is null or p_linked_account is null or p_account = p_linked_account then
    raise exception 'Choose a different account for the card to draw from' using errcode = '22023';
  end if;
  select a.opening_balance into src_opening
  from public.accounts a where a.owner_user_id = me and a.name = p_account
  for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  select a.kind, a.closed_at into dst_kind, dst_closed
  from public.accounts a where a.owner_user_id = me and a.name = p_linked_account
  for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if dst_kind not in ('savings', 'current') then
    raise exception 'A debit card must draw from a savings or current account' using errcode = '22023';
  end if;
  if dst_closed is not null then
    raise exception 'That account is closed' using errcode = '22023';
  end if;
  if exists (select 1 from public.debit_cards c where c.owner_user_id = me and c.account = p_account) then
    raise exception 'Debit cards draw from this account; move or remove them first' using errcode = '22023';
  end if;
  if v_last4 is not null and v_last4 !~ '^[0-9]{4}$' then
    raise exception 'The last 4 digits must be 4 numbers' using errcode = '22023';
  end if;
  if exists (select 1 from public.debit_cards c where c.owner_user_id = me and c.name = v_name) then
    raise exception 'You already have a debit card called %', v_name using errcode = '23505';
  end if;

  insert into public.debit_cards (owner_user_id, name, last4, account)
  values (me, v_name, v_last4, p_linked_account)
  returning id into card_id;

  delete from public.transactions t
  where t.owner_user_id = me and t.type = 'transfer'
    and ((t.account = p_account and t.to_account = p_linked_account)
      or (t.account = p_linked_account and t.to_account = p_account));
  get diagnostics removed_transfers = row_count;

  with u as (
    update public.transactions t
       set account = p_linked_account, debit_card_id = card_id
     where t.owner_user_id = me and t.account = p_account and t.type in ('expense', 'transfer')
    returning t.id
  ) select coalesce(array_agg(u.id), '{}') into v_ids from u;

  with u as (
    update public.transactions t
       set account = p_linked_account
     where t.owner_user_id = me and t.account = p_account
    returning t.id
  ) select coalesce(array_agg(u.id), '{}') into v_more from u;
  v_ids := v_ids || v_more;

  with u as (
    update public.transactions t
       set to_account = p_linked_account
     where t.owner_user_id = me and t.to_account = p_account
    returning t.id
  ) select coalesce(array_agg(u.id), '{}') into v_more from u;
  v_ids := v_ids || v_more;
  moved := cardinality(v_ids);

  -- Must remain identical to buildFingerprint() in src/lib/fingerprint.ts.
  for mv in
    select t.id, t.fingerprint,
           to_char(t.date, 'YYYY-MM-DD') || '|' || lower(trim(t.merchant)) || '|'
             || to_char(t.amount, 'FM9999999990.00') || '|' || lower(trim(t.account))
             || case t.type
                  when 'income' then '|income'
                  when 'transfer' then '|transfer|' || lower(trim(coalesce(t.to_account, '')))
                  else ''
                end
             || coalesce(substring(t.fingerprint from '(\|dup-[0-9a-f]{8})(?:\||$)'), '') as fp
    from public.transactions t
    where t.id = any(v_ids)
    order by t.date, t.created_at, t.id
  loop
    if mv.fp is distinct from mv.fingerprint and not exists (
      select 1 from public.transactions o
      where o.owner_user_id = me and o.fingerprint = mv.fp and o.id <> mv.id
    ) then
      begin
        update public.transactions set fingerprint = mv.fp where id = mv.id;
      exception when unique_violation then null;
      end;
    end if;
  end loop;

  update public.recurring_items r
     set account = p_linked_account
   where r.owner_user_id = me and r.account = p_account;

  update public.accounts a
     set opening_balance = a.opening_balance + src_opening
   where a.owner_user_id = me and a.name = p_linked_account;

  delete from public.accounts a where a.owner_user_id = me and a.name = p_account;
end;
$$;
revoke execute on function public.convert_account_to_debit_card(text, text, text) from public, anon;
grant execute on function public.convert_account_to_debit_card(text, text, text) to authenticated;

-- ===== 2026-09-29: loan / EMI details on recurring payments =====
-- (migration 2026-09-29_recurring_loan_details.sql) All three or none.
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
alter table public.recurring_items add column if not exists loan_interest_rate numeric(5, 2);
alter table public.recurring_items drop constraint if exists recurring_items_loan_interest_rate_check;
alter table public.recurring_items add constraint recurring_items_loan_interest_rate_check
  check (loan_interest_rate is null or (loan_interest_rate >= 0 and loan_interest_rate <= 100 and loan_amount is not null));

-- ===== 2026-09-29: admin dashboard + setup checklist (migration 2026-09-29_admin_dashboard.sql) =====

-- The app version that reported an error, so the dashboard can group by it.
alter table public.client_errors add column if not exists app_version text;
alter table public.client_errors drop constraint if exists client_errors_app_version_check;
alter table public.client_errors add constraint client_errors_app_version_check
  check (app_version is null or char_length(app_version) <= 32) not valid;

-- Home's "Finish setting up" checklist, once the user hides it.
alter table public.user_settings add column if not exists setup_checklist_dismissed boolean not null default false;

-- Announcements: a short message shown to every signed-in user as a banner
-- until it's switched off or its end time passes. Written only by admins.
create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  tone text not null default 'info',
  active boolean not null default true,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.app_announcements drop constraint if exists app_announcements_message_check;
alter table public.app_announcements add constraint app_announcements_message_check
  check (char_length(btrim(message)) between 1 and 280);
alter table public.app_announcements drop constraint if exists app_announcements_tone_check;
alter table public.app_announcements add constraint app_announcements_tone_check
  check (tone in ('info', 'success', 'warning'));

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'signups_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'signed_in_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'logging_7d', (select count(distinct owner_user_id) from public.transactions where created_at > now() - interval '7 days'),
    'transactions', (select count(*) from public.transactions),
    'transactions_7d', (select count(*) from public.transactions where created_at > now() - interval '7 days'),
    'feedback_open', (select count(*) from public.feedback where admin_reply is null and admin_dismissed_at is null),
    'errors_7d', (select count(*) from public.client_errors where created_at > now() - interval '7 days'),
    'signups_by_week', (
      select coalesce(jsonb_agg(jsonb_build_object('week', week, 'count', n) order by week), '[]'::jsonb)
      from (
        select date_trunc('week', created_at)::date as week, count(*) as n
        from auth.users
        where created_at > now() - interval '12 weeks'
        group by 1
      ) s
    )
  );
end;
$$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_list_users()
returns table (
  id uuid,
  display_name text,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  setup_done boolean,
  transactions bigint,
  last_entry_at timestamptz,
  is_admin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    p.display_name,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null,
    coalesce(s.onboarding_completed, false),
    (select count(*) from public.transactions t where t.owner_user_id = u.id),
    (select max(t.created_at) from public.transactions t where t.owner_user_id = u.id),
    exists (select 1 from public.admin_users a where a.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_settings s on s.owner_user_id = u.id
  order by u.created_at desc;
end;
$$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Errors grouped by message: how often, how many people, which versions.
-- No user ids or emails leave the function.
create or replace function public.admin_client_errors(p_days int default 30)
returns table (
  message text,
  occurrences bigint,
  people bigint,
  first_seen timestamptz,
  last_seen timestamptz,
  versions text[],
  sample_url text,
  sample_stack text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select
    e.message,
    count(*),
    count(distinct e.owner_user_id),
    min(e.created_at),
    max(e.created_at),
    array_remove(array_agg(distinct e.app_version), null),
    (array_agg(e.url order by e.created_at desc))[1],
    left((array_agg(e.stack order by e.created_at desc))[1], 2000)
  from public.client_errors e
  where e.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
  group by e.message
  order by max(e.created_at) desc
  limit 200;
end;
$$;
revoke execute on function public.admin_client_errors(int) from public, anon;
grant execute on function public.admin_client_errors(int) to authenticated;

-- ===== 2026-09-29: tag delete, card networks, salary (migration 2026-09-29_tags_cards_salary.sql) =====

-- ===== Tags: delete one everywhere =====
-- Removes the tag from the caller's own transactions and their tag list in
-- one go. SECURITY INVOKER: RLS limits both statements to the caller's rows.
create or replace function public.delete_tag(p_tag text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  update public.transactions set tags = array_remove(tags, p_tag)
   where owner_user_id = auth.uid() and p_tag = any(tags);
  delete from public.tags where owner_user_id = auth.uid() and name = p_tag;
end;
$$;
revoke execute on function public.delete_tag(text) from public, anon;
grant execute on function public.delete_tag(text) to authenticated;

-- ===== Card networks (Visa, Mastercard, RuPay, ...) =====
-- A RuPay credit card can be linked to UPI, so the app offers it for UPI
-- payments; other credit cards only for "Credit card".
alter table public.accounts add column if not exists card_network text;
alter table public.accounts drop constraint if exists accounts_card_network_check;
alter table public.accounts add constraint accounts_card_network_check check (
  card_network is null
  or (card_network in ('visa', 'mastercard', 'rupay', 'amex', 'diners', 'other') and kind = 'credit_card')
);
alter table public.debit_cards add column if not exists network text;
alter table public.debit_cards drop constraint if exists debit_cards_network_check;
alter table public.debit_cards add constraint debit_cards_network_check
  check (network is null or network in ('visa', 'mastercard', 'rupay', 'amex', 'diners', 'other'));

-- accounts has no UPDATE policy; the network goes through its own narrow RPC.
create or replace function public.set_card_network(p_account text, p_network text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_network is not null and p_network not in ('visa', 'mastercard', 'rupay', 'amex', 'diners', 'other') then
    raise exception 'Unknown card network' using errcode = '22023';
  end if;
  select kind into v_kind from public.accounts where owner_user_id = auth.uid() and name = p_account for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_kind <> 'credit_card' and p_network is not null then
    raise exception 'Only credit cards have a network here' using errcode = '22023';
  end if;
  update public.accounts set card_network = p_network where owner_user_id = auth.uid() and name = p_account;
end;
$$;
revoke execute on function public.set_card_network(text, text) from public, anon;
grant execute on function public.set_card_network(text, text) to authenticated;

-- set_account_details, unchanged except that leaving credit_card also clears
-- the card network (the check above only allows it on credit cards).
create or replace function public.set_account_details(
  p_account text, p_kind text, p_credit_limit numeric, p_statement_day int, p_due_day int
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text := case when p_kind = 'bank' then 'savings' else p_kind end;
  v_current text;
  v_closed date;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if v_kind is null or v_kind not in ('savings', 'current', 'credit_card', 'cash', 'wallet') then
    raise exception 'Unknown account type' using errcode = '22023';
  end if;
  select kind, closed_at into v_current, v_closed from public.accounts
   where owner_user_id = auth.uid() and name = p_account
   for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_current = 'cash' and v_kind <> 'cash' and v_closed is null and not exists (
    select 1 from public.accounts
     where owner_user_id = auth.uid() and kind = 'cash' and closed_at is null and name <> p_account
  ) then
    raise exception 'Cash is always kept' using errcode = 'P0001';
  end if;
  if v_kind not in ('savings', 'current') and exists (
    select 1 from public.debit_cards where owner_user_id = auth.uid() and account = p_account
  ) then
    raise exception 'Move or remove its debit cards first' using errcode = '23514';
  end if;
  update public.accounts
     set kind = v_kind,
         credit_limit = case when v_kind = 'credit_card' then p_credit_limit end,
         statement_day = case when v_kind = 'credit_card' then p_statement_day end,
         due_day = case when v_kind = 'credit_card' then p_due_day end,
         card_network = case when v_kind = 'credit_card' then card_network end
   where owner_user_id = auth.uid() and name = p_account;
end;
$$;
revoke execute on function public.set_account_details(text, text, numeric, int, int) from public, anon;
grant execute on function public.set_account_details(text, text, numeric, int, int) to authenticated;

grant update (name, last4, account, network) on public.debit_cards to authenticated;

-- ===== Salary =====
-- What the user expects to be paid, into which account, on which day. On or
-- after that day the app asks "Did it arrive?"; Yes logs the income (tag
-- #salary). salary_confirmed_month = the YYYY-MM last answered (yes or not
-- yet), so each month asks once.
alter table public.user_settings add column if not exists salary_amount numeric(14, 2);
alter table public.user_settings add column if not exists salary_account text;
alter table public.user_settings add column if not exists salary_day smallint;
alter table public.user_settings add column if not exists salary_confirmed_month text;
alter table public.user_settings drop constraint if exists user_settings_salary_check;
alter table public.user_settings add constraint user_settings_salary_check check (
  (salary_amount is null and salary_account is null and salary_day is null)
  or (
    salary_amount is not null and salary_amount > 0
    and salary_account is not null and char_length(salary_account) between 1 and 100
    and salary_day is not null and salary_day between 1 and 31
  )
);
alter table public.user_settings drop constraint if exists user_settings_salary_month_check;
alter table public.user_settings add constraint user_settings_salary_month_check
  check (salary_confirmed_month is null or salary_confirmed_month ~ '^\d{4}-\d{2}$');

-- ===== 2026-09-29: category icons (migration 2026-09-29_category_icons.sql) =====
--
-- icon is a key from the app's icon set (src/lib/categoryIcon.ts); null = the
-- app guesses from the name. Only `icon` becomes updatable, on the user's own
-- rows: renaming stays impossible (transactions refer to categories by name).

alter table public.categories add column if not exists icon text;
alter table public.categories drop constraint if exists categories_icon_check;
alter table public.categories add constraint categories_icon_check
  check (icon is null or icon ~ '^[a-z]{2,20}$');

-- ===== Wallet payment mode (2026-09-29_wallet_payment_mode.sql) =====
alter table public.transactions drop constraint if exists transactions_payment_method_check;
alter table public.transactions add constraint transactions_payment_method_check check (
  payment_method is null or payment_method in
    ('UPI','Cash','Debit card','Credit card','Wallet','Net banking','Cheque','NEFT/RTGS/IMPS','Other')
);

-- ===== Lent & borrowed (2026-09-29_lent_borrowed.sql); RLS in policies.sql =====
create table if not exists public.ious (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person text not null check (char_length(btrim(person)) between 1 and 80),
  direction text not null check (direction in ('lent', 'borrowed')),
  amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date,
  due_date date,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (id, owner_user_id),
  constraint ious_due_after_date check (due_date is null or due_date >= date)
);
create index if not exists ious_owner_idx on public.ious (owner_user_id, date desc);

create table if not exists public.iou_payments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  iou_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date,
  created_at timestamptz not null default now(),
  -- A payment belongs to one of the same person's own records.
  foreign key (iou_id, owner_user_id) references public.ious (id, owner_user_id) on delete cascade
);
create index if not exists iou_payments_iou_idx on public.iou_payments (iou_id);

-- Repayments can't add up to more than was lent/borrowed, and a record's
-- amount can't be lowered below what's already been repaid.
create or replace function public.iou_payments_check_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_amount numeric;
  v_paid numeric;
begin
  select amount into v_amount from public.ious where id = new.iou_id;
  select coalesce(sum(amount), 0) into v_paid from public.iou_payments
   where iou_id = new.iou_id and id <> new.id;
  if v_paid + new.amount > v_amount then
    raise exception 'That is more than what is left to pay' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.iou_payments_check_total() from public, anon, authenticated;

create or replace function public.ious_check_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select coalesce(sum(amount), 0) from public.iou_payments where iou_id = new.id) > new.amount then
    raise exception 'The amount can''t be less than what has already been paid back' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.ious_check_amount() from public, anon, authenticated;

drop trigger if exists ious_check_amount on public.ious;
create trigger ious_check_amount before update of amount on public.ious
  for each row execute function public.ious_check_amount();
drop trigger if exists iou_payments_check_total on public.iou_payments;
create trigger iou_payments_check_total before insert or update of amount, iou_id on public.iou_payments
  for each row execute function public.iou_payments_check_total();


-- ===== Phone reminders (2026-09-29_push_reminders.sql): push_subscriptions, push_digest, the daily pg_cron job. RLS in policies.sql =====
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ===== Devices that turned reminders on =====
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_sent_on date
);

-- Saving goes through this RPC: a device's endpoint belongs to whoever turned
-- reminders on last, so a shared phone never gets the previous person's.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Invalid subscription' using errcode = '22023';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (owner_user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ===== What to say =====
create or replace function public.push_money(p_amount numeric, p_currency text)
returns text
language sql immutable set search_path = ''
as $$
  select case coalesce(p_currency, 'INR')
           when 'INR' then '₹' when 'USD' then '$' when 'EUR' then '€' when 'GBP' then '£'
           else coalesce(p_currency, '') || ' ' end
         || to_char(p_amount, case when p_amount = trunc(p_amount) then 'FM999,999,999,999' else 'FM999,999,999,990.00' end);
$$;
revoke execute on function public.push_money(numeric, text) from public, anon, authenticated;

-- One row per person with something to hear about today (only people with a
-- device that hasn't had today's reminder yet). Service role only.
create or replace function public.push_digest(p_today date)
returns table (owner_user_id uuid, title text, body text, url text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  u record;
  lines text[];
  cur text;
  n_overdue int;
  n_bills int;
  names text;
  go_to text;
begin
  for u in
    select distinct s.owner_user_id as id from public.push_subscriptions s
    where s.last_sent_on is null or s.last_sent_on < p_today
  loop
    lines := '{}';
    go_to := null;
    select coalesce(us.currency, 'INR') into cur from public.user_settings us where us.owner_user_id = u.id;

    -- Bills and subscriptions: overdue, due today, due tomorrow.
    select count(*), string_agg(r.name || ' ' || public.push_money(r.amount, cur), ', ' order by r.next_date, r.name)
      into n_overdue, names
      from public.recurring_items r where r.owner_user_id = u.id and r.active and r.next_date < p_today;
    if n_overdue > 0 then
      lines := lines || ('Overdue: ' || names);
      go_to := '/bills';
    end if;
    select count(*), string_agg(r.name || ' ' || public.push_money(r.amount, cur), ', ' order by r.name)
      into n_bills, names
      from public.recurring_items r where r.owner_user_id = u.id and r.active and r.next_date = p_today;
    if n_bills > 0 then
      lines := lines || ('Due today: ' || names);
      go_to := coalesce(go_to, '/bills');
    end if;
    select count(*), string_agg(r.name || ' ' || public.push_money(r.amount, cur), ', ' order by r.name)
      into n_bills, names
      from public.recurring_items r where r.owner_user_id = u.id and r.active and r.next_date = p_today + 1;
    if n_bills > 0 then
      lines := lines || ('Due tomorrow: ' || names);
      go_to := coalesce(go_to, '/bills');
    end if;

    -- Credit card bills due today or in 2 days, when something is owed.
    select string_agg(c.name || ' bill due ' || case when c.due = p_today then 'today' else to_char(c.due, 'FMMon FMDD') end, ', ')
      into names
      from (
        select a.name,
               case when d.this_month >= p_today then d.this_month else d.next_month end as due,
               a.opening_balance + coalesce((
                 select sum(case
                   when t.type = 'income' and t.account = a.name then t.amount
                   when t.type = 'expense' and t.account = a.name then -t.amount
                   when t.type = 'transfer' and t.account = a.name then -t.amount
                   when t.type = 'transfer' and t.to_account = a.name then t.amount
                   else 0 end)
                 from public.transactions t
                 where t.owner_user_id = u.id and (t.account = a.name or t.to_account = a.name)), 0) as balance
        from public.accounts a
        cross join lateral (
          select make_date(extract(year from p_today)::int, extract(month from p_today)::int,
                   least(a.due_day, extract(day from (date_trunc('month', p_today) + interval '1 month - 1 day'))::int)) as this_month,
                 make_date(extract(year from p_today + interval '1 month')::int, extract(month from p_today + interval '1 month')::int,
                   least(a.due_day, extract(day from (date_trunc('month', p_today + interval '1 month') + interval '1 month - 1 day'))::int)) as next_month
        ) d
        where a.owner_user_id = u.id and a.kind = 'credit_card' and a.closed_at is null and a.due_day is not null
      ) c
      where c.balance < 0 and c.due in (p_today, p_today + 2);
    if names is not null then
      lines := lines || names;
      go_to := coalesce(go_to, '/bills');
    end if;

    -- Salary day: from pay day until it's confirmed for the month.
    if exists (
      select 1 from public.user_settings us
      where us.owner_user_id = u.id and us.salary_day is not null
        and coalesce(us.salary_confirmed_month, '') <> to_char(p_today, 'YYYY-MM')
        and extract(day from p_today)::int >= least(us.salary_day,
              extract(day from (date_trunc('month', p_today) + interval '1 month - 1 day'))::int)
    ) then
      lines := lines || 'Did your salary arrive? Tap to confirm.'::text;
      go_to := coalesce(go_to, '/');
    end if;

    -- Lent & borrowed with a pay-back date that has come.
    select string_agg(case when i.direction = 'lent'
                        then i.person || ' should pay you back ' || public.push_money(i.left_amount, cur)
                        else 'Pay back ' || i.person || ' ' || public.push_money(i.left_amount, cur) end, ', ')
      into names
      from (
        select x.person, x.direction, x.amount - coalesce((select sum(p.amount) from public.iou_payments p where p.iou_id = x.id), 0) as left_amount
        from public.ious x
        where x.owner_user_id = u.id and x.due_date is not null and x.due_date <= p_today
      ) i
      where i.left_amount > 0;
    if names is not null then
      lines := lines || names;
      go_to := coalesce(go_to, '/lent');
    end if;

    if array_length(lines, 1) > 0 then
      owner_user_id := u.id;
      title := case when n_overdue > 0 then 'Payment overdue' else 'Today in LedgeEaze' end;
      body := array_to_string(lines[1:4], E'\n');
      url := coalesce(go_to, '/');
      return next;
    end if;
  end loop;
end;
$$;
revoke execute on function public.push_digest(date) from public, anon, authenticated;
grant execute on function public.push_digest(date) to service_role;

-- The Edge Function reads its keys through this (service role only).
create or replace function public.push_server_config()
returns table (vapid_keys text, cron_secret text)
language sql stable security definer set search_path = ''
as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_keys'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret');
$$;
revoke execute on function public.push_server_config() from public, anon, authenticated;
grant execute on function public.push_server_config() to service_role;

-- ===== Every day at 03:30 UTC = 09:00 IST =====
do $$
begin
  if exists (select 1 from cron.job where jobname = 'ledgeeaze-daily-reminders') then
    perform cron.unschedule('ledgeeaze-daily-reminders');
  end if;
end $$;
select cron.schedule(
  'ledgeeaze-daily-reminders',
  '30 3 * * *',
  $job$
    select net.http_post(
      url := 'https://izidxazhknyoxeqgnqdb.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);

-- ===== Notification history (2026-09-30_notifications.sql). RLS in policies.sql =====
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'access_request', 'access_approved', 'access_declined', 'feedback_reply',
    'split_added', 'split_settled', 'budget', 'bill_overdue', 'reminder')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 500),
  url text check (url is null or url like '/%'),
  ref text not null check (char_length(ref) between 1 and 200),
  actor_user_id uuid references auth.users(id) on delete set null,
  -- For access requests: what happened to it ('approved' / 'declined').
  status text check (status is null or status in ('approved', 'declined')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (owner_user_id, ref)
);
create index if not exists notifications_owner_idx on public.notifications (owner_user_id, created_at desc);

-- A person's name for notification text.
create or replace function public.notify_name(p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(nullif(btrim(p.display_name), ''), p.email, 'Someone') from public.profiles p where p.id = p_user;
$$;
revoke execute on function public.notify_name(uuid) from public, anon, authenticated;

-- ===== Sharing =====
create or replace function public.notify_viewer_access()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.owner_user_id, 'access_request',
            coalesce(public.notify_name(new.requester_user_id), 'Someone') || ' wants to see your transactions',
            'Approve to share your transactions with them. You can stop anytime in Settings.',
            '/settings/sharing', 'access:' || new.id, new.requester_user_id)
    on conflict (owner_user_id, ref) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    update public.notifications set status = 'approved', read_at = coalesce(read_at, now())
     where owner_user_id = new.owner_user_id and ref = 'access:' || new.id;
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.requester_user_id, 'access_approved',
            coalesce(public.notify_name(new.owner_user_id), 'Someone') || ' said yes',
            'You can now see their transactions. Choose Everyone on Activity.',
            '/transactions', 'access-approved:' || new.id, new.owner_user_id)
    on conflict (owner_user_id, ref) do nothing;
  elsif tg_op = 'DELETE' and old.status = 'pending' and auth.uid() = old.owner_user_id
        -- not when the owner is deleting their whole account
        and exists (select 1 from auth.users where id = old.owner_user_id) then
    update public.notifications set status = 'declined', read_at = coalesce(read_at, now())
     where owner_user_id = old.owner_user_id and ref = 'access:' || old.id;
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (old.requester_user_id, 'access_declined',
            coalesce(public.notify_name(old.owner_user_id), 'Someone') || ' said no to sharing',
            'Your request to see their transactions was declined.',
            '/settings/sharing', 'access-declined:' || old.id, old.owner_user_id)
    on conflict (owner_user_id, ref) do nothing;
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.notify_viewer_access() from public, anon, authenticated;
drop trigger if exists viewer_access_notify on public.viewer_access;
create trigger viewer_access_notify after insert or update of status or delete on public.viewer_access
  for each row execute function public.notify_viewer_access();

-- ===== Feedback replies =====
create or replace function public.notify_feedback_reply()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.admin_reply is not null and new.admin_reply is distinct from old.admin_reply then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref)
    values (new.owner_user_id, 'feedback_reply', 'We replied to your feedback',
            left(new.admin_reply, 300), '/settings/feedback', 'feedback:' || new.id || ':' || md5(new.admin_reply))
    on conflict (owner_user_id, ref) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_feedback_reply() from public, anon, authenticated;
drop trigger if exists feedback_notify_reply on public.feedback;
create trigger feedback_notify_reply after update of admin_reply on public.feedback
  for each row execute function public.notify_feedback_reply();

-- ===== Splits =====
create or replace function public.notify_split()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cur text;
begin
  select coalesce(us.currency, 'INR') into cur from public.user_settings us where us.owner_user_id = new.with_user_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.with_user_id, 'split_added',
            coalesce(public.notify_name(new.owner_user_id), 'Someone') || ' split an expense with you',
            'You owe ' || public.push_money(new.amount, cur) || ' for ' || new.description || '.',
            '/shared', 'split:' || new.id, new.owner_user_id)
    on conflict (owner_user_id, ref) do nothing;
  elsif tg_op = 'UPDATE' and old.settled_at is null and new.settled_at is not null then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.with_user_id, 'split_settled',
            coalesce(public.notify_name(new.owner_user_id), 'Someone') || ' marked a split as settled',
            public.push_money(new.amount, cur) || ' for ' || new.description || ' is settled.',
            '/shared', 'split-settled:' || new.id, new.owner_user_id)
    on conflict (owner_user_id, ref) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_split() from public, anon, authenticated;
drop trigger if exists transaction_splits_notify on public.transaction_splits;
create trigger transaction_splits_notify after insert or update of settled_at on public.transaction_splits
  for each row execute function public.notify_split();

-- ===== Backfill what's open today =====
insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id, created_at)
select va.owner_user_id, 'access_request',
       coalesce(public.notify_name(va.requester_user_id), 'Someone') || ' wants to see your transactions',
       'Approve to share your transactions with them. You can stop anytime in Settings.',
       '/settings/sharing', 'access:' || va.id, va.requester_user_id, va.created_at
from public.viewer_access va where va.status = 'pending'
on conflict (owner_user_id, ref) do nothing;

insert into public.notifications (owner_user_id, kind, title, body, url, ref, created_at, read_at)
select f.owner_user_id, 'feedback_reply', 'We replied to your feedback', left(f.admin_reply, 300), '/settings/feedback',
       'feedback:' || f.id || ':' || md5(f.admin_reply), coalesce(f.replied_at, f.created_at), f.reply_seen_at
from public.feedback f where f.admin_reply is not null
on conflict (owner_user_id, ref) do nothing;

-- ===== Forgot password: account check (2026-09-30_reset_account_check.sql) =====
create or replace function public.account_exists_for_reset(p_email text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(btrim(p_email)) and u.deleted_at is null
  );
$$;
revoke execute on function public.account_exists_for_reset(text) from public;
grant execute on function public.account_exists_for_reset(text) to anon, authenticated;

-- ===== Pay day in the bell history (2026-09-30_salary_notifications.sql) =====
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'access_request', 'access_approved', 'access_declined', 'feedback_reply',
  'split_added', 'split_settled', 'budget', 'bill_overdue', 'reminder', 'salary'));

-- ===== Clearing a notification hides it (2026-09-30_notification_dismiss.sql) =====
alter table public.notifications add column if not exists dismissed_at timestamptz;

-- ===== Coin colour: gold unless the user picks their theme (2026-09-30_coin_color.sql) =====
alter table public.user_settings add column if not exists coin_follows_theme boolean not null default false;

-- ===== Daily reminder: real card bills only (2026-09-30_reminder_card_bills.sql) =====
create or replace function public.push_day_in_month(p_month date, p_day int)
returns date
language sql immutable set search_path = ''
as $$
  select date_trunc('month', p_month)::date
         + (least(greatest(p_day, 1), extract(day from date_trunc('month', p_month) + interval '1 month - 1 day')::int) - 1);
$$;
revoke execute on function public.push_day_in_month(date, int) from public, anon, authenticated;

-- One card's current bill: statement date, due date and what's still to pay.
create or replace function public.push_card_bill(p_owner uuid, p_account text, p_opening numeric, p_statement_day int, p_due_day int, p_today date)
returns table (statement_date date, due_date date, due numeric)
language sql stable security definer set search_path = ''
as $$
  with s as (
    select case
             when public.push_day_in_month(p_today, p_statement_day) <= p_today then public.push_day_in_month(p_today, p_statement_day)
             else public.push_day_in_month((p_today - interval '1 month')::date, p_statement_day)
           end as stmt
  ), d as (
    select s.stmt,
           case
             when public.push_day_in_month(s.stmt, p_due_day) > s.stmt then public.push_day_in_month(s.stmt, p_due_day)
             else public.push_day_in_month((s.stmt + interval '1 month')::date, p_due_day)
           end as due_on
    from s
  ), tx as (
    select t.date, t.type, t.amount,
           case
             when t.type = 'income' and t.account = p_account then t.amount
             when t.type = 'expense' and t.account = p_account then -t.amount
             when t.type = 'transfer' and t.account = p_account then -t.amount
             when t.type = 'transfer' and t.to_account = p_account then t.amount
             else 0
           end as effect
    from public.transactions t
    where t.owner_user_id = p_owner and (t.account = p_account or t.to_account = p_account)
  )
  select d.stmt, d.due_on,
         greatest(0, round(
           greatest(0, -(p_opening + coalesce((select sum(effect) from tx where tx.date <= d.stmt), 0)))
           - coalesce((select sum(amount) from tx where tx.date > d.stmt and tx.date <= p_today and tx.type <> 'expense' and tx.effect > 0), 0),
         2))
  from d;
$$;
revoke execute on function public.push_card_bill(uuid, text, numeric, int, int, date) from public, anon, authenticated;

create or replace function public.push_digest(p_today date)
returns table (owner_user_id uuid, title text, body text, url text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  u record;
  lines text[];
  cur text;
  n_overdue int;
  n_bills int;
  names text;
  go_to text;
begin
  for u in
    select distinct s.owner_user_id as id from public.push_subscriptions s
    where s.last_sent_on is null or s.last_sent_on < p_today
  loop
    lines := '{}';
    go_to := null;
    select coalesce(us.currency, 'INR') into cur from public.user_settings us where us.owner_user_id = u.id;

    select count(*), string_agg(r.name || ' ' || public.push_money(r.amount, cur), ', ' order by r.next_date, r.name)
      into n_overdue, names
      from public.recurring_items r where r.owner_user_id = u.id and r.active and r.next_date < p_today;
    if n_overdue > 0 then
      lines := lines || ('Overdue: ' || names);
      go_to := '/bills';
    end if;
    select count(*), string_agg(r.name || ' ' || public.push_money(r.amount, cur), ', ' order by r.name)
      into n_bills, names
      from public.recurring_items r where r.owner_user_id = u.id and r.active and r.next_date = p_today;
    if n_bills > 0 then
      lines := lines || ('Due today: ' || names);
      go_to := coalesce(go_to, '/bills');
    end if;
    select count(*), string_agg(r.name || ' ' || public.push_money(r.amount, cur), ', ' order by r.name)
      into n_bills, names
      from public.recurring_items r where r.owner_user_id = u.id and r.active and r.next_date = p_today + 1;
    if n_bills > 0 then
      lines := lines || ('Due tomorrow: ' || names);
      go_to := coalesce(go_to, '/bills');
    end if;

    -- Credit card bills: only a real bill (made on the last statement date,
    -- not yet paid off), due today, in 2 days, or already past due.
    select string_agg(
             a.name || ' bill ' || public.push_money(b.due, cur) || ' ' ||
             case when b.due_date < p_today then 'overdue since ' || to_char(b.due_date, 'FMMon FMDD')
                  when b.due_date = p_today then 'due today'
                  else 'due ' || to_char(b.due_date, 'FMMon FMDD') end,
             ', ' order by b.due_date, a.name)
      into names
      from public.accounts a
      cross join lateral public.push_card_bill(u.id, a.name, a.opening_balance, a.statement_day, a.due_day, p_today) b
      where a.owner_user_id = u.id and a.kind = 'credit_card' and a.closed_at is null
        and a.statement_day is not null and a.due_day is not null
        and b.due > 0 and b.due_date <= p_today + 2;
    if names is not null then
      lines := lines || names;
      go_to := coalesce(go_to, '/bills');
    end if;

    if exists (
      select 1 from public.user_settings us
      where us.owner_user_id = u.id and us.salary_day is not null
        and coalesce(us.salary_confirmed_month, '') <> to_char(p_today, 'YYYY-MM')
        and extract(day from p_today)::int >= least(us.salary_day,
              extract(day from (date_trunc('month', p_today) + interval '1 month - 1 day'))::int)
    ) then
      lines := lines || 'Did your salary arrive? Tap to confirm.'::text;
      go_to := coalesce(go_to, '/');
    end if;

    select string_agg(case when i.direction = 'lent'
                        then i.person || ' should pay you back ' || public.push_money(i.left_amount, cur)
                        else 'Pay back ' || i.person || ' ' || public.push_money(i.left_amount, cur) end, ', ')
      into names
      from (
        select x.person, x.direction, x.amount - coalesce((select sum(p.amount) from public.iou_payments p where p.iou_id = x.id), 0) as left_amount
        from public.ious x
        where x.owner_user_id = u.id and x.due_date is not null and x.due_date <= p_today
      ) i
      where i.left_amount > 0;
    if names is not null then
      lines := lines || names;
      go_to := coalesce(go_to, '/lent');
    end if;

    if array_length(lines, 1) > 0 then
      owner_user_id := u.id;
      title := case when n_overdue > 0 then 'Payment overdue' else 'Today in LedgeEaze' end;
      body := array_to_string(lines[1:4], E'\n');
      url := coalesce(go_to, '/');
      return next;
    end if;
  end loop;
end;
$$;
revoke execute on function public.push_digest(date) from public, anon, authenticated;
grant execute on function public.push_digest(date) to service_role;

-- ===== Admin actions from the Admin page (2026-09-30_admin_actions.sql); admin_audit has no policies/grants =====
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('grant_admin', 'revoke_admin', 'delete_user', 'reset_password')),
  target_user_id uuid,
  target_email text,
  created_at timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
-- No policies and no grants: only reachable through the functions below.
revoke all on public.admin_audit from anon, authenticated;

create or replace function public.admin_log(p_action text, p_user uuid, p_email text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.admin_audit (admin_user_id, action, target_user_id, target_email)
  values (auth.uid(), p_action, p_user, p_email);
$$;
revoke execute on function public.admin_log(text, uuid, text) from public, anon, authenticated;

create or replace function public.admin_grant_admin(p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select email into v_email from auth.users where id = p_user;
  if v_email is null then
    raise exception 'User not found';
  end if;
  insert into public.admin_users (user_id) values (p_user) on conflict do nothing;
  perform public.admin_log('grant_admin', p_user, v_email);
end;
$$;
revoke execute on function public.admin_grant_admin(uuid) from public, anon;
grant execute on function public.admin_grant_admin(uuid) to authenticated;

create or replace function public.admin_revoke_admin(p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.admin_users) <= 1 and exists (select 1 from public.admin_users where user_id = p_user) then
    raise exception 'There must always be at least one admin' using errcode = 'P0001';
  end if;
  delete from public.admin_users where user_id = p_user;
  perform public.admin_log('revoke_admin', p_user, (select email from auth.users where id = p_user));
end;
$$;
revoke execute on function public.admin_revoke_admin(uuid) from public, anon;
grant execute on function public.admin_revoke_admin(uuid) to authenticated;

-- Deletes the account and (by the owner_user_id cascades) all of its data,
-- exactly like delete_own_account() does for the user themselves.
create or replace function public.admin_delete_user(p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t delete your own account here' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.admin_users where user_id = p_user) then
    raise exception 'Remove their admin role first' using errcode = 'P0001';
  end if;
  select email into v_email from auth.users where id = p_user;
  if v_email is null then
    raise exception 'User not found';
  end if;
  perform public.admin_log('delete_user', p_user, v_email);
  delete from auth.users where id = p_user;
end;
$$;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- The reset email itself is sent by Supabase Auth from the admin's browser
-- (resetPasswordForEmail); this only records that it was sent.
create or replace function public.admin_note_reset_sent(p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform public.admin_log('reset_password', p_user, (select email from auth.users where id = p_user));
end;
$$;
revoke execute on function public.admin_note_reset_sent(uuid) from public, anon;
grant execute on function public.admin_note_reset_sent(uuid) to authenticated;

create or replace function public.admin_audit_log(p_limit int default 50)
returns table (created_at timestamptz, action text, admin_email text, target_email text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select a.created_at, a.action, u.email::text, a.target_email
  from public.admin_audit a left join auth.users u on u.id = a.admin_user_id
  order by a.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;
revoke execute on function public.admin_audit_log(int) from public, anon;
grant execute on function public.admin_audit_log(int) to authenticated;

-- ===== Share with everyone, per entry (2026-09-30_transaction_sharing.sql); policies in policies.sql =====
alter table public.transactions add column if not exists shared boolean not null default true;

-- ===== No negative balances (migration 2026-09-30_no_negative_balances.sql) =====

alter table public.user_settings
  add constraint user_settings_net_worth_not_negative
  check ((assets_total is null or assets_total >= 0) and (liabilities_total is null or liabilities_total >= 0));

-- ===== Birthdays, bell notes pushed to phones, announcements in the bell (migration 2026-09-30_birthdays_push_everything.sql) =====
-- ===== user_settings =====
-- Opt-in (date of birth was promised private): on your birthday the people
-- you share with (approved, either direction) get a note to wish you. Only
-- the day is used, never the year.
alter table public.user_settings add column if not exists share_birthday boolean not null default false;
-- The Home checklist version the user last hid; a release that adds a step
-- bumps SETUP_CHECKLIST_VERSION (src/lib/setupChecklist.ts) and the card
-- comes back while that new step isn't done.
alter table public.user_settings add column if not exists setup_checklist_version smallint not null default 1;

-- ===== notification kinds =====
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'access_request', 'access_approved', 'access_declined', 'feedback_reply', 'split_added', 'split_settled',
  'budget', 'bill_overdue', 'reminder', 'salary', 'birthday', 'announcement'
]));

-- ===== Birthdays: filed by the daily 9 AM run (send-reminders) =====
-- A 29 Feb birthday is on 28 Feb in other years. Returns how many notes were new.
create or replace function public.file_birthday_notifications(p_today date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leap boolean := extract(day from (make_date(extract(year from p_today)::int, 3, 1) - 1)) = 29;
  v_year text := extract(year from p_today)::int::text;
  v_self integer;
  v_others integer;
begin
  -- The birthday person.
  with bday as (
    select s.owner_user_id as user_id,
           coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as name
      from public.user_settings s
      join public.profiles p on p.id = s.owner_user_id
     where s.date_of_birth is not null
       and (to_char(s.date_of_birth, 'MM-DD') = to_char(p_today, 'MM-DD')
            or (to_char(s.date_of_birth, 'MM-DD') = '02-29' and not v_leap and to_char(p_today, 'MM-DD') = '02-28'))
  )
  insert into public.notifications (owner_user_id, kind, title, body, url, ref)
  select b.user_id, 'birthday', 'Happy birthday, ' || b.name || '! 🎂', 'Wishing you a lovely year ahead.', '/',
         'birthday:self:' || v_year
    from bday b
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_self = row_count;

  -- The people they share with (approved, either direction), only if they said yes.
  with bday as (
    select s.owner_user_id as user_id,
           coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as name
      from public.user_settings s
      join public.profiles p on p.id = s.owner_user_id
     where s.date_of_birth is not null and s.share_birthday
       and (to_char(s.date_of_birth, 'MM-DD') = to_char(p_today, 'MM-DD')
            or (to_char(s.date_of_birth, 'MM-DD') = '02-29' and not v_leap and to_char(p_today, 'MM-DD') = '02-28'))
  ), pairs as (
    select distinct b.user_id, b.name,
           case when va.owner_user_id = b.user_id then va.requester_user_id else va.owner_user_id end as other_id
      from bday b
      join public.viewer_access va
        on va.status = 'approved' and (va.owner_user_id = b.user_id or va.requester_user_id = b.user_id)
  )
  insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
  select other_id, 'birthday', 'It’s ' || name || '’s birthday today 🎂', 'Send them a wish.', '/shared',
         'birthday:' || user_id || ':' || v_year, user_id
    from pairs
   where other_id <> user_id
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_others = row_count;
  return v_self + v_others;
end;
$$;
revoke execute on function public.file_birthday_notifications(date) from public, anon, authenticated;
grant execute on function public.file_birthday_notifications(date) to service_role;

-- ===== Announcements: a live one goes in everyone's bell =====
create or replace function public.app_announcements_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active and (new.ends_at is null or new.ends_at > now()) then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    select u.id, 'announcement', '📣 ' || left(new.message, 190), null, '/', 'announcement:' || new.id, new.created_by
      from auth.users u
    on conflict (owner_user_id, ref) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.app_announcements_notify() from public, anon, authenticated;
drop trigger if exists app_announcements_notify on public.app_announcements;
create trigger app_announcements_notify
  after insert or update of active on public.app_announcements
  for each row execute function public.app_announcements_notify();

-- ===== Every bell note also goes to the phone =====
-- A queued pg_net call (doesn't slow the insert) to send-reminders, which
-- checks the Vault cron secret, re-reads the note and pushes it to that
-- person's devices. The daily reminder already pushes itself; people with no
-- device turned on are skipped here.
create or replace function public.notifications_push_to_device()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind <> 'reminder'
     and exists (select 1 from public.push_subscriptions s where s.owner_user_id = new.owner_user_id) then
    perform net.http_post(
      url := 'https://izidxazhknyoxeqgnqdb.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
      ),
      body := jsonb_build_object('notificationId', new.id),
      timeout_milliseconds := 10000
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.notifications_push_to_device() from public, anon, authenticated;
drop trigger if exists notifications_push_to_device on public.notifications;
create trigger notifications_push_to_device
  after insert on public.notifications
  for each row execute function public.notifications_push_to_device();

-- ===== Money reminders, blurred private rows, Today period (migration 2026-09-30_reminders_private_rows_today.sql); money_reminders policies in policies.sql =====
-- ===== "Today" in the period filter =====
alter table public.user_settings drop constraint user_settings_selected_period_check;
alter table public.user_settings add constraint user_settings_selected_period_check check (
  selected_period in ('all-time', 'today', 'this-month', 'last-month', 'last-3-months', 'last-6-months', 'this-year')
);

-- ===== Money reminders: "send ₹500 to Mom on the 5th" =====
-- Own-only (not shared with viewers), like budgets. A note lands in the bell
-- (and so on phones) on the due day, filed by the daily 9 AM run.
create table if not exists public.money_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  amount numeric(14, 2) check (amount is null or amount > 0),
  due_date date not null,
  note text check (note is null or char_length(note) <= 200),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists money_reminders_owner_due_idx on public.money_reminders (owner_user_id, due_date);

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'access_request', 'access_approved', 'access_declined', 'feedback_reply', 'split_added', 'split_settled',
  'budget', 'bill_overdue', 'reminder', 'salary', 'birthday', 'announcement', 'money_reminder'
]));

-- Called by send-reminders' daily run. One note per reminder, on its due day.
create or replace function public.file_money_reminder_notifications(p_today date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (owner_user_id, kind, title, body, url, ref)
  select r.owner_user_id, 'money_reminder',
         'Time to send ' || coalesce(public.push_money(r.amount, coalesce(us.currency, 'INR')), 'money') || ': ' || btrim(r.title),
         r.note, '/bills', 'send:' || r.id || ':' || r.due_date
    from public.money_reminders r
    left join public.user_settings us on us.owner_user_id = r.owner_user_id
   where r.done_at is null and r.due_date = p_today
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.file_money_reminder_notifications(date) from public, anon, authenticated;
grant execute on function public.file_money_reminder_notifications(date) to service_role;

-- ===== Private entries show as blurred rows to the people who share with you =====
-- An entry its owner kept to themselves (transactions.shared = false) stays
-- unreadable (RLS); this returns only that one exists: its id, owner and date
-- -- never the merchant, amount, category or account.
create or replace function public.private_entries_shared_with_me(p_from date, p_to date)
returns table (id uuid, owner_user_id uuid, date date)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.owner_user_id, t.date
    from public.transactions t
    join public.viewer_access va
      on va.owner_user_id = t.owner_user_id and va.requester_user_id = auth.uid() and va.status = 'approved'
   where not t.shared
     and (p_from is null or t.date >= p_from)
     and t.date <= p_to
   order by t.date desc
   limit 300
$$;
revoke execute on function public.private_entries_shared_with_me(date, date) from public, anon;
grant execute on function public.private_entries_shared_with_me(date, date) to authenticated;

-- ===== Birthday note on by default (migration 2026-09-30_birthday_note_default_on.sql) =====
alter table public.user_settings alter column share_birthday set default true;
update public.user_settings set share_birthday = true where not share_birthday;

-- ===== Birthday fun facts (migration 2026-09-30_zodiac_facts.sql); zodiac_facts policy in policies.sql =====
create table if not exists public.zodiac_facts (
  id smallint generated always as identity primary key,
  sign text not null check (sign in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')),
  fact text not null check (char_length(fact) between 10 and 200)
);

insert into public.zodiac_facts (sign, fact) values
  ('aries', 'Aries is the first sign of the zodiac, so your year is said to start with a bang.'),
  ('aries', 'Aries is ruled by Mars, the planet of drive: famous for starting things first.'),
  ('aries', 'The ram''s symbol ♈ is drawn to look like a ram''s horns.'),
  ('aries', 'Aries is a fire sign: known for courage and quick decisions.'),
  ('aries', 'The Sun enters Aries around the spring equinox, when days and nights are equal.'),
  ('taurus', 'Taurus is ruled by Venus: said to love comfort, good food and nice things.'),
  ('taurus', 'Taurus is an earth sign, known for being steady, patient and reliable.'),
  ('taurus', 'The Pleiades star cluster sits inside the constellation Taurus.'),
  ('taurus', 'Taurus is famously loyal: slow to change their mind, and good at saving.'),
  ('taurus', 'The bull''s brightest star, Aldebaran, is one of the brightest in the night sky.'),
  ('gemini', 'Gemini is ruled by Mercury, the messenger: quick talkers and quick learners.'),
  ('gemini', 'The twins are Castor and Pollux, also the names of Gemini''s two brightest stars.'),
  ('gemini', 'Gemini is an air sign: curious, chatty and always up for something new.'),
  ('gemini', 'Geminis are said to juggle many interests at once, and enjoy it.'),
  ('gemini', 'The Geminid meteor shower every December seems to come out of Gemini.'),
  ('cancer', 'Cancer is ruled by the Moon: said to be caring, protective and home-loving.'),
  ('cancer', 'Cancer is a water sign, known for feeling things deeply.'),
  ('cancer', 'The Tropic of Cancer is named after this sign.'),
  ('cancer', 'The crab carries its home on its back, and Cancers love a cosy home.'),
  ('cancer', 'Cancers are said to have great memories, especially for the people they love.'),
  ('leo', 'Leo is ruled by the Sun itself: warm, generous and hard to miss.'),
  ('leo', 'Leo is a fire sign, known for confidence and a big heart.'),
  ('leo', 'Leo''s brightest star, Regulus, means "little king".'),
  ('leo', 'Leos are said to love celebrations, so a birthday is their season.'),
  ('leo', 'The Leonid meteor shower every November seems to come out of Leo.'),
  ('virgo', 'Virgo is ruled by Mercury: sharp-minded, practical and great with details.'),
  ('virgo', 'Virgo is the largest zodiac constellation in the sky.'),
  ('virgo', 'Virgo is an earth sign, known for being helpful and well organised.'),
  ('virgo', 'Spica, Virgo''s brightest star, is actually two stars circling each other.'),
  ('virgo', 'Virgos are said to make the best planners, budgets included.'),
  ('libra', 'Libra is the only zodiac sign whose symbol is an object: the scales.'),
  ('libra', 'Libra is ruled by Venus: said to love beauty, fairness and harmony.'),
  ('libra', 'Libra is an air sign, known for charm and being a good listener.'),
  ('libra', 'The Sun enters Libra around the autumn equinox, another day of balance.'),
  ('libra', 'Libras are said to weigh every option before choosing.'),
  ('scorpio', 'Scorpio is a water sign known for loyalty and strong feelings.'),
  ('scorpio', 'Scorpio''s bright red star Antares is often called the heart of the scorpion.'),
  ('scorpio', 'Scorpios are said to be great at keeping secrets.'),
  ('scorpio', 'Scorpio is traditionally ruled by Mars and, in modern astrology, by Pluto.'),
  ('scorpio', 'Scorpios are known for their focus: once they decide, they go all in.'),
  ('sagittarius', 'Sagittarius is ruled by Jupiter, the largest planet: big dreams, big laughs.'),
  ('sagittarius', 'Look towards Sagittarius and you are looking at the centre of our galaxy.'),
  ('sagittarius', 'Sagittarius is a fire sign, known for loving travel and adventure.'),
  ('sagittarius', 'The archer''s stars form a shape often called "the Teapot".'),
  ('sagittarius', 'Sagittarians are said to be the most optimistic sign.'),
  ('capricorn', 'Capricorn is ruled by Saturn: patient, hard-working and goal-driven.'),
  ('capricorn', 'The Tropic of Capricorn is named after this sign.'),
  ('capricorn', 'Capricorn is an earth sign, known for being careful with money.'),
  ('capricorn', 'The sea-goat symbol is half goat, half fish: at home anywhere.'),
  ('capricorn', 'Capricorns are said to get better with age, like good tea.'),
  ('aquarius', 'Aquarius is an air sign known for original ideas and independent thinking.'),
  ('aquarius', 'Aquarius is the water bearer, yet it is an air sign, not a water sign.'),
  ('aquarius', 'Aquarius is traditionally ruled by Saturn and, in modern astrology, by Uranus.'),
  ('aquarius', 'Aquarians are said to be great friends: loyal and a little unusual.'),
  ('aquarius', 'Several meteor showers each year seem to come out of Aquarius.'),
  ('pisces', 'Pisces is the last sign of the zodiac, said to carry a bit of every sign.'),
  ('pisces', 'Pisces is a water sign known for kindness and imagination.'),
  ('pisces', 'The two fish in the Pisces symbol are tied together by a cord.'),
  ('pisces', 'Pisces is traditionally ruled by Jupiter and, in modern astrology, by Neptune.'),
  ('pisces', 'Pisceans are said to be the most creative and caring sign.');

-- Sun sign for a date of birth (tropical dates).
create or replace function public.zodiac_for(p_dob date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when md >= '03-21' and md <= '04-19' then 'aries'
    when md >= '04-20' and md <= '05-20' then 'taurus'
    when md >= '05-21' and md <= '06-20' then 'gemini'
    when md >= '06-21' and md <= '07-22' then 'cancer'
    when md >= '07-23' and md <= '08-22' then 'leo'
    when md >= '08-23' and md <= '09-22' then 'virgo'
    when md >= '09-23' and md <= '10-22' then 'libra'
    when md >= '10-23' and md <= '11-21' then 'scorpio'
    when md >= '11-22' and md <= '12-21' then 'sagittarius'
    when md >= '12-22' or md <= '01-19' then 'capricorn'
    when md >= '01-20' and md <= '02-18' then 'aquarius'
    else 'pisces'
  end
  from (select to_char(p_dob, 'MM-DD') as md) d
$$;

-- The birthday note now carries a random fact for the person's sign (their
-- chosen horoscope in Personal details, else worked out from the date).
create or replace function public.file_birthday_notifications(p_today date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leap boolean := extract(day from (make_date(extract(year from p_today)::int, 3, 1) - 1)) = 29;
  v_year text := extract(year from p_today)::int::text;
  v_self integer;
  v_others integer;
begin
  with bday as (
    select s.owner_user_id as user_id,
           coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as name,
           coalesce(s.zodiac_sign, public.zodiac_for(s.date_of_birth)) as sign
      from public.user_settings s
      join public.profiles p on p.id = s.owner_user_id
     where s.date_of_birth is not null
       and (to_char(s.date_of_birth, 'MM-DD') = to_char(p_today, 'MM-DD')
            or (to_char(s.date_of_birth, 'MM-DD') = '02-29' and not v_leap and to_char(p_today, 'MM-DD') = '02-28'))
  )
  insert into public.notifications (owner_user_id, kind, title, body, url, ref)
  select b.user_id, 'birthday', 'Happy birthday, ' || b.name || '! 🎂',
         coalesce('Fun fact: ' || (select f.fact from public.zodiac_facts f where f.sign = b.sign order by random() limit 1),
                  'Wishing you a lovely year ahead.'),
         '/', 'birthday:self:' || v_year
    from bday b
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_self = row_count;

  with bday as (
    select s.owner_user_id as user_id,
           coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as name
      from public.user_settings s
      join public.profiles p on p.id = s.owner_user_id
     where s.date_of_birth is not null and s.share_birthday
       and (to_char(s.date_of_birth, 'MM-DD') = to_char(p_today, 'MM-DD')
            or (to_char(s.date_of_birth, 'MM-DD') = '02-29' and not v_leap and to_char(p_today, 'MM-DD') = '02-28'))
  ), pairs as (
    select distinct b.user_id, b.name,
           case when va.owner_user_id = b.user_id then va.requester_user_id else va.owner_user_id end as other_id
      from bday b
      join public.viewer_access va
        on va.status = 'approved' and (va.owner_user_id = b.user_id or va.requester_user_id = b.user_id)
  )
  insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
  select other_id, 'birthday', 'It’s ' || name || '’s birthday today 🎂', 'Send them a wish.', '/shared',
         'birthday:' || user_id || ':' || v_year, user_id
    from pairs
   where other_id <> user_id
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_others = row_count;
  return v_self + v_others;
end;
$$;
revoke execute on function public.file_birthday_notifications(date) from public, anon, authenticated;
grant execute on function public.file_birthday_notifications(date) to service_role;

-- ===== Lent & borrowed pay-back dates in the bell (migration 2026-10-01_iou_due_notes.sql) =====
create or replace function public.file_money_reminder_notifications(p_today date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_ious integer;
begin
  insert into public.notifications (owner_user_id, kind, title, body, url, ref)
  select r.owner_user_id, 'money_reminder',
         'Time to send ' || coalesce(public.push_money(r.amount, coalesce(us.currency, 'INR')), 'money') || ': ' || btrim(r.title),
         r.note, '/bills', 'send:' || r.id || ':' || r.due_date
    from public.money_reminders r
    left join public.user_settings us on us.owner_user_id = r.owner_user_id
   where r.done_at is null and r.due_date = p_today
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_count = row_count;

  insert into public.notifications (owner_user_id, kind, title, body, url, ref)
  select i.owner_user_id, 'money_reminder',
         case when i.direction = 'lent'
              then btrim(i.person) || ' should pay you back ' || public.push_money(i.left_amount, coalesce(us.currency, 'INR')) || ' today'
              else 'Pay back ' || btrim(i.person) || ' ' || public.push_money(i.left_amount, coalesce(us.currency, 'INR')) || ' today' end,
         i.note, '/lent', 'iou:' || i.id || ':' || i.due_date
    from (
      select x.*, x.amount - coalesce((select sum(p.amount) from public.iou_payments p where p.iou_id = x.id), 0) as left_amount
        from public.ious x
       where x.due_date = p_today
    ) i
    left join public.user_settings us on us.owner_user_id = i.owner_user_id
   where i.left_amount > 0
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_ious = row_count;
  return v_count + v_ious;
end;
$$;
revoke execute on function public.file_money_reminder_notifications(date) from public, anon, authenticated;
grant execute on function public.file_money_reminder_notifications(date) to service_role;

-- ===== Card bill paid from (migration 2026-10-01_card_bill_pay_from.sql) =====
alter table public.accounts add column if not exists bill_pay_account text;

create or replace function public.set_card_pay_from(p_account text, p_from text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_from_kind text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select kind into v_kind from public.accounts where owner_user_id = auth.uid() and name = p_account;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_kind <> 'credit_card' then
    raise exception 'Only a credit card has a bill to pay';
  end if;
  if p_from is not null then
    select kind into v_from_kind from public.accounts where owner_user_id = auth.uid() and name = p_from;
    if not found then
      raise exception 'Account not found';
    end if;
    if v_from_kind = 'credit_card' then
      raise exception 'Pay a card bill from a bank, cash or wallet account';
    end if;
  end if;
  update public.accounts set bill_pay_account = p_from where owner_user_id = auth.uid() and name = p_account;
end;
$$;
revoke execute on function public.set_card_pay_from(text, text) from public, anon;
grant execute on function public.set_card_pay_from(text, text) to authenticated;

-- ===== Salary toward the next month (migration 2026-10-01_salary_next_month.sql) =====
alter table public.user_settings add column if not exists salary_next_month boolean not null default false;

-- ===== Money to send: log the entry on Sent (migration 2026-10-01_money_reminder_log.sql) =====
alter table public.money_reminders add column if not exists log_entry boolean not null default false;
alter table public.money_reminders add column if not exists account text;
alter table public.money_reminders add column if not exists payment_method text;
alter table public.money_reminders add column if not exists category text;
alter table public.money_reminders drop constraint if exists money_reminders_log_entry_check;
alter table public.money_reminders add constraint money_reminders_log_entry_check
  check (not log_entry or (account is not null and amount is not null));
