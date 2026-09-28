// DIET F2 — Admin parol reset Edge Function.
// Deploy: supabase functions deploy admin-reset-password
// Xavfsizlik: service_role kaliti FAQAT shu yerda (brauzerga tushmaydi);
// chaqiruvchi JWT tekshiriladi va uning is_admin() ekanligi DB'da tasdiqlanadi.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization') || '';
  const userToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!userToken) return json({ error: 'Missing Authorization header' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. Chaquvchi kim? (JWT tekshiruvi)
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Invalid session' }, 401);

  // 2. Chaquvchi adminmi? (server tomonida tekshiriladi — RLS'ga tayonmaymiz)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: callerProfile } = await admin.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!callerProfile?.is_admin) return json({ error: 'Not an admin' }, 403);

  // 3. Parolni yangilash
  const { uid, password } = await req.json();
  if (!uid || !password || String(password).length < 8) {
    return json({ error: 'uid and password (min 8 chars) required' }, 400);
  }
  const { error } = await admin.auth.admin.updateUserById(uid, { password: String(password) });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
