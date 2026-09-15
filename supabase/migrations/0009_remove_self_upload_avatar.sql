-- Removes the self-service "upload your own avatar" feature added in
-- 0007. Staff photos are admin-managed only now (Team → Bulk photo
-- upload), so the policies that let a signed-in user write to their own
-- avatar file are dropped. The admin-only avatar policies from 0005 are
-- untouched.

drop policy "staff upload their own avatar" on storage.objects;
drop policy "staff update their own avatar" on storage.objects;
