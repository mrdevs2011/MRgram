-- DIET F1 — contract bosqichi.
-- QOIDA: faqat kod deploy qilinganidan va kembda 1 hafta muammosiz ishlagandan KEYIN ishga tushiriladi.
-- Idempotent: qayta bajarilsa xato bermaydi.
-- Zaxira: pg_dump (F0) — drop qilinishdan oldin jadval eksport qilingan.

drop table if exists public.follows;
