-- DIET 3.6 — eski shaxsiy postlar: FAQAT O'QISH (select). Hech narsa o'zgartirmaydi/o'chirmaydi.
-- Supabase → SQL Editor'da bloklarni alohida-alohida ishga tushiring.
-- Maqsad: qaror (Q4) uchun raqam — nechta shaxsiy post bor, kimniki, qancha joy egallaydi.

-- 1) Umumiy ko'rinish
select
  count(*)                                         as jami_post,
  count(*) filter (where is_public)                as ochiq,
  count(*) filter (where not is_public)            as shaxsiy,
  count(*) filter (where is_max_private)           as maks_shaxsiy,
  pg_size_pretty(coalesce(sum(file_size) filter (where not is_public), 0)) as shaxsiy_media_hajmi
from public.posts;

-- 2) Shaxsiy postlar egalari bo'yicha
select
  p.user_id,
  pr.username,
  count(*)                                         as shaxsiy_post,
  min(p.created_at)::date                          as eng_eskisi,
  max(p.created_at)::date                          as eng_yangisi,
  pg_size_pretty(coalesce(sum(p.file_size), 0))    as media_hajmi
from public.posts p
left join public.profiles pr on pr.id = p.user_id
where not p.is_public
group by p.user_id, pr.username
order by count(*) desc;

-- 3) Yoshi bo'yicha (shaxsiy postlar)
select
  case
    when created_at > now() - interval '30 days'  then '0-30 kun'
    when created_at > now() - interval '90 days'  then '30-90 kun'
    when created_at > now() - interval '180 days' then '90-180 kun'
    else '180+ kun'
  end as yosh,
  count(*) as post_soni
from public.posts
where not is_public
group by 1
order by min(created_at) desc;
