-- Friend profiles: a short "About you" line on profiles (friends can read it
-- through the existing profiles_select_own_or_connected policy), and the
-- friend's birthday (day and month only) when they share it.
alter table public.profiles add column if not exists bio text;
alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length check (bio is null or char_length(bio) <= 160);
grant update (bio) on public.profiles to authenticated;

-- A friend's birthday as 'MM-DD' (never the year), only when they share it and
-- one of you sees the other's entries (an approved connection either way).
create or replace function public.friend_birthday(p_friend uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select to_char(s.date_of_birth, 'MM-DD')
    from public.user_settings s
   where s.owner_user_id = p_friend
     and p_friend <> auth.uid()
     and s.share_birthday
     and s.date_of_birth is not null
     and exists (
       select 1 from public.viewer_access v
        where v.status = 'approved'
          and ((v.requester_user_id = auth.uid() and v.owner_user_id = p_friend)
            or (v.requester_user_id = p_friend and v.owner_user_id = auth.uid()))
     );
$$;
revoke execute on function public.friend_birthday(uuid) from public, anon;
grant execute on function public.friend_birthday(uuid) to authenticated;
