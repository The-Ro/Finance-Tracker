-- Lent & borrowed: money you lent to someone or borrowed from them, and the
-- repayments. Private, own-only (like budgets/goals); the other person is just
-- a name, not a LedgeEaze user. It tracks who owes what and doesn't touch
-- account balances. Safe to re-run; mirrored into schema.sql and policies.sql.
-- Run supabase/tests/security_regression.sql afterwards.

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

alter table public.ious enable row level security;
alter table public.iou_payments enable row level security;

revoke all on public.ious, public.iou_payments from anon;
grant select, insert, update, delete on public.ious, public.iou_payments to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['ious', 'iou_payments']
  loop
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format('create policy %I_select_own on public.%I for select to authenticated using (auth.uid() = owner_user_id)', t, t);
    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format('create policy %I_insert_own on public.%I for insert to authenticated with check (auth.uid() = owner_user_id)', t, t);
    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format('create policy %I_update_own on public.%I for update to authenticated using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id)', t, t);
    execute format('drop policy if exists %I_delete_own on public.%I', t, t);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using (auth.uid() = owner_user_id)', t, t);
  end loop;
end $$;
