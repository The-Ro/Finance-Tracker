-- LedgeEaze Row Level Security policies.
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
alter table public.viewer_access enable row level security;

-- ---- profiles: readable only for your own row, anyone you share a
-- ---- viewer_access row with (either direction, any status -- so shared
-- ---- transactions and incoming/outgoing requests can show names), anyone
-- ---- you share a split with (so settled-up history keeps its names after
-- ---- a connection is revoked), and the admin. This used to be readable by
-- ---- every signed-in user (a full user directory); finding someone new now
-- ---- goes through find_profile_by_email (schema.sql), an exact-email lookup.
-- ---- Rows are created only by handle_new_user(); users can update just
-- ---- display_name/avatar -- email mirrors auth.users and isn't editable, so
-- ---- nobody can pose as another address.
drop policy if exists profiles_select_all on public.profiles;
drop policy if exists profiles_select_own_or_connected on public.profiles;
create policy profiles_select_own_or_connected on public.profiles for select to authenticated
  using (
    auth.uid() = id
    or public.is_admin()
    or exists (
      select 1 from public.viewer_access va
      where (va.requester_user_id = auth.uid() and va.owner_user_id = profiles.id)
         or (va.owner_user_id = auth.uid() and va.requester_user_id = profiles.id)
    )
    or exists (
      select 1 from public.transaction_splits s
      where (s.owner_user_id = auth.uid() and s.with_user_id = profiles.id)
         or (s.with_user_id = auth.uid() and s.owner_user_id = profiles.id)
    )
  );

drop policy if exists profiles_insert_self on public.profiles;

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

revoke insert, update on public.profiles from anon, authenticated;
grant update (display_name, avatar) on public.profiles to authenticated;

-- ---- categories / accounts / tags: personal, additive-only lookup lists.
-- ---- Only the owner can read/add/remove their own; nobody can see or touch
-- ---- another user's lists, even though transactions themselves can be shared.
drop policy if exists categories_select_all on public.categories;
drop policy if exists categories_insert_auth on public.categories;
drop policy if exists categories_select_own on public.categories;
create policy categories_select_own on public.categories for select
  using (auth.uid() = owner_user_id);
drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own on public.categories for insert
  with check (auth.uid() = owner_user_id);
drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own on public.categories for delete
  using (auth.uid() = owner_user_id);

drop policy if exists accounts_select_all on public.accounts;
drop policy if exists accounts_insert_auth on public.accounts;
drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts for select
  using (auth.uid() = owner_user_id);
drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own on public.accounts for insert
  with check (auth.uid() = owner_user_id);
drop policy if exists accounts_delete_own on public.accounts;
create policy accounts_delete_own on public.accounts for delete
  using (auth.uid() = owner_user_id);

drop policy if exists tags_select_all on public.tags;
drop policy if exists tags_insert_auth on public.tags;
drop policy if exists tags_select_own on public.tags;
create policy tags_select_own on public.tags for select
  using (auth.uid() = owner_user_id);
drop policy if exists tags_insert_own on public.tags;
create policy tags_insert_own on public.tags for insert
  with check (auth.uid() = owner_user_id);
drop policy if exists tags_delete_own on public.tags;
create policy tags_delete_own on public.tags for delete
  using (auth.uid() = owner_user_id);

-- ---- viewer_access: both sides of a request/grant can see it; only the
-- ---- requester can create it (as 'pending'), and only through
-- ---- request_viewer_access(email) (schema.sql) -- a direct insert could aim
-- ---- a request at any user id and so reveal that user's profile. Only the
-- ---- owner can approve it, and only status/responded_at are updatable (the
-- ---- two user ids can't be re-pointed). Either side can delete it
-- ---- (cancel / decline / revoke).
drop policy if exists viewer_access_select on public.viewer_access;
create policy viewer_access_select on public.viewer_access for select
  using (auth.uid() = requester_user_id or auth.uid() = owner_user_id);

drop policy if exists viewer_access_insert on public.viewer_access;

drop policy if exists viewer_access_update on public.viewer_access;
create policy viewer_access_update on public.viewer_access for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id and status in ('approved','paused'));

