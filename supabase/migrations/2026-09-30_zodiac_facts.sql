-- Birthday fun facts: one random fact about the person's star sign with the
-- "Happy birthday" note (and on Home that day), different each time. Kept in
-- the database so the note (SQL) and the app read the same list; no outside
-- horoscope API (the free ones are gone or unofficial, and would need birth dates).

create table if not exists public.zodiac_facts (
  id smallint generated always as identity primary key,
  sign text not null check (sign in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces')),
  fact text not null check (char_length(fact) between 10 and 200)
);
alter table public.zodiac_facts enable row level security;
drop policy if exists zodiac_facts_read on public.zodiac_facts;
create policy zodiac_facts_read on public.zodiac_facts for select to authenticated using (true);
revoke all on public.zodiac_facts from anon, authenticated;
grant select on public.zodiac_facts to authenticated;

insert into public.zodiac_facts (sign, fact) values
  ('aries', 'Aries is the first sign of the zodiac, so your year is said to start with a bang.'),
  ('aries', 'Aries is ruled by Mars, the planet of drive: famous for starting things first.'),
  ('aries', 'The ram''s symbol ♈ is drawn to look like a ram''s horns.'),
  ('aries', 'Aries is a fire sign: known for courage and quick decisions.'),
  ('aries', 'The Sun enters Aries around the spring equinox, when days and nights are equal.'),
  ('taurus', 'Taurus is ruled by Venus: said to love comfort, good food and nice things.'),
  ('taurus', 'Taurus is an earth sign, known for being steady, patient and reliable.'),
  ('taurus', 'The Pleiades star cluster sits inside the constellation Taurus.'),
  ('taurus', 'Taurus is famously loyal: slow to change their mind, and good at saving.'),
  ('taurus', 'The bull''s brightest star, Aldebaran, is one of the brightest in the night sky.'),
  ('gemini', 'Gemini is ruled by Mercury, the messenger: quick talkers and quick learners.'),
  ('gemini', 'The twins are Castor and Pollux, also the names of Gemini''s two brightest stars.'),
  ('gemini', 'Gemini is an air sign: curious, chatty and always up for something new.'),
  ('gemini', 'Geminis are said to juggle many interests at once, and enjoy it.'),
  ('gemini', 'The Geminid meteor shower every December seems to come out of Gemini.'),
  ('cancer', 'Cancer is ruled by the Moon: said to be caring, protective and home-loving.'),
  ('cancer', 'Cancer is a water sign, known for feeling things deeply.'),
  ('cancer', 'The Tropic of Cancer is named after this sign.'),
  ('cancer', 'The crab carries its home on its back, and Cancers love a cosy home.'),
  ('cancer', 'Cancers are said to have great memories, especially for the people they love.'),
  ('leo', 'Leo is ruled by the Sun itself: warm, generous and hard to miss.'),
  ('leo', 'Leo is a fire sign, known for confidence and a big heart.'),
  ('leo', 'Leo''s brightest star, Regulus, means "little king".'),
  ('leo', 'Leos are said to love celebrations, so a birthday is their season.'),
  ('leo', 'The Leonid meteor shower every November seems to come out of Leo.'),
  ('virgo', 'Virgo is ruled by Mercury: sharp-minded, practical and great with details.'),
  ('virgo', 'Virgo is the largest zodiac constellation in the sky.'),
  ('virgo', 'Virgo is an earth sign, known for being helpful and well organised.'),
  ('virgo', 'Spica, Virgo''s brightest star, is actually two stars circling each other.'),
  ('virgo', 'Virgos are said to make the best planners, budgets included.'),
  ('libra', 'Libra is the only zodiac sign whose symbol is an object: the scales.'),
  ('libra', 'Libra is ruled by Venus: said to love beauty, fairness and harmony.'),
  ('libra', 'Libra is an air sign, known for charm and being a good listener.'),
  ('libra', 'The Sun enters Libra around the autumn equinox, another day of balance.'),
  ('libra', 'Libras are said to weigh every option before choosing.'),
  ('scorpio', 'Scorpio is a water sign known for loyalty and strong feelings.'),
  ('scorpio', 'Scorpio''s bright red star Antares is often called the heart of the scorpion.'),
  ('scorpio', 'Scorpios are said to be great at keeping secrets.'),
  ('scorpio', 'Scorpio is traditionally ruled by Mars and, in modern astrology, by Pluto.'),
  ('scorpio', 'Scorpios are known for their focus: once they decide, they go all in.'),
  ('sagittarius', 'Sagittarius is ruled by Jupiter, the largest planet: big dreams, big laughs.'),
  ('sagittarius', 'Look towards Sagittarius and you are looking at the centre of our galaxy.'),
  ('sagittarius', 'Sagittarius is a fire sign, known for loving travel and adventure.'),
  ('sagittarius', 'The archer''s stars form a shape often called "the Teapot".'),
  ('sagittarius', 'Sagittarians are said to be the most optimistic sign.'),
  ('capricorn', 'Capricorn is ruled by Saturn: patient, hard-working and goal-driven.'),
  ('capricorn', 'The Tropic of Capricorn is named after this sign.'),
  ('capricorn', 'Capricorn is an earth sign, known for being careful with money.'),
  ('capricorn', 'The sea-goat symbol is half goat, half fish: at home anywhere.'),
  ('capricorn', 'Capricorns are said to get better with age, like good tea.'),
  ('aquarius', 'Aquarius is an air sign known for original ideas and independent thinking.'),
  ('aquarius', 'Aquarius is the water bearer, yet it is an air sign, not a water sign.'),
  ('aquarius', 'Aquarius is traditionally ruled by Saturn and, in modern astrology, by Uranus.'),
  ('aquarius', 'Aquarians are said to be great friends: loyal and a little unusual.'),
  ('aquarius', 'Several meteor showers each year seem to come out of Aquarius.'),
  ('pisces', 'Pisces is the last sign of the zodiac, said to carry a bit of every sign.'),
  ('pisces', 'Pisces is a water sign known for kindness and imagination.'),
  ('pisces', 'The two fish in the Pisces symbol are tied together by a cord.'),
  ('pisces', 'Pisces is traditionally ruled by Jupiter and, in modern astrology, by Neptune.'),
  ('pisces', 'Pisceans are said to be the most creative and caring sign.');

-- Sun sign for a date of birth (tropical dates).
create or replace function public.zodiac_for(p_dob date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when md >= '03-21' and md <= '04-19' then 'aries'
    when md >= '04-20' and md <= '05-20' then 'taurus'
    when md >= '05-21' and md <= '06-20' then 'gemini'
    when md >= '06-21' and md <= '07-22' then 'cancer'
    when md >= '07-23' and md <= '08-22' then 'leo'
    when md >= '08-23' and md <= '09-22' then 'virgo'
    when md >= '09-23' and md <= '10-22' then 'libra'
    when md >= '10-23' and md <= '11-21' then 'scorpio'
    when md >= '11-22' and md <= '12-21' then 'sagittarius'
    when md >= '12-22' or md <= '01-19' then 'capricorn'
    when md >= '01-20' and md <= '02-18' then 'aquarius'
    else 'pisces'
  end
  from (select to_char(p_dob, 'MM-DD') as md) d
$$;

-- The birthday note now carries a random fact for the person's sign (their
-- chosen horoscope in Personal details, else worked out from the date).
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
  with bday as (
    select s.owner_user_id as user_id,
           coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as name,
           coalesce(s.zodiac_sign, public.zodiac_for(s.date_of_birth)) as sign
      from public.user_settings s
      join public.profiles p on p.id = s.owner_user_id
     where s.date_of_birth is not null
       and (to_char(s.date_of_birth, 'MM-DD') = to_char(p_today, 'MM-DD')
            or (to_char(s.date_of_birth, 'MM-DD') = '02-29' and not v_leap and to_char(p_today, 'MM-DD') = '02-28'))
  )
  insert into public.notifications (owner_user_id, kind, title, body, url, ref)
  select b.user_id, 'birthday', 'Happy birthday, ' || b.name || '! 🎂',
         coalesce('Fun fact: ' || (select f.fact from public.zodiac_facts f where f.sign = b.sign order by random() limit 1),
                  'Wishing you a lovely year ahead.'),
         '/', 'birthday:self:' || v_year
    from bday b
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_self = row_count;

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
