// SpaceMR — send-recovery-email Edge Function
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

  let body: { username?: string; temp_password?: string } = {};
  try { body = await req.json(); } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { username, temp_password } = body;
  if (!username || !temp_password) {
    return json({ error: 'username and temp_password required' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. request_password_reset RPC ni chaqiramiz
  const { data: resData, error: resErr } = await admin.rpc('request_password_reset', {
    p_username: username,
    p_temp_password: temp_password,
  });

  if (resErr) {
    return json({ error: resErr.message }, 400);
  }

  const recoveryEmail = resData?.recovery_email;
  const maskedEmail = resData?.masked_email;

  if (!recoveryEmail) {
    return json({ error: 'Zaxira email topilmadi' }, 400);
  }

  // 2. Email xabarini jo'natish
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  let emailSent = false;

  if (resendApiKey) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SpaceMR Xavfsizlik <security@spacemr.com>',
          to: recoveryEmail,
          subject: 'SpaceMR: Hisobingiz uchun vaqtinchalik parol',
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
              <h2 style="color:#111;margin-bottom:8px;">SpaceMR hisobingiz parolini tiklash</h2>
              <p style="color:#555;font-size:14px;line-height:1.5;">
                Hurmatli <strong>@${username}</strong>,<br>
                Hisobingiz uchun yangi 8 xonali vaqtinchalik parol tayyorlandi:
              </p>
              <div style="margin:20px 0;padding:16px;background:#f3f4f6;border-radius:8px;text-align:center;font-size:24px;font-family:monospace;font-weight:bold;letter-spacing:2px;color:#1d9bf0;">
                ${temp_password}
              </div>
              <p style="color:#555;font-size:13px;line-height:1.5;">
                Ushbu vaqtinchalik parol bilan hisobingizga kiring. Kirishingiz bilanoq tizim sizdan <strong>yangi shaxsiy parol</strong> o'rnatishni so'raydi.
              </p>
              <p style="color:#999;font-size:12px;margin-top:20px;border-top:1px solid #eee;padding-top:12px;">
                Agar siz parolni tiklashni so'ramagan bo'lsangiz, zudlik bilan administrator bilan bog'laning.
              </p>
            </div>
          `,
        }),
      });
      if (emailRes.ok) emailSent = true;
    } catch (e) {
      console.warn('[send-recovery-email] Resend xatosi:', e);
    }
  }

  // 3. Javob qaytarish
  return json({
    ok: true,
    masked_email: maskedEmail,
    email_sent: emailSent,
    dev_code: emailSent ? null : temp_password,
  });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
