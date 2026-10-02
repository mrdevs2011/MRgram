/**
 * auth-recovery.js — parolni unutish / tiklash (kod + yangi parol)
 * auth.js dan ehtiyotkor ajratilgan.
 */
import { sb } from './config.js';
import { $ } from './utils.js';
import { toast } from './toast.js';

const cleanUsername = u => String(u || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

/* ── Parolni unutdingizmi? (8 xonali vaqtinchalik parol) ───────────── */
let _lastTestedUsername = '';
let _lastRecoveryInfo = null;

export function showForgotPasswordBtn(username, recInfo) {
  _lastTestedUsername = username;
  _lastRecoveryInfo = recInfo;
  const wrap = $('forgotPasswordWrap');
  if (wrap) wrap.style.display = 'block';
  const btn = $('forgotPasswordBtn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Parolni unutdingizmi?';
    btn.style.color = 'var(--tg-primary-blue,#1d9bf0)';
    btn.style.cursor = 'pointer';
  }
  const hintEl = $('forgotPasswordHint');
  if (hintEl) {
    hintEl.style.display = 'none';
    hintEl.textContent = '';
  }
}

export function hideForgotPasswordBtn() {
  _lastTestedUsername = '';
  _lastRecoveryInfo = null;
  const wrap = $('forgotPasswordWrap');
  if (wrap) wrap.style.display = 'none';
  const btn = $('forgotPasswordBtn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Parolni unutdingizmi?';
    btn.style.color = 'var(--tg-primary-blue,#1d9bf0)';
    btn.style.cursor = 'pointer';
  }
  const hintEl = $('forgotPasswordHint');
  if (hintEl) {
    hintEl.style.display = 'none';
    hintEl.textContent = '';
  }
}

/** 8 xonali aralash vaqtinchalik parol (masalan: Q123eqwe) */
function gen8CharTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;

  // Kamida 1 ta katta harf, raqamlar va kichik harflar
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

  // Chalkashtirish (Fisher-Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const forgotPasswordBtn = $('forgotPasswordBtn');
if (forgotPasswordBtn) {
  forgotPasswordBtn.onclick = async () => {
    const u = _lastTestedUsername || cleanUsername($('aUsername')?.value);
    if (!u) {
      toast('Foydalanuvchi nomini kiriting', 'error');
      $('aUsername')?.focus();
      return;
    }

    let recInfo = _lastRecoveryInfo;
    if (!recInfo || _lastTestedUsername !== u) {
      try {
        const { data } = await sb.rpc('check_user_recovery', { p_username: u });
        recInfo = data;
        _lastRecoveryInfo = data;
        _lastTestedUsername = u;
      } catch (_) {}
    }

    if (recInfo && !recInfo.exists) {
      toast('Bunday foydalanuvchi topilmadi', 'error');
      return;
    }

    if (recInfo && !recInfo.has_recovery) {
      toast("Ushbu hisobda zaxira email ko'rsatilmagan. Administrator bilan bog'laning", 'warning');
      return;
    }

    // Avtomatik email yubormaymiz! Yagona sodda tiklash kartasini ochamiz:
    openRecoveryModal(u, recInfo.masked_email || 'Emailingiz');
  };
}

/* ── Parolni tiklash oynasi (Yagona sodda karta) ──────────────────── */
const recoveryModal = $('recoveryModal');
const recoveryTargetEmail = $('recoveryTargetEmail');
const recoveryModalSubtitle = $('recoveryModalSubtitle');
const recoverySendBtn = $('recoverySendBtn');
const recoverySendStatus = $('recoverySendStatus');
const recoveryBackBtn = $('recoveryBackBtn');
const recoverySubmitBtn = $('recoverySubmitBtn');
const recoveryCodeInp = $('recoveryCodeInp');
const recoveryNewPwdInp = $('recoveryNewPwdInp');
const recoveryConfirmPwdInp = $('recoveryConfirmPwdInp');
const recoveryErr = $('recoveryErr');

let _activeRecoveryUsername = '';
let _activeMaskedEmail = '';
let _sendCooldownTimer = null;

export function openRecoveryModal(username, maskedEmail, prefilledCode = '') {
  _activeRecoveryUsername = username;
  _activeMaskedEmail = maskedEmail || _activeMaskedEmail || '';
  if (!recoveryModal) return;

  if (recoveryTargetEmail) {
    recoveryTargetEmail.textContent = _activeMaskedEmail || 'Zaxira emailingiz';
  }

  if (recoveryModalSubtitle) {
    if (prefilledCode) {
      recoveryModalSubtitle.innerHTML = `Emailingiz: <strong style="color:var(--tg-primary-blue,#1d9bf0);">${_activeMaskedEmail || 'zaxira email'}</strong><br><span style="color:#22c55e;">Kod qabul qilindi. Yangi parolni belgilang:</span>`;
    } else {
      recoveryModalSubtitle.innerHTML = `Emailingiz: <strong style="color:var(--tg-primary-blue,#1d9bf0);">${_activeMaskedEmail || 'zaxira email'}</strong>`;
    }
  }

  if (recoveryCodeInp) recoveryCodeInp.value = prefilledCode || '';
  if (recoveryNewPwdInp) recoveryNewPwdInp.value = '';
  if (recoveryConfirmPwdInp) recoveryConfirmPwdInp.value = '';
  if (recoveryErr) {
    recoveryErr.style.display = 'none';
    recoveryErr.textContent = '';
  }

  recoveryModal.style.display = 'flex';
  setTimeout(() => {
    if (prefilledCode && recoveryNewPwdInp) {
      recoveryNewPwdInp.focus();
    } else {
      recoveryCodeInp?.focus();
    }
  }, 100);
}

function closeRecoveryModal() {
  if (recoveryModal) recoveryModal.style.display = 'none';
  if (recoveryErr) {
    recoveryErr.style.display = 'none';
    recoveryErr.textContent = '';
  }
}

// "Emailga kod yuborish" tugmasi (kartaning ichida)
if (recoverySendBtn) {
  recoverySendBtn.onclick = async () => {
    const u = _activeRecoveryUsername || $('aUsername')?.value.trim().toLowerCase();
    if (!u) {
      toast('Foydalanuvchi nomini kiriting', 'error');
      return;
    }

    const showErr = (msg) => {
      if (recoveryErr) {
        recoveryErr.textContent = msg;
        recoveryErr.style.display = 'block';
      }
      toast(msg, 'error');
    };

    recoverySendBtn.disabled = true;
    recoverySendBtn.textContent = 'Yuborilmoqda...';
    if (recoveryErr) recoveryErr.style.display = 'none';

    try {
      // Har safar yangi kod yaratiladi — bazada eski barcha kodlar avtomatik eskiradi!
      const tempPassword = gen8CharTempPassword();
      const resp = await sb.functions.invoke('send-recovery-email', {
        body: { username: u, temp_password: tempPassword }
      });

      const data = resp.data;
      const fnErr = resp.error;

      if (fnErr || !data?.ok) {
        const msg = data?.error || fnErr?.message || "Server bilan bog'lanishda xatolik";
        throw new Error(msg);
      }

      if (!data.email_sent) {
        const detail = data.error_detail || "Email yuborishda xatolik yuz berdi";
        throw new Error(detail);
      }

      const masked = data.masked_email || _activeMaskedEmail || '';
      if (masked && recoveryTargetEmail) recoveryTargetEmail.textContent = masked;

      toast(`Yangi kod ${masked || 'emailingiz'} ga yuborildi. Eski kodlar bekor qilindi!`, 'success', 6000);

      if (recoverySendStatus) {
        recoverySendStatus.style.display = 'block';
        recoverySendStatus.innerHTML = `<span style="color:#22c55e;">✓ Yangi kod yuborildi!</span> (Eski kodlar bekor qilindi)`;
      }

      if (recoveryCodeInp) {
        recoveryCodeInp.value = '';
        recoveryCodeInp.placeholder = 'Eng oxirgi kelgan kod';
        recoveryCodeInp.focus();
      }

      // 60 soniyali qayta yuborish taymeri
      let sec = 60;
      if (_sendCooldownTimer) clearInterval(_sendCooldownTimer);
      recoverySendBtn.disabled = true;
      recoverySendBtn.textContent = `Qayta yuborish (${sec}s)`;
      _sendCooldownTimer = setInterval(() => {
        sec--;
        if (sec <= 0) {
          clearInterval(_sendCooldownTimer);
          _sendCooldownTimer = null;
          recoverySendBtn.disabled = false;
          recoverySendBtn.textContent = 'Qayta kod yuborish';
        } else {
          recoverySendBtn.textContent = `Qayta yuborish (${sec}s)`;
        }
      }, 1000);

    } catch (err) {
      console.error('[recoverySendBtn] error:', err);
      showErr(err.message || 'Email yuborishda xatolik yuz berdi');
      recoverySendBtn.disabled = false;
      recoverySendBtn.textContent = 'Emailga kod yuborish';
    }
  };
}

// "Ortga (Eski parolim esimda)" tugmasi
if (recoveryBackBtn) {
  recoveryBackBtn.onclick = () => {
    closeRecoveryModal();
    $('aPassword')?.focus();
  };
}

if (recoverySubmitBtn) {
  recoverySubmitBtn.onclick = async () => {
    const u = _activeRecoveryUsername || $('aUsername')?.value.trim().toLowerCase();
    const code = recoveryCodeInp?.value.trim() || '';
    const newPwd = recoveryNewPwdInp?.value || '';
    const confirmPwd = recoveryConfirmPwdInp?.value || '';

    const showErr = (msg) => {
      if (recoveryErr) {
        recoveryErr.textContent = msg;
        recoveryErr.style.display = 'block';
      }
      toast(msg, 'error');
    };

    if (!code) return showErr('8 xonali tasdiqlash kodini kiriting');
    if (!newPwd || newPwd.length < 6) return showErr('Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak');
    if (newPwd !== confirmPwd) return showErr('Yangi parollar bir-biriga mos kelmadi');

    recoverySubmitBtn.disabled = true;
    recoverySubmitBtn.textContent = 'Tekshirilmoqda...';
    if (recoveryErr) recoveryErr.style.display = 'none';

    try {
      const { data, error } = await sb.rpc('reset_password_with_code', {
        p_username: u,
        p_code: code,
        p_new_password: newPwd,
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Parolni yangilashda xatolik');

      closeRecoveryModal();
      toast('Parolingiz muvaffaqiyatli yangilandi!', 'success');

      // Yangi parol bilan avtomatik tizimga kirish
      const actualEmail = data.email || (u.includes('@') ? u : `${u}@mrspace.local`);
      const { error: signErr } = await sb.auth.signInWithPassword({
        email: actualEmail,
        password: newPwd,
      });

      if (signErr) {
        $('aUsername').value = u;
        $('aPassword').value = newPwd;
        toast('Yangi parolingiz bilan "Kirish" tugmasini bosing', 'info');
      }
    } catch (err) {
      console.error('[reset_password_with_code] error:', err);
      showErr(err.message || 'Tasdiqlash kodi noto\'g\'ri');
    } finally {
      recoverySubmitBtn.disabled = false;
      recoverySubmitBtn.textContent = 'Parolni yangilash va kirish';
    }
  };
}

