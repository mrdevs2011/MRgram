#!/usr/bin/env node
/* DIET F4.1b — CSS inventar (FAQAT HISOBOT, hech narsa o'chirmaydi).
   Har CSS/*.css qoidasi uchun: selektordagi .class/#id tokenlari index.html + modules/*.js
   matnida uchraydimi? Token-darajasida (property darajasida emas!) — taxminiy.
   hard  = token hech qayerda yo'q (na to'liq, na dinamik prefiks) → o'lik nomzod
   maybe = token yo'q, lekin JS'da "prefiks-" + o'zgaruvchi ko'rinishida yig'ilishi mumkin
   Ishlatish: node scripts/css-inventory.mjs  → docs/CSS-INVENTORY.md
   Tozalash (faqat hard): node scripts/css-inventory.mjs --prune=CSS/fayl.css */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(ROOT, p), 'utf8');
const PRUNE = (process.argv.find(a => a.startsWith('--prune=')) || '').slice(8);
const content = [rd('index.html'), rd('404.html'),
  ...readdirSync(join(ROOT, 'modules')).filter(f => f.endsWith('.js')).map(f => rd('modules/' + f))].join('\n');
const cssFiles = readdirSync(join(ROOT, 'CSS')).filter(f => f.endsWith('.css')).sort();

const cache = new Map();
function status(tok) { // 'used' | 'dyn' | 'none'
  if (cache.has(tok)) return cache.get(tok);
  let r = 'none';
  if (content.includes(tok)) r = 'used';
  else {
    for (let i = tok.indexOf('-'); i !== -1; i = tok.indexOf('-', i + 1)) {
      const p = tok.slice(0, i + 1);
      if (['\'', '"', '`', '${'].some(q => content.includes(p + q))) { r = 'dyn'; break; }
    }
  }
  cache.set(tok, r); return r;
}

const rows = []; const details = {};
let T = { rules: 0, hard: 0, maybe: 0, lines: 0, hardLines: 0, imp: 0, hardImp: 0 };
for (const f of cssFiles) {
  const txt = rd('CSS/' + f).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const RULE = /([^{}]+)\{([^{}]*)\}/g; let m;
  const s = { rules: 0, hard: 0, maybe: 0, hardLines: 0, imp: 0, hardImp: 0 }; const list = []; const ranges = [];
  while ((m = RULE.exec(txt))) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@') || /^(from|to|\d+%)/.test(sel)) continue;
    const lines = m[0].split('\n').length, imp = (m[2].match(/!important/g) || []).length;
    s.rules++; s.imp += imp;
    const parts = sel.split(',').map(x => x.trim()).filter(Boolean);
    let allDead = true, allHard = true;
    for (const part of parts) {
      const toks = (part.replace(/:(not|is|where|has)\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '')
        .match(/[.#][A-Za-z_][\w-]*/g) || []);
      if (!toks.length) { allDead = false; break; }
      const sts = toks.map(t => status(t.slice(1)));
      if (!sts.includes('none') && !sts.includes('dyn')) { allDead = false; break; }
      if (!sts.includes('none')) allHard = false;
    }
    if (!allDead) continue;
    if (allHard) { s.hard++; s.hardLines += lines; s.hardImp += imp; list.push(sel.replace(/\s+/g, ' ').slice(0, 90)); ranges.push([m.index, m.index + m[0].length]); }
    else s.maybe++;
  }
  if (PRUNE === 'CSS/' + f) {
    let orig = rd('CSS/' + f);
    for (const [a, b] of ranges.reverse()) orig = orig.slice(0, a) + orig.slice(b);
    let prev;
    do { prev = orig; orig = orig.replace(/@media[^{}]*\{\s*\}/g, ''); } while (orig !== prev);
    orig = orig.replace(/\n{3,}/g, '\n\n');
    writeFileSync(join(ROOT, 'CSS/' + f), orig);
    console.log(`PRUNE ${f}: ${ranges.length} hard-o'lik qoida olib tashlandi`);
  }
  const total = txt.split('\n').length;
  rows.push([f, total, s]); details[f] = list;
  T.rules += s.rules; T.hard += s.hard; T.maybe += s.maybe; T.lines += total;
  T.hardLines += s.hardLines; T.imp += s.imp; T.hardImp += s.hardImp;
}
let out = `# CSS inventar (DIET F4.1b)\n\n> Avtomatik: \`node scripts/css-inventory.mjs\`. **Faqat hisobot** — hech narsa o'chirilmagan.\n> Token-darajasida (class/id matnda uchraydimi); property-darajasidagi solishtirish emas. \`hard\` = o'lik nomzod, \`maybe\` = JS'da dinamik yig'ilishi mumkin. O'chirishdan oldin brauzerda (qoida 8) va DevTools Coverage bilan tasdiqlang.\n\n`;
out += `| Fayl | Qator | Qoida | hard | maybe | hard qator | \`!important\` (hard ichida) |\n|---|---|---|---|---|---|---|\n`;
for (const [f, tot, s] of rows) out += `| ${f} | ${tot} | ${s.rules} | ${s.hard} | ${s.maybe} | ${s.hardLines} | ${s.imp} (${s.hardImp}) |\n`;
out += `| **JAMI** | **${T.lines}** | **${T.rules}** | **${T.hard}** | **${T.maybe}** | **${T.hardLines}** | **${T.imp} (${T.hardImp})** |\n\n## hard-o'lik selektorlar (har fayldan 30 tagacha)\n`;
for (const [f] of rows) if (details[f].length) {
  out += `\n### ${f} (${details[f].length})\n` + details[f].slice(0, 30).map(x => '- `' + x + '`').join('\n') + (details[f].length > 30 ? `\n- … yana ${details[f].length - 30} ta` : '') + '\n';
}
writeFileSync(join(ROOT, 'docs/CSS-INVENTORY.md'), out);
console.log(`qoida ${T.rules}, hard ${T.hard} (${T.hardLines} qator), maybe ${T.maybe}; jami CSS ${T.lines} qator; !important ${T.imp} (hard ichida ${T.hardImp})`);
