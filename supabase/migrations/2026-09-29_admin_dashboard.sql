-- Admin dashboard (/admin) + setup checklist. Safe to re-run; mirrored into
-- schema.sql and policies.sql. Run supabase/tests/security_regression.sql
-- afterwards and expect ALL SECURITY CHECKS PASSED.
--
-- Admin sees account info and counts only -- never anyone's transactions,
-- budgets or amounts. Every admin_* function is SECURITY DEFINER (it reads
-- auth.users and counts across users), refuses anyone who isn't is_admin(),
-- and is callable only by signed-in users.

-- ===== schema =====

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

-- ===== policies and grants =====

alter table public.app_announcements enable row level security;

drop policy if exists app_announcements_select on public.app_announcements;
create policy app_announcements_select on public.app_announcements for select to authenticated
  using ((active and (ends_at is null or ends_at > now())) or public.is_admin());
drop policy if exists app_announcements_insert_admin on public.app_announcements;
create policy app_announcements_insert_admin on public.app_announcements for insert to authenticated
  with check (public.is_admin());
drop policy if exists app_announcements_update_admin on public.app_announcements;
create policy app_announcements_update_admin on public.app_announcements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists app_announcements_delete_admin on public.app_announcements;
create policy app_announcements_delete_admin on public.app_announcements for delete to authenticated
  using (public.is_admin());

revoke all on public.app_announcements from anon, authenticated;
grant select, insert, update, delete on public.app_announcements to authenticated;
