-- 1.13.0: birthdays, every bell note on the phone, announcements in the bell,
-- and the setup checklist coming back when a release adds a step.

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
