-- DIET Faza 2 contract bosqichi.
-- QOIDA (roadmap 3): faqat kod deploy qilinganidan KAMIDA 1 HAFTA keyin ishga tushiriladi.
-- ISHGA TUSHIRISHDAN OLDIN (roadmap 4): zaxira ol — Dashboard -> Database -> Backups
-- yoki har bir jadval uchun: select * from public.<jadval>  ->  CSV export.
-- Idempotent: qayta ishga tushirilsa xato bermaydi.
--
-- Kodda bu jadvallarga murojaat qolmagan:
--   admin_actions      — admin-audit.js olib tashlangan (F2.3)
--   broadcast_history  — view-actions.js dan tarix olib tashlangan (F2.4)
--   login_history      — auth.js insert va view-users.js select olib tashlangan (F2.9)
-- admin_notice QOLADI (global e'lon).
--
-- [TEKSHIR] bajarishdan oldin: 1 hafta davomida konsolda "relation ... does not exist"
-- yoki 404 xato yo'qligini tasdiqla.

drop table if exists public.admin_actions;
drop table if exists public.broadcast_history;
drop table if exists public.login_history;
