-- Staff profile photos: a public storage bucket plus a pointer column on
-- profiles. Public because avatars aren't sensitive and this lets every
-- screen that lists staff (Team roster, Profile) render an <img> straight
-- off a stable public URL without an extra signed-URL round trip per photo.

alter table profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

create policy "admins upload avatar files"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and is_admin(auth.uid()));

create policy "admins update avatar files"
  on storage.objects for update
  using (bucket_id = 'avatars' and is_admin(auth.uid()));
