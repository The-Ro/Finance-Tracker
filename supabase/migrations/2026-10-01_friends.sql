-- Friends (the redesigned Sharing). viewer_access stays the one source of
-- truth (one row per direction: requester sees owner's entries when approved);
-- these narrow functions let the Friends page add a friend both ways at once,
-- share or pause your entries with someone you're already connected to, and
-- remove a friend in one step.

-- Add a friend by exact email: ask to see theirs, and (p_share_mine) share
-- yours with them straight away. Returns the friend's id.
create or replace function public.add_friend(p_email text, p_share_mine boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select u.id into target
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = lower(trim(p_email)) and u.id <> me
   order by u.created_at, u.id
   limit 1;
  if target is null then
    raise exception 'No LedgeEaze account with that exact email.' using errcode = 'P0002';
  end if;
  -- I ask to see theirs (unless I already can or already asked).
  insert into public.viewer_access (requester_user_id, owner_user_id, status)
  values (me, target, 'pending')
  on conflict (requester_user_id, owner_user_id) do nothing;
  -- They see mine.
  if p_share_mine then
    insert into public.viewer_access (requester_user_id, owner_user_id, status, responded_at)
    values (target, me, 'approved', now())
    on conflict (requester_user_id, owner_user_id)
      do update set status = 'approved', responded_at = now()
      where public.viewer_access.status <> 'approved';
  end if;
  return target;
end;
$$;
revoke execute on function public.add_friend(text, boolean) from public, anon;
grant execute on function public.add_friend(text, boolean) to authenticated;

-- Share (or pause) my entries with a friend. Only with someone already
-- connected to me either way, so a bare user id can't be used to reach a
-- stranger (a new connection would make their profile readable).
create or replace function public.set_share_with_friend(p_friend uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_friend is null or p_friend = me or not exists (
    select 1 from public.viewer_access
     where (requester_user_id = me and owner_user_id = p_friend)
        or (requester_user_id = p_friend and owner_user_id = me)
  ) then
    raise exception 'Add them as a friend first.' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.viewer_access (requester_user_id, owner_user_id, status, responded_at)
    values (p_friend, me, 'approved', now())
    on conflict (requester_user_id, owner_user_id)
      do update set status = 'approved', responded_at = now()
      where public.viewer_access.status <> 'approved';
  else
    update public.viewer_access
       set status = 'paused'
     where requester_user_id = p_friend and owner_user_id = me and status = 'approved';
  end if;
end;
$$;
revoke execute on function public.set_share_with_friend(uuid, boolean) from public, anon;
grant execute on function public.set_share_with_friend(uuid, boolean) to authenticated;

-- Remove a friend: both directions go. Splits between you stay (they're
-- money records), like before.
create or replace function public.remove_friend(p_friend uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from public.viewer_access
   where (requester_user_id = me and owner_user_id = p_friend)
      or (requester_user_id = p_friend and owner_user_id = me);
end;
$$;
revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- Notes: links go to Friends, and a share made by the owner (not a request)
-- tells the friend.
create or replace function public.notify_viewer_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.owner_user_id, 'access_request',
            coalesce(public.notify_name(new.requester_user_id), 'Someone') || ' wants to see your transactions',
            'Approve to share your transactions with them. You can stop anytime in Friends.',
            '/friends', 'access:' || new.id, new.requester_user_id)
    on conflict (owner_user_id, ref) do nothing;
  elsif tg_op = 'INSERT' and new.status = 'approved' then
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (new.requester_user_id, 'access_approved',
            coalesce(public.notify_name(new.owner_user_id), 'Someone') || ' shared their entries with you',
            'You can see them under Everyone on Activity.',
            '/transactions', 'access-approved:' || new.id, new.owner_user_id)
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
        and exists (select 1 from auth.users where id = old.owner_user_id) then
    update public.notifications set status = 'declined', read_at = coalesce(read_at, now())
     where owner_user_id = old.owner_user_id and ref = 'access:' || old.id;
    insert into public.notifications (owner_user_id, kind, title, body, url, ref, actor_user_id)
    values (old.requester_user_id, 'access_declined',
            coalesce(public.notify_name(old.owner_user_id), 'Someone') || ' said no to sharing',
            'Your request to see their transactions was declined.',
            '/friends', 'access-declined:' || old.id, old.owner_user_id)
    on conflict (owner_user_id, ref) do nothing;
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.notify_viewer_access() from public, anon, authenticated;
