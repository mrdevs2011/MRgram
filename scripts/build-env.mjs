// Vercel build: Supabase sozlamalarini Environment Variables'dan modules/env.js ga yozadi.
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
  console.log('ℹ️ env o\'zgaruvchilar yo\'q — modules/env.js o\'zgartirilmadi (lokal ishlash).');
  process.exit(0);
}

writeFileSync('modules/env.js',
`// AVTOMATIK YARATILADI (scripts/build-env.mjs) — qo'lda tahrirlamang.
export const SUPABASE_URL      = ${JSON.stringify(url)};
export const SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`);
console.log('✅ modules/env.js yozildi (' + new URL(url).host + ')');
