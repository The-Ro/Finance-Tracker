-- Forgot password: say plainly when no account uses that email (user request)
-- instead of Supabase's deliberately silent "if an account exists" reply.
--
-- Trade-off, accepted by the owner: anyone can learn whether an email has a
-- LedgeEaze account. Kept as narrow as possible: exact, case-insensitive
-- match on one email; returns only true/false; no names or other data. This
-- is the ONLY SECURITY DEFINER function anon may call -- the security suite
-- allows exactly this one.
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
