/* error-log.js — 7.7: oddiy xato ko'rish. Overengineering YO'Q.
   - window.onerror + unhandledrejection ushlanadi
   - oxirgi 20 xato localStorage'da (konsolda: __mrErrors())
   - agar bazada `client_errors` jadvali bo'lsa (014 patch), sessiyada eng ko'pi 5 ta yuboriladi
   - jadval yo'q/xato bo'lsa jim to'xtaydi (hech qachon yangi xato yaratmaydi) */
const KEY = 'mrspace_errors';
const MAX_KEEP = 20;
const MAX_SEND = 5;
const IGNORE = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection/i;
let _sent = 0;
let _dead = false;
const _seen = new Set();

function _load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
}
function _save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_KEEP))); } catch (_) {}
}

async function _send(rec) {
  if (_dead || _sent >= MAX_SEND) return;
  _sent++;
  try {
    const { sb, state } = await import('./config.js');
    const uid = state?.user?.id || state?.me?.id || null;
    const { error } = await sb.from('client_errors').insert({
      user_id: uid, message: rec.msg, source: rec.src, stack: rec.stack, ua: rec.ua,
    });
    if (error) _dead = true;   // jadval yo'q yoki ruxsat yo'q — qayta urinma
  } catch (_) { _dead = true; }
}

function _record(msg, src, stack) {
  msg = String(msg || '').slice(0, 300);
  if (!msg || IGNORE.test(msg)) return;
  const sig = msg + '|' + (src || '');
  if (_seen.has(sig)) return;
  _seen.add(sig);
  const rec = {
    t: new Date().toISOString(), msg, src: String(src || '').slice(0, 200),
    stack: String(stack || '').slice(0, 1000), ua: (navigator.userAgent || '').slice(0, 160),
  };
  const list = _load(); list.push(rec); _save(list);
  _send(rec);
}

window.addEventListener('error', e => {
  if (e.target && e.target !== window) return;   // rasm/skript yuklanmadi — bu JS xatosi emas
  _record(e.message, `${e.filename || ''}:${e.lineno || 0}:${e.colno || 0}`, e.error && e.error.stack);
});
window.addEventListener('unhandledrejection', e => {
  const r = e.reason;
  _record(r && r.message ? r.message : r, 'promise', r && r.stack);
});

window.__mrErrors = () => _load();
window.__mrErrorsClear = () => { try { localStorage.removeItem(KEY); } catch (_) {} };
