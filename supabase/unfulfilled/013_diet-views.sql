-- diet/03 (3.4) contract: post views hisoblagichi.
-- Kod tomoni olib tashlangan: cc22948 (2026-09-29). main'ga push: 4.2c bilan birga.
-- Tartib: kod deploy -> KAMIDA 1 HAFTA kuzatuv (eng erta 2026-10-06) -> supabase db dump -> shu patch.
-- YOZILDI, ISHGA TUSHIRILMAGAN. Idempotent.
--
-- [TEKSHIR] oldin: select count(*) from public.posts where views > 0;  (faqat ma'lumot uchun, qaytmaydi)
alter table public.posts drop column if exists views;
drop function if exists public.increment_post_view(uuid);
