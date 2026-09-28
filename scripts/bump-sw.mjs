#!/usr/bin/env node
/* bump-sw.mjs — deploy vaqtida SW CACHE_VERSION ni yangilaydi (F6.2).
   Vercel buildCommand'da build-env.mjs dan OLDIN ishlaydi. Natija repo'ga commit qilinmaydi.
   Lokal ishga tushirilsa (VERCEL/SHA yo'q) fayl o'zgartirilmaydi, --force bilan majburlash mumkin. */
import { readFileSync, writeFileSync } from 'node:fs';
const sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
if (!sha && !process.env.VERCEL && !process.argv.includes('--force')) {
  console.log('ℹ️ bump-sw: lokal — o\'tkazib yuborildi'); process.exit(0);
}
const version = sha ? `b-${sha.slice(0, 9)}` : `t-${Date.now()}`;
const p = new URL('../firebase-messaging-sw.js', import.meta.url);
const src = readFileSync(p, 'utf8');
const RE = /const CACHE_VERSION\s*=\s*'[^']*';\s*\/\* BUILD_VERSION_LINE \*\//;
if (!RE.test(src)) { console.error('❌ bump-sw: BUILD_VERSION_LINE topilmadi'); process.exit(1); }
writeFileSync(p, src.replace(RE, `const CACHE_VERSION  = '${version}'; /* BUILD_VERSION_LINE */`));
console.log(`OK: SW CACHE_VERSION -> ${version}`);
