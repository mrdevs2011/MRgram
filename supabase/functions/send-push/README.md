# send-push (Web Push yuboruvchi)

Yangi xabar (`messages`), guruh xabari (`group_messages`) va qo'ng'iroq (`calls`) INSERT bo'lganda
obunachilarga push yuboradi. Client tomoni: `modules/push.js` + `sw.js`.

## Sozlash (bir marta)
1. SQL Editor'da `supabase/patch-push.sql` ni ishga tushiring.
2. VAPID kalitlar (`../mrtube-secrets/vapid.env` da, repo'dan tashqarida). Ochiq kalit `modules/push.js` da turibdi.
   Secret'larni qo'ying:
   ```
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_SECRET_KEY=... VAPID_SUBJECT=mailto:sizning@emailingiz PUSH_WEBHOOK_SECRET=<tasodifiy uzun matn>
   ```
   (`SUPABASE_URL` va `SUPABASE_SERVICE_ROLE_KEY` avtomatik beriladi.)
3. Deploy: `supabase functions deploy send-push --no-verify-jwt`
4. Dashboard → Database → Webhooks: 3 ta webhook (Event: **Insert**, Type: HTTP Request, Method: POST)
   - jadvallar: `messages`, `group_messages`, `calls`
   - URL: `https://<PROJECT>.supabase.co/functions/v1/send-push`
   - Header: `x-webhook-secret: <PUSH_WEBHOOK_SECRET qiymati>`
