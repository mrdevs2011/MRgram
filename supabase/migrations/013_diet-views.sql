-- diet/03 (3.4) contract: post views hisoblagichi.
-- Kod tomoni olib tashlangan: cc22948 (2026-09-29).
-- 2026-10-01: MR (root) ruxsati bilan 1 haftalik kuzatuvdan oldin yurgizildi; zaxira ~/Claude/backups/ (schema + posts.views).
-- posts_insert policy `views = 0` ga tayangan edi -> policy views shartisiz qayta yaratiladi (qolgan shartlar AYNAN o'sha).
-- Idempotent.
begin;
drop policy if exists "posts_insert" on public.posts;
alter table public.posts drop column if exists views;
drop function if exists public.increment_post_view(uuid);
create policy "posts_insert" on public.posts for insert to authenticated
  with check (public.is_admin() or (public.is_approved() and user_id = auth.uid() and likes_count = 0 and comment_count = 0));
commit;
