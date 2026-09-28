/**
 * DIET F2 — Admin parol reset (YANGI funksiya).
 * Buvi/nabira parolni unutmasa katta muammo edi: oldin admin panelda
 * uni bajaradigan tugma yo'q edi.
 *
 * Ish tartibi:
 *  1. Brauzer Edge Function'ni JWT bilan chaqiradi.
 *  2. Funksiya serverda is_admin() ni tekshiradi va service_role kaliti
 *     bilan auth.admin.updateUserById orqali parolni yangilaydi.
 *  3. Vaqtinchalik parol faqat bir marta adminga ko'rsatiladi (e'londa
 *     yoki DB'da saqlanmaydi). Qaror Q5: keyingi kirishda majburiy
 *     almashtirish YO'Q (soddalik uchun).
 */
import { sb, state } from './config.js';
import { toast } from './toast.js';
import { SUPABASE_URL } from './env.js';
import { esc } from './utils.js';

/* O'qib bo'ladigan vaqtinchalik parol (0/O/1/l/I harflari yo'q) */
function genTempPassword() {
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const rnd = new Uint32Array(10);
  crypto.getRandomValues(rnd);
  for (let i = 0; i < 10; i++) s += ABC[rnd[i] % ABC.length];
  return s;
}

export async function adminResetPassword(uid, displayName) {
  if (!state.me?.isAdmin) { toast('Ruxsat yo\'q', 'error'); return; }

  const msg = `${displayName || 'Bu foydalanuvchi'} ning parolini yangi\n` +
              `vaqtinchalik parolga almashtiramizmi?\n\n` +
              `Eslatma: eski sessiyalar bekor bo'ladi, u keyingi kirishda\n` +
              `yangi parolni ishlatadi. Parolni telefon orqali aytib bering.`;
  if (!confirm(msg)) return;

  const tempPwd = genTempPassword();
  try {
    const token = await sb.auth.getSession().then(r => r.data.session?.access_token);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ uid, password: tempPwd }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || out.message || `HTTP ${res.status}`);

    // Natijani ekranda bir marta ko'rsatish (screenshot olish mumkin)
    alert(`✅ Yangi vaqtinchalik parol:\n\n${tempPwd}\n\n` +
          `Foydalanuvchiga bildiring. Bu parol hech qayerda saqlanmaydi —\n` +
          `hozir nusxalang yoki suratga oling.`);
    toast('Parol yangilandi', 'success');
  } catch (err) {
    console.error('[admin-reset-password]', err);
    toast('Parol reset xatosi: ' + err.message, 'error');
  }
}
