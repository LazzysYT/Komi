-- Tighten public avatar Storage uploads without deleting or moving old files.
-- App uses: `avatars/<authenticated user uuid>/<random uuid>.jpg`
-- and uploads canvas-generated image/jpeg. Public GET URLs remain available.
-- Root-level anonymous uploads were a legacy rule and are not used by the app.
drop policy if exists "Komi public avatar uploads" on storage.objects;

-- The authenticated user can create JPEGs only within their own first-level
-- folder. Prevent cross-account and arbitrary nested-path uploads.
alter policy "Komi authenticated avatar uploads" on storage.objects
  to authenticated
  with check (
    bucket_id = 'avatars'
    and storage.extension(name) = 'jpg'
    and cardinality(storage.foldername(name)) = 1
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Prevent excessive storage use and non-image MIME types. Existing avatar
-- objects (including the legacy root-level object) are retained and readable.
update storage.buckets
set file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg']::text[]
where id = 'avatars';
