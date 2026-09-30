-- diet/03 (3.2): kanal -> guruh (faqat-adminlar rejimi). YOZILDI, ISHGA TUSHIRILMAGAN.
-- Tartib: kod deploy -> kamida 1 hafta kuzatuv -> zaxira (pg_dump) -> shu patch -> keyin kodda 'channel' shoxlarini olib tashlash.
-- RLS/guard triggerlarga TEGILMAYDI. Xabar yuborish huquqi policy'da tayyor: 'group' + msg_permission='admins' (admin/egasi yozadi).
-- Mavjud kanallar oldin export qilinsin: select * from public.groups where type='channel';

update public.groups
   set type = 'group',
       msg_permission = 'admins'
 where type = 'channel';

-- check (type in ('group','channel')) cheklovi hozircha qoladi (contract bosqichida qisqartiriladi).
