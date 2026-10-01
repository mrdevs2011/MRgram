// SpaceMR — send-recovery-email Edge Function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import nodemailer from 'npm:nodemailer@6.9.9';

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

  const emailSubject = 'SpaceMR: Hisobingiz uchun vaqtinchalik parol';
  const emailHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:500px;margin:auto;padding:28px 24px;border:1px solid #1a1a1a;border-radius:14px;background:#050505;color:#f0f0f0;">
      <div style="display:flex;align-items:center;margin-bottom:16px;">
        <div style="font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#ffffff;">SpaceMR</div>
      </div>
      <h2 style="color:#ffffff;font-size:18px;font-weight:600;margin:0 0 12px 0;">Parolni tiklash so'rovi</h2>
      <p style="color:#aaaaaa;font-size:14px;line-height:1.55;margin:0 0 16px 0;">
        Hurmatli <strong>@${username}</strong>,<br>
        Hisobingiz uchun 8 xonali vaqtinchalik parol tayyorlandi:
      </p>
      <div style="margin:20px 0;padding:18px;background:#111111;border:1px solid #222222;border-radius:10px;text-align:center;font-size:26px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:700;letter-spacing:3px;color:#1d9bf0;">
        ${temp_password}
      </div>
      <p style="color:#aaaaaa;font-size:13.5px;line-height:1.5;margin:0 0 14px 0;">
        Ushbu vaqtinchalik parolni login oynasida kiriting. Kirishingiz bilanoq tizim sizdan <strong>yangi shaxsiy parol</strong> o'rnatishni so'raydi.
      </p>
      <p style="color:#666666;font-size:12px;margin:22px 0 0 0;border-top:1px solid #1a1a1a;padding-top:14px;line-height:1.4;">
        Agar siz parolni tiklashni so'ramagan bo'lsangiz, ushbu xabarni e'tiborsiz qoldiring yoki darhol administrator bilan bog'laning.
      </p>
    </div>
  `;

  let emailSent = false;
  let sendError: string | null = null;

  // 2. Email jo'natish provayderlari (Resend, Brevo, SMTP)

  // Provayder A: Resend API
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (resendApiKey) {
    try {
      const fromAddr = Deno.env.get('RESEND_FROM') || 'SpaceMR <onboarding@resend.dev>';
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr,
          to: recoveryEmail,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
      if (emailRes.ok) {
        emailSent = true;
      } else {
        const errJson = await emailRes.json().catch(() => null);
        console.error('[send-recovery-email] Resend error:', emailRes.status, errJson);
        sendError = `Resend: ${errJson?.message || emailRes.statusText}`;
      }
    } catch (e: any) {
      console.error('[send-recovery-email] Resend exception:', e);
      sendError = `Resend exception: ${e?.message}`;
    }
  }

  // Provayder B: Brevo (Sendinblue) API
  const brevoApiKey = Deno.env.get('BREVO_API_KEY');
  if (!emailSent && brevoApiKey) {
    try {
      const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') || 'mrbir460@gmail.com';
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'SpaceMR', email: senderEmail },
          to: [{ email: recoveryEmail }],
          subject: emailSubject,
          htmlContent: emailHtml,
        }),
      });
      if (brevoRes.ok) {
        emailSent = true;
      } else {
        const bErr = await brevoRes.json().catch(() => null);
        console.error('[send-recovery-email] Brevo error:', brevoRes.status, bErr);
        sendError = `Brevo: ${bErr?.message || brevoRes.statusText}`;
      }
    } catch (e: any) {
      console.error('[send-recovery-email] Brevo exception:', e);
      sendError = `Brevo exception: ${e?.message}`;
    }
  }

  // Provayder C: Standart SMTP (Gmail App Password, Mailtrap va h.k.)
  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPass = Deno.env.get('SMTP_PASS');
  if (!emailSent && smtpHost && smtpUser && smtpPass) {
    try {
      const smtpPort = Number(Deno.env.get('SMTP_PORT') || 465);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: Deno.env.get('SMTP_FROM') || `SpaceMR <${smtpUser}>`,
        to: recoveryEmail,
        subject: emailSubject,
        html: emailHtml,
      });
      emailSent = true;
    } catch (e: any) {
      console.error('[send-recovery-email] SMTP exception:', e);
      sendError = `SMTP exception: ${e?.message}`;
    }
  }

  // 3. Javob qaytarish
  return json({
    ok: true,
    masked_email: maskedEmail,
    email_sent: emailSent,
    error_detail: emailSent ? null : (sendError || 'Email provayder sozlanmagan'),
  });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
