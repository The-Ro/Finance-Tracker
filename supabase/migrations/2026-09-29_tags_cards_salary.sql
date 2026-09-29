-- Tag delete, card networks and salary. Safe to re-run; mirrored into
-- schema.sql and policies.sql. Run supabase/tests/security_regression.sql
-- afterwards and expect ALL SECURITY CHECKS PASSED.

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
