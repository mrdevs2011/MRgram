# MR uchun qolgan ishlar (faqat panel / DB / qaror)

2026-09-30 holati: kod tomoni yopilgan (F4 CSS qoldig'idan tashqari). Quyidagilarni AI qila olmaydi yoki MR qarori kerak.
Kalitlar repo'da saqlanmaydi. Supabase CLI login MR ning keyring'ida (CMC orqali `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1001/bus` bilan ishlaydi).

## 1. Bugunoq

- [ ] **Vercel deploy tekshirish:** Dashboard -> Deployments -> oxirgisi "Ready", Build Logs'da `modules/env.js yozildi` bor.
      Keyin `docs/SMOKE.md` ni telefonda o'tkaz (ayniqsa: admin panel, chat, izohlar).
- [ ] **TURN sinovi:** Cloudflare TURN. Vercel Production'da `TURN_KEY_ID` va `TURN_KEY_API_TOKEN` bor (2026-09-30 tasdiqlandi, `api/turn.js` shularni o'qiydi).
      Sinov: Wi-Fi'dagi telefondan mobil tarmoqdagi telefonga qo'ng'iroq. Ulanmasa: Deployments -> Redeploy (env deploy'dan keyin qo'shilgan bo'lishi mumkin).
      Preview'da ham kerak bo'lsa, ikkala env'ga Preview belgisini qo'sh. Yo'q bo'lsa ilova umumiy OpenRelay'ga tushadi (beqaror).
- [x] **SQL 014 + 015** (2026-09-30 yurgizildi, `migrations/` ga ko'chirildi).
- [x] **Admin panel "Storage: X / 1 GB"** (2026-09-30 tasdiqlandi: "3 MB / 1.00 GB (0%)").
- [x] **3.6 eski shaxsiy postlar** (2026-09-30: 7 post, hammasi ochiq, shaxsiy 0 -> Q4 kerak emas).

## 2. Contract patchlar (`supabase/unfulfilled/`)

2026-09-30 jonli dump (`migrations/000_schema.sql`) bo'yicha holat:

- **007 / 008 / 009 / 012:** `follows`, `admin_actions`, `broadcast_history`, `login_history`, `chat_members.typing_until`, `last_seen_at` bazada ALLAQACHON YO'Q.
  Patchlar idempotent, qayta yurgizish zararsiz (no-op). Aniqlik uchun: kim/qachon drop qilganini MR biladi. Tasdiqlangach `migrations/` ga ko'chirish yoki o'chirish.
- **010:** `join_group_by_code()` allaqachon yo'q. `groups` jadvali bo'sh (2026-09-30 tekshirildi: 0 guruh, 0 a'zo, 0 xabar; 2 foydalanuvchi), shuning uchun `update groups ...` qismi no-op.
- **011 (kanal -> guruh):** ham no-op (kanal/guruh yo'q). 010 va 011 ni yurgizish shart emas, `migrations/` ga ko'chirib yoki o'chirib yopsa bo'ladi.
- **013 (`posts.views`, `increment_post_view()`):** bazada HALI BOR. Eng erta 2026-10-06 dan keyin, `supabase db dump` bilan zaxira olib.
  Contract SQL'larni erta yurgizma: roadmap 3-qoida (kod va `drop` bir vaqtda emas). Tartib: `supabase/unfulfilled/CHECKLIST.md`.

## 3. Bir marta

- [x] `000_schema.sql` jonli dump bilan almashtirildi (2026-09-30, `ed8c6a3`; webhook siri `__WEBHOOK_SECRET__` bilan yashirilgan).
- [ ] Qarorlar jurnali (roadmap 8-bo'lim): Q9, Q11. Q4 yopildi (kerak emas). Q10 (Storage 1 GB dan oshsa) hozir dolzarb emas, panelda kuzatiladi.
