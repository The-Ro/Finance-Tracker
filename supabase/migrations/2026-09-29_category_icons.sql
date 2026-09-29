-- Category icons, chosen in Settings -> Categories. Safe to re-run; mirrored
-- into schema.sql and policies.sql. Run supabase/tests/security_regression.sql
-- afterwards and expect ALL SECURITY CHECKS PASSED.
--
-- icon is a key from the app's icon set (src/lib/categoryIcon.ts); null = the
-- app guesses from the name. Only `icon` becomes updatable, on the user's own
-- rows: renaming stays impossible (transactions refer to categories by name).

alter table public.categories add column if not exists icon text;
alter table public.categories drop constraint if exists categories_icon_check;
alter table public.categories add constraint categories_icon_check
  check (icon is null or icon ~ '^[a-z]{2,20}$');

revoke update on public.categories from anon, authenticated;
grant update (icon) on public.categories to authenticated;

drop policy if exists categories_update_icon_own on public.categories;
create policy categories_update_icon_own on public.categories for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
