-- Ledgerly schema.
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

-- ===== global shared lookup lists (additive-only in v1) =====
create table if not exists public.categories (
  name text primary key,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  name text primary key,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  name text primary key,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ===== transactions (shared read, owner-only write) =====
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  merchant text not null,
  category text not null default 'Needs review' references public.categories(name),
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('expense','income')),
  account text not null references public.accounts(name),
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

-- ===== budgets (own-only) =====
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null references public.categories(name),
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
  category text not null references public.categories(name),
  amount numeric(12,2) not null check (amount > 0),
  cadence text not null check (cadence in ('weekly','biweekly','monthly','quarterly','annual')),
  next_date date not null,
  account text references public.accounts(name),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

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
  theme_accent text not null default 'violet' check (theme_accent in ('violet','ocean','sunset','pink','green')),
  gender text check (gender in ('male','female','prefer_not_to_say')),
  date_of_birth date,
  updated_at timestamptz not null default now()
);
alter table public.user_settings add column if not exists currency text not null default 'USD';
alter table public.user_settings add column if not exists theme_mode text not null default 'system';
alter table public.user_settings add column if not exists theme_accent text not null default 'violet';
alter table public.user_settings add column if not exists gender text;
alter table public.user_settings add column if not exists date_of_birth date;
alter table public.user_settings drop constraint if exists user_settings_theme_mode_check;
alter table public.user_settings add constraint user_settings_theme_mode_check check (theme_mode in ('light','dark','system'));
alter table public.user_settings drop constraint if exists user_settings_theme_accent_check;
alter table public.user_settings add constraint user_settings_theme_accent_check check (theme_accent in ('violet','ocean','sunset','pink','green'));
alter table public.user_settings drop constraint if exists user_settings_gender_check;
alter table public.user_settings add constraint user_settings_gender_check check (gender in ('male','female','prefer_not_to_say'));
