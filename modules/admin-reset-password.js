/**
 * SpaceMR — Admin parol tiklash (OTP access code).
 *
 * Logika:
 *  1. Admin foydalanuvchining "Parolni tiklash" tugmasini bosganda UI modal ochiladi.
 *  2. Foydalanuvchining joriy paroli O'ZGARTIRILMAYDI.
 *  3. Xuddi "Parolni unutdingizmi" kabi bir martalik 8 xonali tiklash kodi (OTP access code) yaratiladi.
 *  4. Agar foydalanuvchining zaxira emaili bo'lsa, avtomatik ravishda emailga xat yuboriladi.
 *  5. Shuningdek, kod admin modalida ham ko'rsatiladi (1-bosishda nusxalash imkoniyati bilan).
 *  6. Foydalanuvchi ushbu kod orqali SpaceMR login oynasida (yoki "Parolni unutdingizmi" orqali)
 *     o'ziga yangi shaxsiy parol belgilaydi.
 */
import { sb, state } from './config.js';
import { toast } from './toast.js';
import { $, lockScroll, unlockScroll } from './utils.js';

/* 8 xonali chalkash vaqtinchalik tiklash kodi (masalan: Q123eqwe) */
function genTempCode() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;

  const chars = [
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
    digits[Math.floor(Math.random() * digits.length)],
    digits[Math.floor(Math.random() * digits.length)],
    lower[Math.floor(Math.random() * lower.length)],
    lower[Math.floor(Math.random() * lower.length)],
    lower[Math.floor(Math.random() * lower.length)],
    all[Math.floor(Math.random() * all.length)]
  ];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0] || '*'}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
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
    toast('Kod nusxalandi', 'success');
  } catch (_) {
    toast('Kod nusxalandi', 'info');
  }
}

let _currentResetUid = null;
let _currentTempCode = '';
let _regenRot = 0;

