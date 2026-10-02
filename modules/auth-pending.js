/**
 * auth-pending.js — ruxsat kutish / blok / offline-verify ekranlari
 */
import { sb, state } from './config.js';
import { $ } from './utils.js';

let _serverNow = () => Date.now();
let _onBlockExpired = null;
let _onPendingSignOut = null;

export function initAuthPending(opts = {}) {
  if (typeof opts.serverNow === 'function') _serverNow = opts.serverNow;
  _onBlockExpired = opts.onBlockExpired || null;
  _onPendingSignOut = opts.onPendingSignOut || null;
}

/* ── Ruxsat kutish ekrani ────────────────────────────────────────────── */
let _approvalListener = null;
let _noticeUnsubPending = null;

function _updatePendingNotice(noticeData) {
  const container = document.getElementById('pendingNoticeWrap');
  if (!container) return;
  if (!noticeData || !noticeData.text) {
    container.style.display = 'none';
    container.textContent = '';
    return;
  }
  const t = noticeData.target || 'all';
  if (t === 'approved') {
    // Faqat tasdiqlanganlarga — kutayotganlar ko'rmasin
    container.style.display = 'none';
    container.textContent = '';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tg-primary-blue,#ffffff)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span>${noticeData.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>
  `;
}

function _startPendingNoticeWatcher() {
  if (_noticeUnsubPending) return;
  let dead = false, ch = null;
  const load = async () => {
    try {
      const { data } = await sb.from('admin_notice').select('text,target').eq('id', 'global').maybeSingle();
      if (!dead) _updatePendingNotice(data || null);
    } catch (e) { console.warn('[auth]', e?.message || e); }
  };
  load();
  try {
    ch = sb.channel('pending-notice')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notice' }, () => load())
      .subscribe();
  } catch (_) {}
  _noticeUnsubPending = () => { dead = true; if (ch) sb.removeChannel(ch); };
}

function _stopPendingNoticeWatcher() {
  if (_noticeUnsubPending) { _noticeUnsubPending(); _noticeUnsubPending = null; }
  _updatePendingNotice(null);
}

/* ── Blocked countdown timer ─────────────────────────────────────────── */
let _blockedCountdownInterval = null;

function _stopBlockedCountdown() {
  if (_blockedCountdownInterval) {
    clearInterval(_blockedCountdownInterval);
    _blockedCountdownInterval = null;
  }
}

function _startBlockedCountdown(blockedUntilMs, onExpire = null) {
  _stopBlockedCountdown();
  const el = document.getElementById('blockedCountdownWrap');
  if (!el) return;

  const update = () => {
    const now = _serverNow();
    const diff = blockedUntilMs - now;
    if (diff <= 0) {
      el.style.display = 'none';
      _stopBlockedCountdown();
      if (typeof onExpire === 'function') onExpire();
      return;
    }
    const totalSec = Math.ceil(diff / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    let parts = [];
    if (d > 0) parts.push(`${d} kun`);
    if (h > 0) parts.push(`${h} soat`);
    if (m > 0) parts.push(`${m} daqiqa`);
    parts.push(`${s} soniya`);

    const untilStr = new Date(blockedUntilMs).toLocaleString('uz-UZ');
    el.style.display = 'block';
    el.innerHTML = `
      <div style="font-size:13px;color:var(--text2,#999);margin-bottom:6px;">Blok muddati tugashiga:</div>
      <div id="blockedCountdownTimer" style="font-size:2rem;font-weight:800;color:var(--red,#ef4444);letter-spacing:1px;font-variant-numeric:tabular-nums;">${parts.join(' ')}</div>
      <div style="font-size:12px;color:var(--text2,#999);margin-top:6px;">${untilStr} gacha bloklangansiz</div>
    `;
  };

  update();
  _blockedCountdownInterval = setInterval(update, 1000);
}


export function showPendingScreen(reason = 'pending', blockedUntilMs = null) {
  const screen = $('pendingApprovalScreen');
  const app    = $('app');
  const authWrap = $('authWrap');

  // Matnni holatga qarab o'zgartirish
  const h2 = screen?.querySelector('h2');
  const p  = screen?.querySelector('p');
  const countdownWrap = document.getElementById('blockedCountdownWrap');

  _stopBlockedCountdown();
  if (countdownWrap) countdownWrap.style.display = 'none';

  if (reason === 'blocked') {
    if (h2) h2.textContent = 'Hisobingiz bloklangan';
    if (p) {
      if (blockedUntilMs && blockedUntilMs > _serverNow()) {
        p.innerHTML = `Siz admin tomonidan vaqtinchalik <strong style="color:var(--red,#ef4444)">bloklangansiz.</strong><br>Muddat tugagach avtomatik ochilasiz.`;
        _startBlockedCountdown(blockedUntilMs, async () => {
          // Vaqt tugadi — pending ekranni yashirib app ga kiritamiz
          hidePendingScreen();
          if (typeof _onBlockExpired === 'function') await _onBlockExpired();
        });
      } else {
        p.innerHTML = `Siz admin tomonidan <strong style="color:var(--text,#fff)">bloklangansiz.</strong><br>Qo'shimcha ma'lumot uchun administratorga murojaat qiling.`;
        if (countdownWrap) countdownWrap.style.display = 'none';
      }
    }
  } else if (reason === 'rejected') {
    if (h2) h2.textContent = 'Arizangiz rad etildi';
    if (p)  p.innerHTML = `Afsuski, admin sizning arizangizni <strong style="color:var(--red,#ef4444)">rad etdi.</strong><br>Qo'shimcha ma'lumot uchun administratorga murojaat qiling.`;
  } else if (reason === 'offline-verify') {
    if (h2) h2.textContent = 'Internetga ulaning';
    if (p)  p.innerHTML = `Hisobingiz holatini xavfsiz tekshirish uchun internet aloqasi kerak.<br>Uzoq vaqt oflayn holda ilovadan foydalanib bo'lmaydi — bu xavfsizlik cheklovi.<br>Internet qaytishi bilan avtomatik davom etadi.`;
  } else {
    if (h2) h2.textContent = 'Ruxsat kutilmoqda';
    if (p)  p.innerHTML = `Hisobingiz muvaffaqiyatli yaratildi.<br><strong style="color:var(--text,#fff)">Administrator ruxsatini kuting.</strong><br>Ruxsat berilgandan so'ng avtomatik kirasiz.`;
  }

  if (screen)   { screen.style.display = 'flex'; screen.dataset.reason = reason; }
  if (app)      { app.classList.remove('show'); }
  if (authWrap) { authWrap.classList.remove('show'); }
  if (reason === 'pending') _startPendingNoticeWatcher();
}

// Offline-verify ekrani ko'rsatilgan bo'lsa — internet qaytishi bilan avtomatik
// qayta tekshiramiz (to'liq reload — onAuthStateChanged qayta ishga tushib,
// haqiqiy serverdan yangi holatni oladi).
window.addEventListener('online', () => {
  const screen = $('pendingApprovalScreen');
  if (screen && screen.dataset.reason === 'offline-verify' && screen.style.display !== 'none') {
    location.reload();
  }
});

export function hidePendingScreen() {
  const screen = $('pendingApprovalScreen');
  if (screen) { screen.style.display = 'none'; }
  _stopPendingNoticeWatcher();
  _stopBlockedCountdown();
}

// "Chiqish" tugmasi — pending ekrandagi
const pendingSignOutBtn = $('pendingSignOutBtn');
if (pendingSignOutBtn) {
  pendingSignOutBtn.addEventListener('click', async () => {
    if (typeof _onPendingSignOut === 'function') await _onPendingSignOut();
    hidePendingScreen();
    try { await sb.auth.signOut(); } catch (_) {}
    location.replace('/');
  });
}

