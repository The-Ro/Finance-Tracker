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
revoke execute on function public.rls_auto_enable() from public;
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
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

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

insert into public.admin_users (user_id)
select id from auth.users where email = 'rohith24112@gmail.com'
on conflict (user_id) do nothing;

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