export async function adminResetPassword(uid, displayName, userMeta = null) {
  if (!state.me?.isAdmin) { toast('Ruxsat yo\'q', 'error'); return; }
  if (!uid) return;

  _currentResetUid = uid;
  _currentTempCode = genTempCode();

  const overlay = $('adminResetPwdOverlay');
  const stepConfirm = $('adminResetPwdStepConfirm');
  const stepResult = $('adminResetPwdStepResult');
  const userSubtitle = $('adminResetPwdUserSubtitle');
  const tempInput = $('adminResetTempPwdInput');
  const submitBtn = $('adminResetSubmitBtn');
  const warnText = $('adminResetWarnText');
  const resultSubtitle = $('adminResetResultSubtitle');

  if (!overlay || !stepConfirm || !stepResult) {
    console.error('[adminResetPassword] Overlay elementlari topilmadi');
    return;
  }

  // Foydalanuvchi ma'lumotlarini aniqlash (username va zaxira email)
  let username = userMeta?.username || '';
  let recEmail = userMeta?.recoveryEmail || '';

  if (!username) {
    try {
      const { data } = await sb.from('profiles').select('id, username, full_name, recovery_email').eq('id', uid).maybeSingle();
      if (data) {
        username = data.username || '';
        recEmail = data.recovery_email || '';
      }
    } catch (_) {}
  }

  const masked = maskEmail(recEmail);
  const displayLabel = displayName || (username ? `@${username}` : 'Foydalanuvchi');

  if (userSubtitle) {
    userSubtitle.innerHTML = username
      ? `@${username}${masked ? ` · <span style="color:#22c55e;font-weight:500;">✉️ ${masked}</span>` : ' · <span style="color:var(--text3,#888);font-weight:400;">(zaxira email yo\'q)</span>'}`
      : displayLabel;
  }

  if (warnText) {
    warnText.innerHTML = masked
      ? `Foydalanuvchining joriy paroli o'chirilmaydi. Bir martalik tiklash kodi (OTP) yaratiladi va <strong style="color:var(--tg-primary-blue,#1d9bf0);">${masked}</strong> emailiga yuboriladi.`
      : `Foydalanuvchining joriy paroli o'chirilmaydi. Hisobga zaxira email biriktirilmagan, shuning uchun bir martalik tiklash kodini (OTP) foydalanuvchiga to'g'ridan-to'g'ri taqdim etishingiz kerak bo'ladi.`;
  }

  if (tempInput) tempInput.value = _currentTempCode;

  stepConfirm.style.display = 'block';
  stepResult.style.display = 'none';
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = masked ? 'Tiklash kodini yuborish' : 'Tiklash kodini yaratish';
  }

  overlay.style.display = 'flex';
  lockScroll();

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
      unlockScroll();
    }
  };

  // Qayta yaratish tugmasi
  const regenBtn = $('adminResetRegenBtn');
  if (regenBtn) {
    regenBtn.onclick = () => {
      _currentTempCode = genTempCode();
      if (tempInput) tempInput.value = _currentTempCode;
      const svg = regenBtn.querySelector('svg');
      if (svg) {
        _regenRot += 360;
        svg.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        svg.style.transform = `rotate(${_regenRot}deg)`;
      }
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

  // Yopish (Tayyor) tugmasi
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
    copyBtn.onclick = () => copyText(_currentTempCode);
  }

  // Tiklash kodini tasdiqlash
  if (submitBtn) {
    submitBtn.onclick = async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Kod yaratilmoqda...';

      try {
        let codeSuccess = false;
        let lastError = null;

        // 1. Avval RPC admin_reset_user_password orqali profiles.recovery_code ni o'rnatamiz
        try {
          const { error: rpcErr } = await sb.rpc('admin_reset_user_password', {
            p_uid: _currentResetUid,
            p_temp_password: _currentTempCode,
          });
          if (!rpcErr) {
            codeSuccess = true;
          } else {
            lastError = rpcErr;
          }
        } catch (e) {
          lastError = e;
        }

        // 2. Agar RPC muvaffaqiyatsiz bo'lsa (masalan yangi migratsiya hali bajarilmagan bo'lsa), to'g'ridan-to'g'ri profiles ni yangilaymiz
        if (!codeSuccess) {
          const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
          const { error: updErr } = await sb.from('profiles').update({
            recovery_code: _currentTempCode,
            recovery_code_expires_at: expiresAt,
            recovery_attempts: 0
          }).eq('id', _currentResetUid);

          if (!updErr) {
            codeSuccess = true;
          } else {
            throw new Error(updErr.message || lastError?.message || 'Tiklash kodini o\'rnatishda xatolik');
          }
        }

        // 3. Agar foydalanuvchida zaxira email bo'lsa, xuddi "Parolni unutdingizmi" kabi emailga yuboramiz
        let emailSent = false;
        if (recEmail && username) {
          try {
            submitBtn.textContent = 'Emailga yuborilmoqda...';
            const resp = await sb.functions.invoke('send-recovery-email', {
              body: { username: username, temp_password: _currentTempCode }
            });
            if (resp.data?.ok && resp.data?.email_sent) {
              emailSent = true;
            }
          } catch (mailErr) {
            console.warn('[admin-reset-password] send-recovery-email error:', mailErr);
          }
        }

        // 4. Muvaffaqiyat oynasini ko'rsatish
        const resultPwd = $('adminResetResultPwdText');
        if (resultPwd) resultPwd.textContent = _currentTempCode;

        if (resultSubtitle) {
          if (emailSent) {
            resultSubtitle.innerHTML = `<span style="color:#22c55e;font-weight:600;">✓ Kod foydalanuvchining ${masked || 'zaxira'} emailiga yuborildi.</span><br>Shuningdek, kodni quyidan nusxalab to'g'ridan-to'g'ri berishingiz mumkin:`;
          } else if (recEmail) {
            resultSubtitle.innerHTML = `Tiklash kodi yaratildi. (Email orqali yetkazishda xatolik bo'lishi mumkin). Quyidagi kodni foydalanuvchiga bering:`;
          } else {
            resultSubtitle.innerHTML = `Foydalanuvchida zaxira email yo'q. Quyidagi bir martalik tiklash kodini (OTP) foydalanuvchiga taqdim eting:`;
          }
        }

        stepConfirm.style.display = 'none';
        stepResult.style.display = 'block';

        toast(emailSent ? 'Tiklash kodi yaratildi va emailga yuborildi!' : 'Tiklash kodi muvaffaqiyatli yaratildi', 'success');
      } catch (err) {
        console.error('[admin-reset-password]', err);
        toast('Xatolik: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = masked ? 'Tiklash kodini yuborish' : 'Tiklash kodini yaratish';
      }
    };
  }
}
