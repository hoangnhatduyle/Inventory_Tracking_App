-- ============================================================================
-- Private storage bucket for inventory + receipt images.
--
-- Path convention: <user_id>/<scope>/<uuid>.<ext>
--   - <user_id>      auth.uid() of the owner
--   - <scope>        'items' or 'receipts'
--   - filename       server-generated uuid + extension
--
-- RLS enforces that a user can only read/write objects whose first path
-- segment matches their own auth.uid().
--
-- File size limit and allowed MIME types are enforced at the bucket level
-- as a first line of defense; the /api/uploads/sign endpoint adds magic-byte
-- validation on top (Phase 4).
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-images',
  'inventory-images',
  false,
  5242880,                 -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

-- Drop any prior policies (idempotent re-apply during development).
drop policy if exists "inventory_images_owner_select" on storage.objects;
drop policy if exists "inventory_images_owner_insert" on storage.objects;
drop policy if exists "inventory_images_owner_update" on storage.objects;
drop policy if exists "inventory_images_owner_delete" on storage.objects;

create policy "inventory_images_owner_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'inventory-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "inventory_images_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'inventory-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "inventory_images_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'inventory-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'inventory-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "inventory_images_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'inventory-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
