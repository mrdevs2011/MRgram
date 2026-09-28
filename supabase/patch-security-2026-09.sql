-- ═══════════════════════════════════════════════════════════════════════
-- Xavfsizlik patch (2026-09-28) — Supabase SQL Editor'da BIR MARTA ishga tushiring.
-- Idempotent: qayta ishga tushirsa ham xato bermaydi.
-- schema.sql ga ham xuddi shu o'zgarishlar kiritilgan (yangi o'rnatish uchun).
--
-- 1) Kutayotgan (pending) / bloklangan foydalanuvchi boshqalarning profilini o'qiy olmasin
-- 2) Izoh va like'lar faqat ko'rinadigan postlarniki bo'lsin (shaxsiy post izohlari sizmasin)
-- 3) Bloklangan/tasdiqlanmagan user storage'dagi faylini o'zgartira olmasin
-- ═══════════════════════════════════════════════════════════════════════

-- 1) profiles: o'z qatori + faqat tasdiqlanganlar hammani ko'radi
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_approved() or public.is_admin());

-- 2) post ko'rinishi: ommaviy yoki o'zining posti (admin — hammasi)
create or replace function public.post_is_visible(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.posts
    where id = p_post and (is_public or user_id = auth.uid())
  );
$$;

drop policy if exists likes_select on public.post_likes;
create policy likes_select on public.post_likes for select to authenticated
  using (public.is_admin() or (public.is_approved() and public.post_is_visible(post_id)));

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (public.is_admin() or (public.is_approved() and public.post_is_visible(post_id)));

-- shaxsiy postga boshqa odam izoh/like qo'ya olmasin
drop policy if exists likes_insert on public.post_likes;
create policy likes_insert on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved() and public.post_is_visible(post_id));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved() and public.post_is_visible(post_id));

-- 3) storage: update ham faqat tasdiqlangan userga
drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
         and public.is_approved());
