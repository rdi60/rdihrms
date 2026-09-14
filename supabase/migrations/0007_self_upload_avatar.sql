-- Lets any signed-in staff member upload/replace their OWN avatar photo,
-- alongside the existing admin-only policies that let an admin set
-- anyone's avatar (e.g. via bulk photo upload). Avatar files are named
-- "<profile id>_<timestamp>.<ext>" (unique per upload so browsers never
-- serve a stale cached image after a re-upload) — an underscore, not a
-- hyphen, since the profile id is a UUID that already contains hyphens.
-- Ownership is checked by matching the filename prefix (before the "_")
-- to the caller's own id.

create policy "staff upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and split_part(name, '_', 1) = auth.uid()::text);

create policy "staff update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and split_part(name, '_', 1) = auth.uid()::text);
