-- "Share with everyone" per entry (owner's request): on by default; untick
-- it and the people approved to see your transactions don't see that entry
-- (nor a receipt attached to it). The owner always sees their own entries.
-- Safe to re-run; mirrored into schema.sql and policies.sql.

alter table public.transactions add column if not exists shared boolean not null default true;

drop policy if exists transactions_select_own_or_approved on public.transactions;
create policy transactions_select_own_or_approved on public.transactions for select
  using (
    auth.uid() = owner_user_id
    or (
      transactions.shared
      and exists (
        select 1 from public.viewer_access
        where viewer_access.owner_user_id = transactions.owner_user_id
          and viewer_access.requester_user_id = auth.uid()
          and viewer_access.status = 'approved'
      )
    )
  );

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
        and t.shared
    )
  );

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
        and t.shared
    )
  );
