// DIET F2 — Admin parol reset Edge Function.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const userToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!userToken) return json({ error: 'Missing Authorization header' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // JWT ni to'g'ridan-to'g'ri getUser(jwt) ga beramiz — header orqali emas
  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(userToken);
  if (userErr || !userData?.user) {
    return json({ error: 'Invalid session', detail: userErr?.message || null }, 401);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single();
  if (!callerProfile?.is_admin) return json({ error: 'Not an admin' }, 403);

  let body: { uid?: string; password?: string } = {};
  try { body = await req.json(); } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { uid, password } = body;
  if (!uid || !password || String(password).length < 8) {
    return json({ error: 'uid and password (min 8 chars) required' }, 400);
  }
  const { error } = await admin.auth.admin.updateUserById(uid, { password: String(password) });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
