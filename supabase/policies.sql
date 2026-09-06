-- Ledgerly Row Level Security policies.
-- Apply after schema.sql. Safe to re-run (drops + recreates each policy).

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.tags enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.recurring_items enable row level security;
alter table public.dismissed_patterns enable row level security;
alter table public.documents enable row level security;
alter table public.rules enable row level security;
alter table public.user_settings enable row level security;

-- ---- profiles: everyone (any signed-in user) can read every profile so
-- ---- "owner" display names can be shown on shared transactions; only the
-- ---- owner can create/update their own row.
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---- categories / accounts / tags: shared, additive-only lookup lists.
-- ---- Any authenticated user can read and add; nobody can update/delete in v1
-- ---- (no policy for those actions == PostgREST returns a permission error).
drop policy if exists categories_select_all on public.categories;
create policy categories_select_all on public.categories for select
  using (auth.role() = 'authenticated');
drop policy if exists categories_insert_auth on public.categories;
create policy categories_insert_auth on public.categories for insert
  with check (auth.role() = 'authenticated');

drop policy if exists accounts_select_all on public.accounts;
create policy accounts_select_all on public.accounts for select
  using (auth.role() = 'authenticated');
drop policy if exists accounts_insert_auth on public.accounts;
create policy accounts_insert_auth on public.accounts for insert
  with check (auth.role() = 'authenticated');

drop policy if exists tags_select_all on public.tags;
create policy tags_select_all on public.tags for select
  using (auth.role() = 'authenticated');
drop policy if exists tags_insert_auth on public.tags;
create policy tags_insert_auth on public.tags for insert
  with check (auth.role() = 'authenticated');

-- ---- transactions: THE core "everyone sees everyone's spending" rule.
-- ---- Any authenticated user can read every transaction; only the owner
-- ---- can insert/update/delete their own rows.
drop policy if exists transactions_select_all on public.transactions;
create policy transactions_select_all on public.transactions for select
  using (auth.role() = 'authenticated');

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own on public.transactions for update
  using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_delete_own on public.transactions for delete
  using (auth.uid() = owner_user_id);

-- ---- budgets / goals / recurring_items / dismissed_patterns / documents / rules /
-- ---- user_settings: strictly private, own-only for every operation.
do $$
declare
  t text;
begin
  foreach t in array array['budgets','goals','recurring_items','documents','rules']
  loop
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format(
      'create policy %I_select_own on public.%I for select using (auth.uid() = owner_user_id)', t, t
    );
    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format(
      'create policy %I_insert_own on public.%I for insert with check (auth.uid() = owner_user_id)', t, t
    );
    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format(
      'create policy %I_update_own on public.%I for update using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id)', t, t
    );
    execute format('drop policy if exists %I_delete_own on public.%I', t, t);
    execute format(
      'create policy %I_delete_own on public.%I for delete using (auth.uid() = owner_user_id)', t, t
    );
  end loop;
end $$;

-- dismissed_patterns has no update policy (rows are only ever inserted/deleted).
drop policy if exists dismissed_patterns_select_own on public.dismissed_patterns;
create policy dismissed_patterns_select_own on public.dismissed_patterns for select
  using (auth.uid() = owner_user_id);
drop policy if exists dismissed_patterns_insert_own on public.dismissed_patterns;
create policy dismissed_patterns_insert_own on public.dismissed_patterns for insert
  with check (auth.uid() = owner_user_id);
drop policy if exists dismissed_patterns_delete_own on public.dismissed_patterns;
create policy dismissed_patterns_delete_own on public.dismissed_patterns for delete
  using (auth.uid() = owner_user_id);

-- user_settings: select/insert/update only (rows are never deleted, only reset).
drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings for select
  using (auth.uid() = owner_user_id);
drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings for insert
  with check (auth.uid() = owner_user_id);
drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings for update
  using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

-- ================= Storage (documents bucket) =================
-- Create the bucket once (private -- not publicly readable).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Objects must be uploaded under `uploads/<owner_user_id>/...` so ownership
-- can be checked from the path itself, the same way table RLS checks owner_user_id.
drop policy if exists documents_storage_select_own on storage.objects;
create policy documents_storage_select_own on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists documents_storage_insert_own on storage.objects;
create policy documents_storage_insert_own on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists documents_storage_delete_own on storage.objects;
create policy documents_storage_delete_own on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[2] = auth.uid()::text);

-- ================= Storage (avatars bucket) =================
-- Public bucket -- profile pictures must be viewable by every user (they show
-- up on shared transactions), unlike the private documents bucket above.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Objects live at `<owner_user_id>/<uuid>-<safe-filename>` so ownership is
-- checked straight from the path, same pattern as the documents bucket.
drop policy if exists avatars_storage_select_all on storage.objects;
create policy avatars_storage_select_all on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_storage_insert_own on storage.objects;
create policy avatars_storage_insert_own on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_storage_update_own on storage.objects;
create policy avatars_storage_update_own on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_storage_delete_own on storage.objects;
create policy avatars_storage_delete_own on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
