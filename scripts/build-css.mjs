#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   build-css.mjs — DIET F4: @import zanjirini bitta app.css ga yig'adi
   Kutubxonasiz, oddiy concat. Ishlatish: node scripts/build-css.mjs
   Tartib index.html dagi <link>lar bilan bir xil (kaskad saqlanadi):
     1) style.css dagi @import fayllari (ularning o'z tartibida)
     2) style.css ning o'zi (@import lari o'chirilgan holda)
     3) devs-utility, admin, admin-plain, mono, x-design (index.html linklari)
   Natija: /app.css — index.html bitta <link> ishlatadi.
   ═══════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_RE = /^@import\s+url\(\s*['"]?\.\/(CSS\/[^'")]+)['"]?\s*\)\s*;.*$/m;

// 1) style.css ni o'qiymiz, @import larni chiqish tartibi bo'yicha yig'amiz
const masterSrc = readFileSync(join(ROOT, 'style.css'), 'utf8');
const importOrder = [];
let src = masterSrc;
let m;
while ((m = src.match(IMPORT_RE))) {
  importOrder.push(m[1]);
  src = src.replace(IMPORT_RE, '');
}

const parts = [];
parts.push('/* MRspace app.css — build-css.mjs orqali avtomatik yig\'ilgan. Qo\'lda tahrirlamang! */');

// 2) @import qilingan fayllar (ulardagi ichki @import larni ham ochamiz)
//    no-animations.css BUTUNLAYIN tashlab yuboriladi (DIET F4.4):
//    o'rniga quyidagi istisno qatori — manba fayllardagi transition/animation
//    qatorlari allaqachon "none" qilib qo'yilgan (loading.css:167 spinner
//    !important orqali himoyalangan). Qolgan ~150 ta jonli transition/animation
//    shu bitta qator bilan o'chiriladi. Splash/loading uchun yengil animatsiya
//    istisno qilinadi (Q9 qarori).
for (const f of importOrder) {
  if (f.includes('no-animations')) {
    parts.push(
      '/* ─── DIET F4.4: no-animations.css o\'rnidagi bitta qator (splash/loading animatsiyasi istisno) ─── */\n' +
      '*, *::before, *::after { animation-name: none !important; animation-duration: 0s !important; transition: none !important; scroll-behavior: auto !important; }\n' +
      '#splash *, #splash, .spinner, [class*="splash-"] { animation-name: revert !important; animation-duration: revert !important; }'
    );
    continue;
  }
  let body = readFileSync(join(ROOT, f), 'utf8');
  body = body.replace(/^@import[^;]*;.*$/gm, '');
  parts.push(`/* ─── ${f} ─── */\n${body.trim()}`);
}

// 3) style.css qolgan qismi (global reset va h.k.)
parts.push(`/* ─── style.css (master, @imports ochilgan) ─── */\n${src.trim()}`);

// 4) index.html alohida ulangan fayllar — shu tartibda
const extra = [
  'CSS/devs-utility.css',
  'CSS/admin.css',
  'CSS/admin-plain.css',
  'CSS/mono.css',
  'CSS/x-design.css',
];
for (const f of extra) {
  const body = readFileSync(join(ROOT, f), 'utf8').replace(/^@import[^;]*;.*$/gm, '');
  parts.push(`/* ─── ${f} ─── */\n${body.trim()}`);
}

const out = parts.join('\n\n') + '\n';
writeFileSync(join(ROOT, 'app.css'), out);

// ── DIET F6.2: SW cache versiyasini avtomatik yangilash ──
// Har deployda (build) CACHE_VERSION git SHA yoki vaqt tamg'asi bilan almashtiriladi.
// Qo'lda 'vNNN' oshirish shart emas. SW nomi o'zgarmaydi (Q6: push obunalari saqlanadi).
const sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
const version = sha ? `b-${sha.slice(0, 9)}` : `t-${Date.now()}`;
const swPath = join(ROOT, 'firebase-messaging-sw.js');
const swSrc = readFileSync(swPath, 'utf8');
const VER_RE = /const CACHE_VERSION\s*=\s*'[^']*';\s*\/\* BUILD_VERSION_LINE \*\//;
if (VER_RE.test(swSrc)) {
  const updated = swSrc.replace(VER_RE, `const CACHE_VERSION  = '${version}'; /* BUILD_VERSION_LINE */`);
  writeFileSync(swPath, updated);
  console.log(`OK: firebase-messaging-sw.js CACHE_VERSION -> ${version}`);
} else {
  console.warn('WARN: BUILD_VERSION_LINE belgisi topilmadi — CACHE_VERSION qo\'lda yangilanishi kerak.');
}

const lines = out.split('\n').length;
console.log(`OK: app.css yig'ildi — ${importOrder.length} + 1 + ${extra.length} manba, ${lines} qator, ${(out.length / 1024).toFixed(1)} KB`);
