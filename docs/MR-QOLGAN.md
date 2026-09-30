# MR uchun qolgan ishlar (faqat panel / DB / qaror)

2026-09-30 holati: kod tomoni yopilgan (F4 CSS qoldig'idan tashqari). Quyidagilarni AI qila olmaydi:
Supabase/Vercel'ga kirish yo'q (`supabase` CLI login qilinmagan, `vercel` o'rnatilmagan), kalitlar repo'da saqlanmaydi.

## 1. Bugunoq (5–10 daqiqa)

- [ ] **Vercel deploy tekshirish:** `main` = `b5e9f89` chiqdi. Dashboard → Deployments → oxirgisi "Ready", Build Logs'da
      `✅ modules/env.js yozildi` bor. Keyin `docs/SMOKE.md` ni telefonda o'tkaz (ayniqsa: admin panel, chat, izohlar).
- [ ] **TURN (qo'ng'iroq Wi-Fi ↔ mobil tarmoqda ishonchli bo'lishi uchun):** Vercel → Project → Settings → Environment Variables,
      Production (va Preview) uchun:
      `TURN_URLS` (vergul bilan: `turn:host:3478,turns:host:443`), `TURN_USERNAME`, `TURN_CREDENTIAL`.
      Qiymatlarni TURN provayderingdan olasan. Yo'q bo'lsa ilova umumiy OpenRelay'ga tushadi (beqaror). Env qo'shgach **Redeploy**.
- [x] **SQL 014 + 015 (2026-09-30 yurgizildi, `migrations/` ga ko'chirildi; admin panelda "Storage: X / 1 GB" ni ko'z bilan tasdiqlash qoldi) (expand — xavfsiz, istalgan vaqtda):** Supabase → SQL Editor → `supabase/unfulfilled/014_diet-07-client-errors.sql`
      va `015_diet-07-storage-usage.sql` ni ketma-ket yurgiz. Tekshiruv: admin panelda "Storage: X / 1 GB" qatori chiqadi
      (yurgizmasang "hisoblanmadi" deb turadi). Ishga tushgach ikkalasini `migrations/` ga keyingi raqam bilan ko'chir.
- [x] **3.6 eski shaxsiy postlar (2026-09-30: 7 post, hammasi ochiq, shaxsiy 0 -> Q4 kerak emas):** `supabase/queries/3.6-private-posts.sql` ni SQL Editor'da yurgiz (faqat select),
      natijani menga/AI ga ko'rsat → Q4 qarori.

## 2. 2026-10-06 dan keyin (kod deploydan >= 1 hafta)

Faqat shu vaqtdan keyin, `supabase db dump` bilan zaxira olib, `supabase/unfulfilled/CHECKLIST.md` tartibida:
007/008 (follows), 009 (admin jadvallari), 010 (guruhlar), 012 (typing_until), 013 (views). **011 (kanal→guruh) — kutmoqda**
(5.3 kanal ishi tugaguncha). Contract SQL'larni erta yurgizma: roadmap 3-qoida (kod va `drop` bir vaqtda emas).

## 3. Bir marta

- [ ] `supabase db dump --schema-only` → `supabase/migrations/000_schema.sql` (hozirgi fayl jonli bazadan qayta yig'ilmagan).
- [ ] Qarorlar jurnali (roadmap 8-bo'lim): Q4 (3.6 natijasidan keyin), Q10 (Storage 1 GB dan oshsa — admin panelda endi ko'rinadi).
