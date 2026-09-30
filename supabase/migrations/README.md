# Migrations

Bazada ISHGA TUSHIRILGAN SQL fayllar, tartib raqami bilan. Yangi bazada `000_schema.sql`, keyin qolganlarini raqam tartibida.

- Ishga tushirilishi kutilayotgan patchlar `supabase/unfulfilled/` da turadi. Bazada bajarilgach shu yerga keyingi raqam bilan ko'chiriladi (`013_nom.sql`).
- Har patch idempotent (`if exists` / `if not exists`).
- Tartib `git` tarixi va bog'liqlik bo'yicha tuzilgan. `001`–`008` bir vaqtda import qilingani uchun ularning o'zaro tartibi taxminiy.
- `000_schema.sql` = jonli bazadan olingan dump (2026-09-30, `supabase db dump --linked`; sxema-only bu standart). Webhook siri `__WEBHOOK_SECRET__` bilan yashirilgan.
- Dump 001-006, 014, 015 ni o'z ichiga oladi: yangi bazada faqat 000 + undan keyingi patchlar kerak bo'ladi.
- Dump olganda sirni yashirishni unutma: `sed -E 's/("x-webhook-secret":")[^"]*(")/\1__WEBHOOK_SECRET__\2/g'`.
