-- ═══════════════════════════════════════════════════════════════════════
-- Qo'ng'iroq ichida video yoqish (renegotiation) uchun ustunlar.
-- schema.sql ni yangidan ishga tushirgan bo'lsangiz kerak emas (u yerga ham qo'shilgan).
-- Mavjud bazada SQL Editor'da bir marta ishga tushiring.
-- ═══════════════════════════════════════════════════════════════════════
alter table public.calls add column if not exists video_offer  jsonb;
alter table public.calls add column if not exists video_answer jsonb;
grant update (video_offer, video_answer) on public.calls to authenticated;
