-- DIET Faza 5 contract bosqichi.
-- QOIDA (roadmap 3): faqat kod deploy qilinganidan KAMIDA 1 HAFTA keyin,
-- realtime presence/typing ishlayotgani tasdiqlangandan so'ng isgatiladi.
-- Idempotent: qayta ishga tushirilsa xato bermaydi.

-- typing_until: F5.2 dan beri hech kim yozmaydi/oximaydi (realtime broadcast).
alter table public.chat_members drop column if exists typing_until;

-- last_seen_at (chat_members): eski typing mexanizmi qoldig'i.
-- [TEKSHIR] bajarishdan oldin: select count(*) from chat_members where last_seen_at is not null;
alter table public.chat_members drop column if exists last_seen_at;

-- Eski grant yuqoridagi ustunlar bilan birga ketadi — qayta berish shart emas.
-- profiles.last_seen O'CHIRILMAYDI: u "oxirgi faollik" uchun kerak
-- (endi faqat chiqishda, sendBeacon orqali, bir marta yoziladi).
