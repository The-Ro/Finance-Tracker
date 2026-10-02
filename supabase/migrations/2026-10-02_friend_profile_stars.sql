-- A friend's birthday (MM-DD, never the year), star sign and interests, for
-- the friend's profile sheet. Only when they share them (user_settings
-- .share_birthday, shown as "Show my birthday, star sign and interests to
-- friends") and one of you sees the other's entries (approved either way).
-- The sign is the one they picked, else worked out from their date of birth.
create or replace function public.friend_profile(p_friend uuid)
returns table (birthday text, zodiac_sign text, interests text[])
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.date_of_birth is not null then to_char(s.date_of_birth, 'MM-DD') end,
         coalesce(s.zodiac_sign, case when s.date_of_birth is not null then public.zodiac_for(s.date_of_birth) end),
         coalesce(s.interests, '{}')
    from public.user_settings s
   where s.owner_user_id = p_friend
     and p_friend <> auth.uid()
     and s.share_birthday
     and exists (
       select 1 from public.viewer_access v
        where v.status = 'approved'
          and ((v.requester_user_id = auth.uid() and v.owner_user_id = p_friend)
            or (v.requester_user_id = p_friend and v.owner_user_id = auth.uid()))
     );
$$;
revoke execute on function public.friend_profile(uuid) from public, anon;
grant execute on function public.friend_profile(uuid) to authenticated;
