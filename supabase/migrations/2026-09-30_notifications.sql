-- Notification history: every note the bell shows is kept (All / Unread /
-- Read), instead of disappearing once it's dealt with. Safe to re-run;
-- mirrored into schema.sql and policies.sql. Run the security suite after.
--
-- Who writes rows:
-- - Triggers, for things another person does (their session can't write to
--   yours): access requests / approvals / declines, feedback replies, splits.
-- - The app itself, for your own alerts (budget near/over, bill overdue).
-- - The send-reminders Edge Function (service role), for the 9 AM reminder.
-- `ref` makes each event land once per person (unique with owner_user_id).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'access_request', 'access_approved', 'access_declined', 'feedback_reply',
    'split_added', 'split_settled', 'budget', 'bill_overdue', 'reminder')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 500),
  url text check (url is null or url like '/%'),
  ref text not null check (char_length(ref) between 1 and 200),
  actor_user_id uuid references auth.users(id) on delete set null,
  -- For access requests: what happened to it ('approved' / 'declined').
  status text check (status is null or status in ('approved', 'declined')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (owner_user_id, ref)
);
create index if not exists notifications_owner_idx on public.notifications (owner_user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant insert (owner_user_id, kind, title, body, url, ref) on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (auth.uid() = owner_user_id);
-- The app may only file its own alerts; the other kinds come from triggers.
drop policy if exists notifications_insert_own_alerts on public.notifications;
create policy notifications_insert_own_alerts on public.notifications for insert to authenticated
  with check (auth.uid() = owner_user_id and kind in ('budget', 'bill_overdue'));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (auth.uid() = owner_user_id);

-- A person's name for notification text.
create or replace function public.notify_name(p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(nullif(btrim(p.display_name), ''), p.email, 'Someone') from public.profiles p where p.id = p_user;
$$;
revoke execute on function public.notify_name(uuid) from public, anon, authenticated;

-- ===== Sharing =====
create or replace function public.notify_viewer_access()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.owner_user_id, 'access_request',
            coalesce(public.notify_name(new.requester_user_id), 'Someone') || ' wants to see your transactions',
            'Approve to share your transactions with them. You can stop anytime in Settings.',
            '/settings/sharing', 'access:' || new.id, new.requester_user_id)
    on conflict (owner_user_id, ref) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    update public.notifications set status = 'approved', read_at = coalesce(read_at, now())
     where owner_user_id = new.owner_user_id and ref = 'access:' || new.id;
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.requester_user_id, 'access_approved',
            coalesce(public.notify_name(new.owner_user_id), 'Someone') || ' said yes',
            'You can now see their transactions. Choose Everyone on Activity.',
            '/transactions', 'access-approved:' || new.id, new.owner_user_id)
    on conflict (owner_user_id, ref) do nothing;
  elsif tg_op = 'DELETE' and old.status = 'pending' and auth.uid() = old.owner_user_id
        -- not when the owner is deleting their whole account
        and exists (select 1 from auth.users where id = old.owner_user_id) then
    update public.notifications set status = 'declined', read_at = coalesce(read_at, now())
     where owner_user_id = old.owner_user_id and ref = 'access:' || old.id;
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (old.requester_user_id, 'access_declined',
            coalesce(public.notify_name(old.owner_user_id), 'Someone') || ' said no to sharing',
            'Your request to see their transactions was declined.',
            '/settings/sharing', 'access-declined:' || old.id, old.owner_user_id)
    on conflict (owner_user_id, ref) do nothing;
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.notify_viewer_access() from public, anon, authenticated;
drop trigger if exists viewer_access_notify on public.viewer_access;
create trigger viewer_access_notify after insert or update of status or delete on public.viewer_access
  for each row execute function public.notify_viewer_access();

-- ===== Feedback replies =====
create or replace function public.notify_feedback_reply()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.admin_reply is not null and new.admin_reply is distinct from old.admin_reply then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref)
    values (new.owner_user_id, 'feedback_reply', 'We replied to your feedback',
            left(new.admin_reply, 300), '/settings/feedback', 'feedback:' || new.id || ':' || md5(new.admin_reply))
    on conflict (owner_user_id, ref) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_feedback_reply() from public, anon, authenticated;
drop trigger if exists feedback_notify_reply on public.feedback;
create trigger feedback_notify_reply after update of admin_reply on public.feedback
  for each row execute function public.notify_feedback_reply();

-- ===== Splits =====
create or replace function public.notify_split()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cur text;
begin
  select coalesce(us.currency, 'INR') into cur from public.user_settings us where us.owner_user_id = new.with_user_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.with_user_id, 'split_added',
            coalesce(public.notify_name(new.owner_user_id), 'Someone') || ' split an expense with you',
            'You owe ' || public.push_money(new.amount, cur) || ' for ' || new.description || '.',
            '/shared', 'split:' || new.id, new.owner_user_id)
    on conflict (owner_user_id, ref) do nothing;
  elsif tg_op = 'UPDATE' and old.settled_at is null and new.settled_at is not null then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.with_user_id, 'split_settled',
            coalesce(public.notify_name(new.owner_user_id), 'Someone') || ' marked a split as settled',
            public.push_money(new.amount, cur) || ' for ' || new.description || ' is settled.',
            '/shared', 'split-settled:' || new.id, new.owner_user_id)
    on conflict (owner_user_id, ref) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_split() from public, anon, authenticated;
drop trigger if exists transaction_splits_notify on public.transaction_splits;
create trigger transaction_splits_notify after insert or update of settled_at on public.transaction_splits
  for each row execute function public.notify_split();

-- ===== Backfill what's open today =====
insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id, created_at)
select va.owner_user_id, 'access_request',
       coalesce(public.notify_name(va.requester_user_id), 'Someone') || ' wants to see your transactions',
       'Approve to share your transactions with them. You can stop anytime in Settings.',
       '/settings/sharing', 'access:' || va.id, va.requester_user_id, va.created_at
from public.viewer_access va where va.status = 'pending'
on conflict (owner_user_id, ref) do nothing;

insert into public.notifications (owner_user_id, kind, title, body, url, ref, created_at, read_at)
select f.owner_user_id, 'feedback_reply', 'We replied to your feedback', left(f.admin_reply, 300), '/settings/feedback',
       'feedback:' || f.id || ':' || md5(f.admin_reply), coalesce(f.replied_at, f.created_at), f.reply_seen_at
from public.feedback f where f.admin_reply is not null
on conflict (owner_user_id, ref) do nothing;
