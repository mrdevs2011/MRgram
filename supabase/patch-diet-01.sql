-- patch-diet-01.sql — FAZA 1 (diet/01-junk) DB contract qadami
-- Idempotent: qayta ishga tushirilganda xato bermaydi.
-- QOIDA (roadmap §1.3): bu faqat CONTRACT bosqichi. Kod deploy qilinganiga
-- kamida 1 hafta bo'lgandan va jadval eksporti olingandan KEYINA bajariladi.
--
-- Zaxira (export, bajarishdan oldin):
--   \copy (select * from public.follows) to 'backup-follows.csv' csv header
--
-- follows: koddagi follow tizimi allaqachon buzilgan (eski supabase2 API),
-- hech bir modul `from('follows')` chaqirmaydi (grep bilan tekshirilgan).

drop table if exists public.follows;
