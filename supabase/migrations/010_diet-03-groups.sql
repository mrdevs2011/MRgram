-- diet/03 (Q1=B): guruhlar faqat taklif orqali. YOZILDI, ISHGA TUSHIRILMAGAN.
-- Tartib: kod deploy -> kamida 1 hafta kuzatuv -> zaxira (pg_dump) -> shu patch.
-- RLS policy'lar va group_is_private() ga TEGILMAYDI (tegilmaydigan zona; policy'lar unga tayanadi).

-- 1) Ma'lumot: hozirgi ochiq guruh/kanallar yopiq bo'lsin (ilova endi ochiq guruhni ko'rsatmaydi/yaratmaydi)
update public.groups set is_private = true where is_private is not true;

-- 2) Havola orqali qo'shilish funksiyasi kodda endi ishlatilmaydi
drop function if exists public.join_group_by_code(text);

-- invite_code ustuni saqlanadi (schema/RLS grant'lari unga bog'liq) — keyingi contract bosqichida ko'riladi.
