-- Run this in the Supabase SQL editor right before deploying the app build
-- that knows about savings/current accounts and debit cards, then run
-- supabase/tests/security_regression.sql and expect ALL SECURITY CHECKS PASSED.
-- Safe to re-run. Mirrored into schema.sql (appended) and policies.sql.
--
-- 1. Account kinds: 'bank' splits into 'savings' and 'current'. Existing
--    'bank' rows become 'savings' (a leftover 'bank' row named 'Cash' becomes
--    'cash'); new signups' seeded accounts get their kind up front.
-- 2. Debit cards are their own table, each drawing from one savings/current
--    account. A transaction paid with one records debit_card_id and stays on
--    that account, so the account's balance still includes it.
-- 3. convert_account_to_debit_card() turns an account that was really a debit
--    card (e.g. "HDFC Debit Card") into a debit card on the real account.
-- 4. Closed accounts (accounts.closed_at, already live): no new debit card can
--    draw from one; closing an account keeps its cards (the app hides them).
-- 5. Cash is always kept: every user has an open cash account, and the last one
--    can't be deleted, closed or changed to another kind.

-- ===== schema =====

-- Already live (closed accounts); repeated so this file also runs on a
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

-- ===== policies and grants =====

-- Debit cards are private: own-only for every operation, even when
-- transactions are shared (a viewer just sees "Debit card" as the method).
alter table public.debit_cards enable row level security;

drop policy if exists debit_cards_select_own on public.debit_cards;
create policy debit_cards_select_own on public.debit_cards for select to authenticated
  using (owner_user_id = auth.uid());
drop policy if exists debit_cards_insert_own on public.debit_cards;
create policy debit_cards_insert_own on public.debit_cards for insert to authenticated
  with check (owner_user_id = auth.uid());
drop policy if exists debit_cards_update_own on public.debit_cards;
create policy debit_cards_update_own on public.debit_cards for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
drop policy if exists debit_cards_delete_own on public.debit_cards;
create policy debit_cards_delete_own on public.debit_cards for delete to authenticated
  using (owner_user_id = auth.uid());

revoke all on public.debit_cards from anon, authenticated;
grant select, insert, delete on public.debit_cards to authenticated;
grant update (name, last4, account) on public.debit_cards to authenticated;
