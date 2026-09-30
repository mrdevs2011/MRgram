# DB contract navbati (hech biri hali ishga tushirilmagan)

Qoida: kod deploy -> >=1 hafta kuzatuv -> `supabase db dump` -> patch. Eng erta sana: **2026-10-06**.

| Patch | Nima drop | Kod tomoni | Holat |
|---|---|---|---|
| unfulfilled/012_diet-05-contract.sql | chat_members.typing_until, last_seen_at | 153168b (config.js tozalandi) | tayyor, kutish |
| unfulfilled/013_diet-views.sql | posts.views, increment_post_view() | cc22948 | tayyor, kutish |
| unfulfilled/007 / 008 | follows (ikkalasi bir xil, 008 yetarli) | tozalangan | tayyor |
| unfulfilled/009 | admin_actions, broadcast_history, login_history | tozalangan | tayyor |
| unfulfilled/010 | join_group_by_code(); ochiq guruhlarni yopish | 3.x | tayyor |
| unfulfilled/011 | kanal -> guruh (type) | 5.3 kanal ishi tugagach | KUTMOQDA |

**Expand (contract EMAS, kuzatuv kutmaydi — istalgan vaqtda ishga tushirsa bo'ladi):**

| Patch | Nima | Kod tomoni |
|---|---|---|
| ✅ migrations/014_diet-07-client-errors.sql (2026-09-30 bazada) | `client_errors` jadvali + RLS | `modules/error-log.js` (jadval yo'q bo'lsa jim) |
| ✅ migrations/015_diet-07-storage-usage.sql (2026-09-30 bazada) | `admin_storage_usage()` RPC | `modules/admin-storage.js` (RPC yo'q bo'lsa jim) |

Eslatma: 007–013 hammasi hali bazaga tushmagan, shuning uchun `unfulfilled/` da. Bajarilgach `migrations/` ga keyingi raqam bilan ko'chiriladi (README).

> 2026-09-30 jonli dump (`migrations/000_schema.sql`): `follows`, `admin_actions`, `broadcast_history`, `login_history` jadvallari, `chat_members.typing_until/last_seen_at` va `join_group_by_code()` bazada ALLAQACHON YO'Q (007/008/009/012 va 010 ning drop qismi bajarilgan bo'lishi mumkin, yoki bazada hech qachon bo'lmagan). `increment_post_view()` hali bor (013 kutmoqda). Bajarishdan oldin har bir patchni jonli holatga qarab tekshiring; hammasi idempotent.

> 2026-10-01: 007-012 `migrations/` ga ko'chirildi (jonli bazada no-op). `unfulfilled/` da faqat **013** qoldi (2026-10-06 dan keyin, zaxiradan so'ng).
