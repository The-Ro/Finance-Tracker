-- The coin mark is gold by default; Settings -> Appearance can make it follow
-- the accent theme instead (user request). Safe to re-run; mirrored into
-- schema.sql. user_settings' existing own-row update policy covers it.
alter table public.user_settings add column if not exists coin_follows_theme boolean not null default false;
