-- Admin actions from the Admin page (owner's request): make someone an admin,
-- remove an admin, delete a user, and note a password-reset email sent.
-- This deliberately reverses the old "grant admin only from the SQL editor"
-- rule, so each action is guarded and logged:
--   * every function raises 42501 unless public.is_admin();
--   * the last admin can't be removed; nobody can delete themselves or an
--     admin here (remove the admin role first);
--   * every action lands in admin_audit (read via admin_audit_log()).
-- Safe to re-run; mirrored into schema.sql and policies.sql.

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
