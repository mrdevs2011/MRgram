# DB contract navbati (hech biri hali ishga tushirilmagan)

Qoida: kod deploy -> >=1 hafta kuzatuv -> `supabase db dump` -> patch. Eng erta sana: **2026-10-06**.

| Patch | Nima drop | Kod tomoni | Holat |
|---|---|---|---|
| migrations/012_diet-05-contract.sql | chat_members.typing_until, last_seen_at | 153168b (config.js tozalandi) | tayyor, kutish |
| unfulfilled/013_diet-views.sql | posts.views, increment_post_view() | cc22948 | tayyor, kutish |
| migrations/007 / 008 | follows (ikkalasi bir xil, 008 yetarli) | tozalangan | tayyor |
| migrations/009 | admin_actions, broadcast_history, login_history | tozalangan | tayyor |
| migrations/010 | join_group_by_code(); ochiq guruhlarni yopish | 3.x | tayyor |
| migrations/011 | kanal -> guruh (type) | 5.3 kanal ishi tugagach | KUTMOQDA |

Eslatma: 007-012 "migrations/" da turibdi, lekin ular hali bazaga tushmagan; bajarilgach README qoidasiga ko'ra raqami bilan saqlanadi.
