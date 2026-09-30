// Vercel Serverless: admin uchun kalitlar tekshiruvi (Vercel env + Cloudflare TURN).
// Sirlar HECH QACHON qaytarilmaydi — faqat { id, name, status: ok|warn|fail, detail } (detail: qisqa sabab/HTTP kod).
// Faqat admin (Supabase is_admin() RPC, foydalanuvchi JWT'si bilan).
const T = 8000;
const f = (url, opt = {}) => fetch(url, { ...opt, signal: AbortSignal.timeout(T) });
const row = (id, name, status, detail) => ({ id, name, status, detail });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const auth = String(req.headers.authorization || '');
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!jwt) return res.status(401).json({ error: 'unauthorized', hint: 'sessiya yo\'q' });
  if (!sbUrl || !sbKey) return res.status(503).json({ error: 'env-missing', hint: 'Vercel\'da SUPABASE_URL yoki SUPABASE_ANON_KEY yo\'q' });

  // 1) admin tekshiruvi (shu bilan Vercel'dagi SUPABASE_URL + ANON kalit ham sinaladi)
  try {
    const r = await f(`${sbUrl}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: { apikey: sbKey, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (r.status === 401 || r.status === 403) return res.status(401).json({ error: 'unauthorized', hint: `Supabase HTTP ${r.status}: Vercel'dagi ANON kalit yoki sessiya yaroqsiz` });
    if (!r.ok) return res.status(502).json({ error: 'supabase-' + r.status });
    if ((await r.json()) !== true) return res.status(403).json({ error: 'not-admin' });
  } catch { return res.status(502).json({ error: 'supabase-unreachable', hint: 'Vercel\'dagi SUPABASE_URL ga ulanib bo\'lmadi' }); }

  const rows = [];
  let host = '';
  try { host = new URL(sbUrl).host; } catch { /* yuqorida fetch o'tgan bo'lsa bu yerga kelmaydi */ }
  rows.push(row('SUPABASE_URL', 'SUPABASE_URL (Vercel)', 'ok', host));
  rows.push(row('SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY (Vercel)', 'ok', 'Supabase qabul qildi'));

  // 2) Cloudflare TURN (muddati 60 s — api/turn.js keshiga tegmaydi)
  const keyId = process.env.TURN_KEY_ID;
  const token = process.env.TURN_KEY_API_TOKEN;
  if (!keyId) rows.push(row('TURN_KEY_ID', 'TURN_KEY_ID', 'fail', 'Vercel env\'da yo\'q'));
  if (!token) rows.push(row('TURN_KEY_API_TOKEN', 'TURN_KEY_API_TOKEN', 'fail', 'Vercel env\'da yo\'q'));
  if (keyId && token) {
    try {
      const r = await f(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 60 }),
      });
      if (r.ok) {
        rows.push(row('TURN_KEY_ID', 'TURN_KEY_ID', 'ok', 'Cloudflare topdi'));
        rows.push(row('TURN_KEY_API_TOKEN', 'TURN_KEY_API_TOKEN', 'ok', 'Cloudflare credential berdi'));
      } else if (r.status === 404) {
        rows.push(row('TURN_KEY_ID', 'TURN_KEY_ID', 'fail', 'Cloudflare: bunday key yo\'q (HTTP 404)'));
        rows.push(row('TURN_KEY_API_TOKEN', 'TURN_KEY_API_TOKEN', 'warn', 'ID xato — tekshirib bo\'lmadi'));
      } else if (r.status === 401 || r.status === 403) {
        rows.push(row('TURN_KEY_ID', 'TURN_KEY_ID', 'warn', 'token xato — aniq aytib bo\'lmadi'));
        rows.push(row('TURN_KEY_API_TOKEN', 'TURN_KEY_API_TOKEN', 'fail', `Cloudflare rad etdi (HTTP ${r.status})`));
      } else {
        rows.push(row('TURN_KEY_ID', 'TURN_KEY_ID + TOKEN', 'fail', `Cloudflare HTTP ${r.status}`));
      }
    } catch { rows.push(row('TURN_KEY_ID', 'TURN_KEY_ID + TOKEN', 'fail', 'Cloudflare\'ga ulanib bo\'lmadi (vaqt/tarmoq)')); }
  }

  // 3) Ixtiyoriy statik TURN (zaxira)
  const su = process.env.TURN_URLS, sn = process.env.TURN_USERNAME, sc = process.env.TURN_CREDENTIAL;
  if (su || sn || sc) {
    const missing = [!su && 'TURN_URLS', !sn && 'TURN_USERNAME', !sc && 'TURN_CREDENTIAL'].filter(Boolean);
    rows.push(missing.length
      ? row('TURN_STATIC', 'Statik TURN (TURN_URLS/USERNAME/CREDENTIAL)', 'fail', 'yetishmayapti: ' + missing.join(', '))
      : row('TURN_STATIC', 'Statik TURN (TURN_URLS/USERNAME/CREDENTIAL)', 'ok', 'uchalasi bor (ishlashi tekshirilmaydi)'));
  } else {
    rows.push(row('TURN_STATIC', 'Statik TURN (zaxira)', 'warn', 'ixtiyoriy, o\'rnatilmagan — Cloudflare ishlamasa OpenRelay'));
  }

  return res.status(200).json({ supabaseHost: host, rows });
}
