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
