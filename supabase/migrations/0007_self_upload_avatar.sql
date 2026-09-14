-- Lets any signed-in staff member upload/replace their OWN avatar photo,
-- alongside the existing admin-only policies that let an admin set
-- anyone's avatar (e.g. via bulk photo upload). Avatar files are named
-- "<profile id>.<ext>" with no folder, so ownership is checked by
-- matching the filename (before the extension) to the caller's own id.

create policy "staff upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);

create policy "staff update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);
