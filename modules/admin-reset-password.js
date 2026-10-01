/**
 * SpaceMR — Admin parol reset (UI modal, alert/confirm yo'q).
 *
 * Ish tartibi:
 *  1. Admin foydalanuvchining "Parolni tiklash" tugmasini bosganda chiroyli UI modal ochiladi.
 *  2. Modal tasdiqni so'raydi va tizim tomonidan yaratilgan vaqtinchalik parolni ko'rsatadi.
 *  3. Admin "Parolni tiklash" tugmasini bosgach:
 *     - DB RPC admin_reset_user_password (yoki Edge Function) orqali auth.users va profiles yangilanadi.
 *     - profiles da must_change_password=true va password_changed_at=now() o'rnatiladi.
 *     - user-session-{uid} kanaliga 'password_changed' broadcast yuboriladi (barcha boshqa sessiyalar darhol yopiladi).
 *  4. Muvaffaqiyatli tiklangach, modalda 1-bosishda nusxalash tugmasi bilan vaqtinchalik parol taqdim etiladi.
 */
import { sb, state } from './config.js';
import { toast } from './toast.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env.js';
import { $, lockScroll, unlockScroll } from './utils.js';

/* O'qib bo'ladigan vaqtinchalik parol (0/O/1/l/I harflari yo'q) */
function genTempPassword() {
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const rnd = new Uint32Array(10);
  crypto.getRandomValues(rnd);
  for (let i = 0; i < 10; i++) s += ABC[rnd[i] % ABC.length];
  return s;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Parol nusxalandi', 'success');
  } catch (_) {
    toast('Parol nusxalandi', 'info');
  }
}

let _currentResetUid = null;
let _currentTempPwd = '';

export function adminResetPassword(uid, displayName) {
  if (!state.me?.isAdmin) { toast('Ruxsat yo\'q', 'error'); return; }
  if (!uid) return;

  _currentResetUid = uid;
  _currentTempPwd = genTempPassword();

  const overlay = $('adminResetPwdOverlay');
  const stepConfirm = $('adminResetPwdStepConfirm');
  const stepResult = $('adminResetPwdStepResult');
  const userSubtitle = $('adminResetPwdUserSubtitle');
  const tempInput = $('adminResetTempPwdInput');
  const submitBtn = $('adminResetSubmitBtn');

  if (!overlay || !stepConfirm || !stepResult) {
    console.error('[adminResetPassword] Overlay elementlari topilmadi');
    return;
  }

  if (userSubtitle) userSubtitle.textContent = displayName ? `${displayName}` : 'Tanlangan foydalanuvchi hisobi';
  if (tempInput) tempInput.value = _currentTempPwd;

  stepConfirm.style.display = 'block';
  stepResult.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Parolni tiklash';
  }

  overlay.style.display = 'flex';
  lockScroll();

  // Qayta yaratish tugmasi
  const regenBtn = $('adminResetRegenBtn');
  if (regenBtn) {
    regenBtn.onclick = () => {
      _currentTempPwd = genTempPassword();
      if (tempInput) tempInput.value = _currentTempPwd;
    };
  }

  // Bekor qilish tugmasi
  const cancelBtn = $('adminResetCancelBtn');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      overlay.style.display = 'none';
      unlockScroll();
    };
  }

  // Yopish (Tushunarli) tugmasi
  const doneBtn = $('adminResetDoneBtn');
  if (doneBtn) {
    doneBtn.onclick = () => {
      overlay.style.display = 'none';
      unlockScroll();
    };
  }

  // Nusxalash tugmasi
  const copyBtn = $('adminResetCopyBtn');
  if (copyBtn) {
    copyBtn.onclick = () => copyText(_currentTempPwd);
  }

  // Parolni tiklash tasdig'i
  if (submitBtn) {
    submitBtn.onclick = async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Tiklanmoqda...';

      try {
        let resetSuccess = false;
        let lastError = null;

        // 1. Avval to'g'ridan-to'g'ri RPC admin_reset_user_password orqali urinib ko'ramiz
        try {
          const { error: rpcErr } = await sb.rpc('admin_reset_user_password', {
            p_uid: _currentResetUid,
            p_temp_password: _currentTempPwd,
          });
          if (!rpcErr) {
            resetSuccess = true;
          } else {
            lastError = rpcErr;
          }
        } catch (e) {
          lastError = e;
        }

        // 2. Agar RPC muvaffaqiyatsiz bo'lsa, Edge Function orqali urinib ko'ramiz
        if (!resetSuccess) {
          const { data: sessData } = await sb.auth.getSession();
          let token = sessData?.session?.access_token;
          if (!token) {
            const { data: ref } = await sb.auth.refreshSession();
            token = ref?.session?.access_token;
          }
          if (!token) throw new Error('Sessiya topilmadi — qayta kiring');

          const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-reset-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ uid: _currentResetUid, password: _currentTempPwd }),
          });
          const out = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(out.error || out.message || lastError?.message || `HTTP ${res.status}`);
          resetSuccess = true;
        }

        // 3. Barcha qurilmalardagi mavjud sessiyalarni darhol to'xtatish uchun broadcast
        try {
          const ch = sb.channel('user-session-' + _currentResetUid);
          await ch.subscribe();
          await ch.send({
            type: 'broadcast',
            event: 'password_changed',
            payload: { sessionId: 'admin_reset', at: Date.now(), forced: true }
          });
        } catch (_) {}

        // 4. Muvaffaqiyat oynasini ko'rsatish
        const resultPwd = $('adminResetResultPwdText');
        if (resultPwd) resultPwd.textContent = _currentTempPwd;

        stepConfirm.style.display = 'none';
        stepResult.style.display = 'block';

        toast('Parol muvaffaqiyatli tiklandi', 'success');
      } catch (err) {
        console.error('[admin-reset-password]', err);
        toast('Xatolik: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Parolni tiklash';
      }
    };
  }
}
