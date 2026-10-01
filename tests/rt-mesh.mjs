/* tests/rt-mesh.mjs — rt-chat.js (DM + guruh mesh) loopback testi.
   Supabase o'rniga soxta `sb` (BroadcastChannel) — faqat signalizatsiya/zaxira; DataChannel haqiqiy WebRTC.
   Ishga tushirish: node tests/rt-mesh.mjs   (PW_PATH / CHROME_PATH smoke.mjs bilan bir xil) */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const require = createRequire(import.meta.url);
const pw = process.env.PW_PATH || ['playwright-core', join(process.env.HOME || '', 'Claude/work/shots/node_modules/playwright-core')].find(p => { try { require.resolve(p); return true; } catch (_) { return false; } });
const { chromium } = require(pw);
const CHROME = process.env.CHROME_PATH || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync);

const STUB = `
export const state = { me: { uid: new URLSearchParams(location.search).get('u') } };
const mk = (name) => {
  const bc = new BroadcastChannel('fake-' + name); const subs = {}; let cb;
  const ch = {
    on(t, f, h) { (subs[f.event] ||= []).push(h); return ch; },
    subscribe(c) { cb = c; bc.onmessage = (e) => { const { event, payload } = e.data; (subs[event] || []).forEach(h => h({ payload })); }; setTimeout(() => c && c('SUBSCRIBED'), 5); return ch; },
    send(m) { bc.postMessage({ event: m.event, payload: JSON.parse(JSON.stringify(m.payload)) }); return Promise.resolve('ok'); },
    _close() { bc.close(); },
  }; return ch;
};
export const sb = { channel: mk, removeChannel: c => c._close(), auth: { getSession: async () => ({ data: { session: null } }) } };
`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer(async (req, rsp) => {
  const u = req.url.split('?')[0];
  if (u === '/modules/config.js') { rsp.writeHead(200, { 'content-type': 'text/javascript' }); return rsp.end(STUB); }
  if (u === '/t.html') { rsp.writeHead(200, { 'content-type': 'text/html' }); return rsp.end('<html><body>t</body></html>'); }
  try { const b = await readFile(join(ROOT, normalize(u))); rsp.writeHead(200, { 'content-type': MIME[extname(u)] || 'text/plain' }); rsp.end(b); }
  catch (_) { rsp.writeHead(404); rsp.end('nf'); }
}).listen(0, '127.0.0.1');
await new Promise(r => srv.on('listening', r));
const base = `http://127.0.0.1:${srv.address().port}`;

const br = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--allow-loopback-in-peer-connection', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const ctx = await br.newContext();
let fails = 0;
const ok = (n, p, note = '') => { console.log(`${p ? '✅' : '❌'} ${n}${note ? ' — ' + note : ''}`); if (!p) fails++; };

async function mkPage(uid) {
  const pg = await ctx.newPage();
  await pg.goto(`${base}/t.html?u=${uid}`);
  await pg.evaluate(() => { window.got = []; window.typ = []; });
  return pg;
}
const A = await mkPage('a1'), B = await mkPage('b2'), C = await mkPage('c3');

/* ── guruh mesh (3 a'zo) ── */
for (const pg of [A, B, C]) {
  await pg.evaluate(async () => {
    const m = await import('/modules/rt-chat.js');
    window.rt = m.openRtGroup('g1', ['a1', 'b2', 'c3'], {
      onMsg: (x) => window.got.push({ ...x, t: Date.now() }),
      onTyping: (v, f) => window.typ.push([v, f]),
    });
  });
}
const t0 = Date.now();
await A.waitForFunction(() => window.rt.p2pCount() === 2, null, { timeout: 15000 }).catch(() => {});
const cnt = await Promise.all([A, B, C].map(p => p.evaluate(() => window.rt.p2pCount())));
ok('guruh mesh: har bir a\'zo 2 peer bilan DC ochdi', cnt.every(n => n === 2), `${cnt} · ${Date.now() - t0}ms`);

const ts = await A.evaluate(() => { const t = Date.now(); window.rt.send('m-1', 'salom'); return t; });
await B.waitForFunction(() => window.got.length >= 1, null, { timeout: 3000 }).catch(() => {});
await C.waitForFunction(() => window.got.length >= 1, null, { timeout: 3000 }).catch(() => {});
const gb = await B.evaluate(() => window.got), gc = await C.evaluate(() => window.got);
ok('guruh xabari B va C ga yetdi', gb[0]?.text === 'salom' && gc[0]?.text === 'salom' && gb[0].from === 'a1');
ok('P2P kechikish <= 300ms', gb[0] && gb[0].t - ts <= 300 && gc[0].t - ts <= 300, `B=${gb[0]?.t - ts}ms C=${gc[0]?.t - ts}ms`);
await new Promise(r => setTimeout(r, 400));
ok('dublikat yo\'q (DC + WS skip)', (await B.evaluate(() => window.got.length)) === 1);

await B.evaluate(() => window.rt.sendTyping(true));
await A.waitForFunction(() => window.typ.length >= 1, null, { timeout: 2000 }).catch(() => {});
ok('yozmoqda (typing) P2P', JSON.stringify(await A.evaluate(() => window.typ[0])) === JSON.stringify([true, 'b2']));

/* ── DM: DC tayyor bo'lmasdan yuborilsa — WS zaxira ── */
const D1 = await mkPage('x1'), D2 = await mkPage('y2');
await D1.evaluate(async () => { const m = await import('/modules/rt-chat.js'); window.rt = m.openRt('c9', 'y2', { onMsg: x => window.got.push({ ...x, t: Date.now() }) }); });
await D2.evaluate(async () => { const m = await import('/modules/rt-chat.js'); window.rt = m.openRt('c9', 'x1', { onMsg: x => window.got.push({ ...x, t: Date.now() }) }); });
await new Promise(r => setTimeout(r, 60));
await D1.evaluate(() => window.rt.send('d-1', 'tez'));
await D2.waitForFunction(() => window.got.length >= 1, null, { timeout: 3000 }).catch(() => {});
ok('DM: DC ochilmasdan WS zaxira orqali yetdi', (await D2.evaluate(() => window.got[0]?.text)) === 'tez');
await D1.waitForFunction(() => window.rt.isP2P(), null, { timeout: 15000 }).catch(() => {});
const t1 = await D1.evaluate(() => { const t = Date.now(); window.rt.send('d-2', 'p2p'); return t; });
await D2.waitForFunction(() => window.got.length >= 2, null, { timeout: 3000 }).catch(() => {});
const d2 = await D2.evaluate(() => window.got[1]);
ok('DM P2P kechikish <= 300ms', d2 && d2.t - t1 <= 300, `${d2 && d2.t - t1}ms`);

await br.close(); srv.close();
console.log(fails ? `\n${fails} ta xato` : '\nhammasi o\'tdi');
process.exit(fails ? 1 : 0);