revoke insert, update on public.viewer_access from anon, authenticated;
grant update (status, responded_at) on public.viewer_access to authenticated;

drop policy if exists viewer_access_delete on public.viewer_access;
create policy viewer_access_delete on public.viewer_access for delete
  using (auth.uid() = requester_user_id or auth.uid() = owner_user_id);

-- ---- transactions: private by default. You always see your own; you see
-- ---- someone else's only once they've approved a viewer_access request
-- ---- from you. Only the owner can insert/update/delete their own rows.
drop policy if exists transactions_select_all on public.transactions;
drop policy if exists transactions_select_own_or_approved on public.transactions;
create policy transactions_select_own_or_approved on public.transactions for select
  using (
    auth.uid() = owner_user_id
    or exists (
      select 1 from public.viewer_access
      where viewer_access.owner_user_id = transactions.owner_user_id
        and viewer_access.requester_user_id = auth.uid()
        and viewer_access.status = 'approved'
    )
  );

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

-- documents: a receipt attached to a shared transaction is also selectable
-- by whoever's been approved to see that transaction -- only documents some
-- transaction points at via receipt_document_id, never the owner's whole
-- Documents page. budgets/goals/recurring_items stay strictly own-only
-- (private even when transactions are shared).
drop policy if exists documents_select_shared on public.documents;
create policy documents_select_shared on public.documents for select
  using (
    exists (
      select 1 from public.transactions t
      join public.viewer_access va
        on va.owner_user_id = t.owner_user_id
       and va.requester_user_id = auth.uid()
       and va.status = 'approved'
      where t.receipt_document_id = documents.id
        and t.owner_user_id = documents.owner_user_id
    )
  );

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

-- feedback: insert/select only -- a submission is an honest, unedited record,
-- not something the submitter can quietly rewrite or delete afterward.
alter table public.feedback enable row level security;
drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback for select
  using (auth.uid() = owner_user_id);
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert
  with check (auth.uid() = owner_user_id);

-- feedback: the one hardcoded admin (by email) can see every submission and
-- write a reply on any row -- deliberately no general "owner can update
-- their own row" policy, since that would also let a submitter quietly
-- edit their original message after the fact (see the comment above).
-- Clearing a seen reply notification goes through the narrow
-- mark_feedback_reply_seen() RPC (schema.sql) instead.
drop policy if exists feedback_select_admin on public.feedback;
create policy feedback_select_admin on public.feedback for select
  using (public.is_admin());
drop policy if exists feedback_update_admin_reply on public.feedback;
create policy feedback_update_admin_reply on public.feedback for update
  using (public.is_admin())
  with check (public.is_admin());

-- client_errors: insert-only, no select policy for anyone -- diagnostic data
-- for whoever runs the project (read via the Supabase dashboard/service
-- role), not something surfaced back to users. owner_user_id may be null
-- (a crash before sign-in), so the check allows that alongside the normal
-- "you can only attribute an error to yourself" case.
alter table public.client_errors enable row level security;
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors for insert
  with check (owner_user_id is null or auth.uid() = owner_user_id);

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

-- Also selectable by approved viewers of the owner's transactions -- a
-- receipt attached to a shared transaction needs to actually be openable
-- by whoever's been granted access to see that transaction, matching
-- documents_select_shared on the table itself (above): only files a
-- documents row attaches to such a transaction, and only inside that
-- owner's own folder (storage_path is client-written text).
drop policy if exists documents_storage_select_shared on storage.objects;
create policy documents_storage_select_shared on storage.objects for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      join public.transactions t
        on t.receipt_document_id = d.id and t.owner_user_id = d.owner_user_id
      join public.viewer_access va
        on va.owner_user_id = t.owner_user_id
       and va.requester_user_id = auth.uid()
       and va.status = 'approved'
      where d.storage_path = objects.name
        and d.owner_user_id::text = (storage.foldername(objects.name))[2]
    )
  );

