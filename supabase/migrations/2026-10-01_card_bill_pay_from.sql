-- Which account a credit card's bill is paid from (a bank, cash or wallet
-- account). Used to pre-fill "Pay" and shown on Bills and card EMIs. Set only
-- through set_card_pay_from -- accounts has no UPDATE policy. Only read for
-- cards; a card that stops being one simply stops showing it.
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
