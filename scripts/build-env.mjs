// Vercel build: Supabase sozlamalarini Environment Variables'dan modules/core/env.js ga yozadi.
// Kalitlar repo'da saqlanmaydi. Faqat ochiq (anon/publishable) kalit ishlatiladi —
// service_role brauzerga hech qachon tushmasin.
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  if (process.env.VERCEL) {
    console.error('❌ SUPABASE_URL va SUPABASE_ANON_KEY (yoki SUPABASE_PUBLISHABLE_KEY) Vercel env da yo\'q. ' +
      'Project → Settings → Environment Variables da ular shu muhit (Production/Preview) uchun yoqilganini tekshiring.');
    process.exit(1);
  }
  console.log('ℹ️ env o\'zgaruvchilar yo\'q — modules/core/env.js o\'zgartirilmadi (lokal ishlash).');
  process.exit(0);
}

const turnUrls = process.env.TURN_URLS || '';        // vergul bilan: turn:host:3478,turns:host:443
const turnUser = process.env.TURN_USERNAME || '';
const turnCred = process.env.TURN_CREDENTIAL || '';

writeFileSync('modules/core/env.js',
`// AVTOMATIK YARATILADI (scripts/build-env.mjs) — qo'lda tahrirlamang.
export const SUPABASE_URL      = ${JSON.stringify(url)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(key)};
export const TURN_URLS         = ${JSON.stringify(turnUrls)};
export const TURN_USERNAME     = ${JSON.stringify(turnUser)};
export const TURN_CREDENTIAL   = ${JSON.stringify(turnCred)};
`);
console.log('✅ modules/core/env.js yozildi (' + new URL(url).host + ')');