-- ================= Storage (avatars bucket) =================
-- Public bucket -- profile pictures must be viewable by every user (they show
-- up on shared transactions), unlike the private documents bucket above.
-- Public URLs are served without any select policy, so listing is limited to
-- your own folder (the top-level folders are user ids). Images only, 5 MB,
-- matching useUploadAvatar; no SVG (it can carry script).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Objects live at `<owner_user_id>/<uuid>-<safe-filename>` so ownership is
-- checked straight from the path, same pattern as the documents bucket.
-- Select on your own folder is still needed for upsert uploads and cleanup.
drop policy if exists avatars_storage_select_all on storage.objects;
drop policy if exists avatars_storage_select_own on storage.objects;
create policy avatars_storage_select_own on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_storage_insert_own on storage.objects;
create policy avatars_storage_insert_own on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_storage_update_own on storage.objects;
create policy avatars_storage_update_own on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_storage_delete_own on storage.objects;
create policy avatars_storage_delete_own on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- mark_recurring_item_paid(uuid, date) is a narrow SECURITY DEFINER RPC
-- defined in schema.sql. It validates auth.uid() and ownership itself before
-- atomically inserting the expense and advancing recurring_items.next_date;
-- no broad RLS write policy is added for this workflow.

-- ---- transaction_splits ----
-- Both people in a split can read it; only the payer can create, settle or
-- remove it. Creating one needs their own expense, a share no more than its
-- amount (the transaction_splits_cap_total trigger in schema.sql also caps
-- the total of all shares), and an *approved* viewer_access connection with
-- the other person (either direction). After that, settled_at is the only
-- updatable column, so a split can't be re-pointed at an unconnected user or
-- another transaction -- which is why UPDATE needs no connection check, and
-- the payer can still settle up after the connection is paused or revoked.
alter table public.transaction_splits enable row level security;

drop policy if exists transaction_splits_select_participants on public.transaction_splits;
create policy transaction_splits_select_participants on public.transaction_splits
  for select to authenticated
  using (owner_user_id = auth.uid() or with_user_id = auth.uid());

drop policy if exists transaction_splits_insert_own on public.transaction_splits;
create policy transaction_splits_insert_own on public.transaction_splits
  for insert to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (select 1 from public.transactions t
                where t.id = transaction_splits.transaction_id and t.owner_user_id = auth.uid()
                  and t.type = 'expense' and transaction_splits.amount <= t.amount)
    and exists (select 1 from public.viewer_access va where va.status = 'approved'
                and ((va.owner_user_id = auth.uid() and va.requester_user_id = transaction_splits.with_user_id)
                  or (va.requester_user_id = auth.uid() and va.owner_user_id = transaction_splits.with_user_id)))
  );

drop policy if exists transaction_splits_update_own on public.transaction_splits;
create policy transaction_splits_update_own on public.transaction_splits
  for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists transaction_splits_delete_own on public.transaction_splits;
create policy transaction_splits_delete_own on public.transaction_splits
  for delete to authenticated
  using (owner_user_id = auth.uid());

grant select, insert, delete on public.transaction_splits to authenticated;
revoke update on public.transaction_splits from authenticated;
grant update (settled_at) on public.transaction_splits to authenticated;
revoke all on public.transaction_splits from anon;

-- ---- debit_cards ----
-- Debit cards are private: own-only for every operation, even when
-- transactions are shared (a viewer just sees "Debit card" as the method).
alter table public.debit_cards enable row level security;

drop policy if exists debit_cards_select_own on public.debit_cards;
create policy debit_cards_select_own on public.debit_cards for select to authenticated
  using (owner_user_id = auth.uid());
drop policy if exists debit_cards_insert_own on public.debit_cards;
create policy debit_cards_insert_own on public.debit_cards for insert to authenticated
  with check (owner_user_id = auth.uid());
drop policy if exists debit_cards_update_own on public.debit_cards;
create policy debit_cards_update_own on public.debit_cards for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
drop policy if exists debit_cards_delete_own on public.debit_cards;
create policy debit_cards_delete_own on public.debit_cards for delete to authenticated
  using (owner_user_id = auth.uid());

revoke all on public.debit_cards from anon, authenticated;
grant select, insert, delete on public.debit_cards to authenticated;
grant update (name, last4, account) on public.debit_cards to authenticated;
