# Migrations

Bazada ISHGA TUSHIRILGAN SQL fayllar, tartib raqami bilan. Yangi bazada `000_schema.sql`, keyin qolganlarini raqam tartibida.

- Ishga tushirilishi kutilayotgan patchlar `supabase/unfulfilled/` da turadi. Bazada bajarilgach shu yerga keyingi raqam bilan ko'chiriladi (`013_nom.sql`).
- Har patch idempotent (`if exists` / `if not exists`).
- Tartib `git` tarixi va bog'liqlik bo'yicha tuzilgan. `001`–`008` bir vaqtda import qilingani uchun ularning o'zaro tartibi taxminiy.
- Diqqat: `000_schema.sql` jonli bazadan qayta yig'ilmagan. Ishonchli baseline kerak bo'lsa, Supabase'dan `supabase db dump --schema-only` (yoki `pg_dump --schema-only`) olib almashtiring.
