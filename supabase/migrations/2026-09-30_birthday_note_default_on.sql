-- Owner's call: the birthday note is on for everyone by default (it can still
-- be turned off in Settings -> Profile). Only the day is shared, never the year.
alter table public.user_settings alter column share_birthday set default true;
update public.user_settings set share_birthday = true where not share_birthday;
