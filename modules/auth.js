import { sb, state, uploadViaController, mapProfile, mapPost, purgeUserMedia } from './config.js';
import { $, esc, defAvi, uToEmail, lockScroll, unlockScroll, showConfirm } from './utils.js';
import { toast }                       from './toast.js';
import { initPush, removePushToken, areNotificationsEnabled, setNotificationsEnabled, notificationsUserDisabled } from './push.js';
import { startChatsWatcher, stopChatsWatcher, repaintNoticeBanner } from './chat.js';
import { startCallWatcher, stopCallWatcher } from './call.js';
import { clearAllCache, cachePosts, getCachedPosts, clearRuntimeCache, getCachedProfile } from './local-cache.js';

/* ── Server vaqti sinxronizatsiyasi ────────────────────────────────────
   Foydalanuvchi lokal soatini o'zgartirsa ham ban muddati to'g'ri ishlaydi.
   Supabase server_now() dan real vaqt olib, local offset saqlanadi.
   serverNow() => real server vaqti (ms) — Date.now() o'rniga ishlatiladi.

   ESLATMA (tuzatish): ilgari offline bo'lganda offset 0 ga qaytarilar edi —
   ya'ni serverNow() aslida "Date.now()" bilan bir xil bo'lib qolardi. Bu
   degani: foydalanuvchi telefon SOATINI oldinga surib, vaqtli blokning
   "muddati o'tgan" ko'rinishini offline holatda ham hosil qila olardi.
   Endi performance.now() — apparat darajasidagi MONOTONIK taymerdan
   foydalanamiz: bu taymer tizim sanasi/vaqti o'zgartirilsa ham ta'sirlanmaydi
   (faqat qurilma qayta yoqilsa yoki sahifa qayta yuklansa sinxronlanadi).
   Shu bilan "soatni oldinga surib blokdan qochish" firibgarligi online
   bo'lsin, offline bo'lsin — sinxronizatsiya bir marta bo'lgan bo'lsa —
   butunlay yopiladi. ─────────────────────────────────────────────────── */
let _serverTimeOffset = 0; // legacy — endi to'g'ridan-to'g'ri ishlatilmaydi, moslik uchun saqlangan
let _serverTimeSynced = false;
let _syncedServerMs = null; // oxirgi sinxronizatsiyadagi server vaqti (ms)
let _syncedPerf      = null; // o'sha paytdagi performance.now() (monotonik nuqta)

async function _syncServerTime() {
  // Offline bo'lsa urinmaymiz — oldingi sinxronlangan qiymatlar saqlanadi
  // (aks holda soatni surib blokdan qochish mumkin bo'lib qolardi).
  if (!navigator.onLine) return;
  try {
    const t0 = performance.now();
    const { data, error } = await sb.rpc('server_now');
    if (error || !data) throw error || new Error('server_now bo\'sh');
    const rtt = performance.now() - t0;
    const serverMs = Date.parse(data) + rtt / 2;
    _syncedServerMs   = serverMs;
    _syncedPerf       = performance.now();
    _serverTimeOffset = serverMs - Date.now();
    _serverTimeSynced = true;
  } catch (err) {
    console.warn('[Auth] Server vaqti sinxronizatsiya xatosi:', err?.message);
    // Oldingi _syncedServerMs/_syncedPerf qiymatlarini SAQLAB QOLAMIZ.
  }
}

/** Hozirgi haqiqiy server vaqti (ms). Date.now() o'rniga ishlating. */
function serverNow() {
  if (_syncedServerMs != null && _syncedPerf != null) {
    // Monotonik hisob — tizim sanasi/vaqti o'zgartirilsa ham to'g'ri.
    return _syncedServerMs + (performance.now() - _syncedPerf);
  }
  // Hali birorta sinxronizatsiya bo'lmagan bo'lsa (masalan ilova internetsiz
  // birinchi marta ochilgan) — noiloj tizim soatiga tayanamiz.
  return Date.now();
}

/* ── Offline holatda "oxirgi tasdiqlangan holat" keshi ──────────────────
   MUAMMO: avval offline bo'lganda Firestore SDK ning O'ZI qaytargan
   (tarmoqqa yetib bormagan, ya'ni ehtimol ESKI) kesh hujjatiga to'liq
   ishonilardi. Agar admin sizni bloklagan payt siz allaqachon offline
   bo'lsangiz (yoki bloklangandan keyin offline bo'lib qolsangiz), keshdagi
   "blocked: false" ma'lumoti abadiy ishlatilaverar edi.

   YECHIM: har safar SERVERDAN tasdiqlangan (fromCache=false) holatni
   localStorage'ga yozib boramiz. Keyingi safar profil so'rovi natijasi
   fromCache=true (ya'ni internetga yetib bormagan) bo'lsa, ushbu oxirgi
   tasdiqlangan holatga qaraymiz — agar u "blocked" bo'lsa, offline bo'lsa
   ham ilovaga kiritilmaydi. Bundan tashqari, tasdiqlangan holat juda eski
   bo'lsa (OFFLINE_TRUST_MS dan ko'p), "internetga ulaning" ekrani chiqadi —
   ya'ni abadiy offline yurib, tekshiruvdan MUTLAQO qochib bo'lmaydi. ─── */
const OFFLINE_TRUST_MS = 15 * 60 * 1000; // 15 daqiqa

function _verifiedKey(uid) { return `mrg_verified_${uid}`; }

function _saveVerifiedState(uid, data) {
  try {
    const blockedUntilMs = data.blockedUntil?.toMillis ? data.blockedUntil.toMillis() : (data.blockedUntil || null);
    localStorage.setItem(_verifiedKey(uid), JSON.stringify({
      blocked:      data.blocked === true,
      blockedUntil: blockedUntilMs,
      approved:     data.approved,
      at:           Date.now(),
    }));
  } catch(_) {}
}

function _getVerifiedState(uid) {
  try {
    const raw = localStorage.getItem(_verifiedKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch(_) { return null; }
}

/** Offline/ishonchsiz (fromCache) holatda kirish qarorini qabul qiladi.
 * true qaytarsa — ilovaga kiritish MUMKIN (bloklanmagan yoki hali
 * tekshirilmagan yangi qurilma). false qaytarsa — blocked/pending ekran
 * ko'rsatilishi kerak (chaqiruvchi buni o'zi bajaradi). */
function _offlineAccessDecision(uid) {
  const vs = _getVerifiedState(uid);
  if (!vs) return { allow: true, reason: 'no-verified-state' };

  const age = Date.now() - (vs.at || 0);
  if (vs.blocked && (!vs.blockedUntil || vs.blockedUntil > serverNow())) {
    return { allow: false, blocked: true, blockedUntil: vs.blockedUntil };
  }
  if (age > OFFLINE_TRUST_MS) {
    return { allow: false, needsVerify: true };
  }
  return { allow: true, reason: 'verified-clean' };
}

/* ── Kirish tarixi: har bir login/sessiya tiklanganda yangi yozuv ────── */
async function _logLoginHistory(uid, type) {
  try {
    await sb.from('login_history').insert({
      user_id: uid,
      type, // 'login' | 'session'
      user_agent: navigator.userAgent || null,
      platform: navigator.platform || null,
    });
  } catch (_) { /* tarixni yoza olmasak ham ilova ishlashda davom etsin */ }
}

/* ── Render callbacks injected by script.js ──────────────────────────── */
let _cb = {};
export function setRenderCallbacks(callbacks) {
  _cb = callbacks;
}

/* ── Auth form state ─────────────────────────────────────────────────── */
let isLogin = true;

const authSwitchBtn = $('authSwitchBtn');
if (authSwitchBtn) {
  authSwitchBtn.onclick = () => {
    isLogin = !isLogin;
    $('authTitle').textContent      = isLogin ? 'Hisobingizga kiring' : 'Hisob yaratish';
    $('authBtn').textContent        = isLogin ? 'Kirish' : 'Ro\'yxatdan o\'tish';
    $('authSwitchText').textContent = isLogin ? 'Hisobingiz yo\'qmi? ' : 'Hisobingiz bormi? ';
    authSwitchBtn.textContent         = isLogin ? 'Ro\'yxatdan o\'tish' : 'Kirish';
    $('nameRow').style.display      = isLogin ? 'none' : 'block';
    $('confirmRow').style.display   = isLogin ? 'none' : 'block';
    $('authErr').textContent = '';
  };
}

/* ── Supabase xatolarini o'zbekchaga tarjima ─────────────────────────── */
function sbErrUz(err) {
  const msg = String(err?.message || '').toLowerCase();
  const code = err?.code || '';
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Foydalanuvchi nomi yoki parol xato';
  }
  if (msg.includes('already registered') || msg.includes('already been registered') || code === 'user_already_exists') {
    return 'Bu login allaqachon band';
  }
  if (msg.includes('password should be at least') || code === 'weak_password') {
    return `Parol kamida 6 ta belgi bo'lishi kerak`;
  }
  if (err?.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return `Juda ko'p urinish. Biroz kuting`;
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || err?.name === 'AuthRetryableFetchError') {
    return `Internet aloqasi yo'q`;
  }
  if (msg.includes('banned') || msg.includes('disabled')) {
    return 'Bu hisob bloklangan';
  }
  return `Xatolik yuz berdi. Qayta urinib ko'ring`;
}

/** Login normalizatsiyasi: kichik harf, faqat a-z 0-9 _ */
const _cleanUsername = u => String(u || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

/** Username → auth email. Avval DB'dagi haqiqiy email (email_for_username),
 *  topilmasa uToEmail() bilan taxmin qilinadi. */
async function _emailForLogin(cleaned) {
  try {
    const { data } = await sb.rpc('email_for_username', { p_username: cleaned });
    if (data) return data;
  } catch (_) { /* tarmoq xatosi — taxmin qilamiz */ }
  return uToEmail(cleaned);
}

const authBtn = $('authBtn');
if (authBtn) {
  authBtn.onclick = async () => {
    const u = $('aUsername')?.value?.trim() || '';
    const p = $('aPassword')?.value || '';
    const e = $('authErr');

    /* ── Xato ko'rsatish: matn + shake + qizil border ── */
    const showErr = (msg, fields = []) => {
      e.textContent = msg;
      if ('vibrate' in navigator) navigator.vibrate([14, 6, 14, 6, 14]);

      ['aUsername','aPassword','aConfirm','aFullname'].forEach(id => {
        const el = $(id);
        if (el) el.classList.remove('input-error');
      });
      fields.forEach(id => {
        const el = $(id);
        if (el) el.classList.add('input-error');
      });

      const card = document.querySelector('.auth-card');
      if (card) {
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
      }
    };

    /* Inputga yozganda qizil border ketadi */
    ['aUsername','aPassword','aConfirm','aFullname'].forEach(id => {
      const el = $(id);
      if (el && !el._errListenerAdded) {
        el._errListenerAdded = true;
        el.addEventListener('input', () => el.classList.remove('input-error'));
      }
    });

    /* ── Validatsiya ── */
    const cleaned = _cleanUsername(u);
    if (!cleaned) {
      showErr(`Foydalanuvchi nomi bo'sh bo'lishi mumkin emas`, ['aUsername']);
      return;
    }
    if (cleaned.length < 2) {
      showErr(`Foydalanuvchi nomi kamida 2 ta belgi (a-z, 0-9, _)`, ['aUsername']);
      return;
    }
    if (cleaned.length > 20) {
      showErr(`Foydalanuvchi nomi 20 ta belgidan oshmasligi kerak`, ['aUsername']);
      return;
    }
    if (!p || p.length < 6) {
      showErr(`Parol kamida 6 ta belgi bo'lishi kerak`, ['aPassword']);
      return;
    }
    e.textContent = '';
    authBtn.disabled = true;
    authBtn.textContent = isLogin ? 'Kirilmoqda...' : 'Hisob yaratilmoqda...';

    try {
      if (isLogin) {
        const email = await _emailForLogin(cleaned);
        const { data, error } = await sb.auth.signInWithPassword({ email, password: p });
        if (error) throw error;
        try {
          await sb.from('profiles').update({
            last_login: new Date().toISOString(),
            last_user_agent: navigator.userAgent || null,
            last_platform: navigator.platform || null,
          }).eq('id', data.user.id);
          await _logLoginHistory(data.user.id, 'login');
        } catch (_) { /* profil yo'q bo'lsa ham loginni to'xtatmaymiz */ }
        // onAuthStateChange o'zi ilovani yoki pending ekranni ko'rsatadi
        return;
      }

      const fn = $('aFullname').value.trim();
      const c  = $('aConfirm').value;
      if (!fn) {
        authBtn.disabled = false;
        authBtn.textContent = "Ro'yxatdan o'tish";
        showErr('Ismingizni kiriting', ['aFullname']);
        return;
      }
      if (p !== c) {
        authBtn.disabled = false;
        authBtn.textContent = "Ro'yxatdan o'tish";
        showErr('Parollar mos emas', ['aPassword','aConfirm']);
        return;
      }

      const { data: free, error: freeErr } = await sb.rpc('username_available', { p_username: cleaned });
      if (freeErr) throw freeErr;
      if (!free) {
        authBtn.disabled = false;
        authBtn.textContent = "Ro'yxatdan o'tish";
        showErr(sbErrUz({ code: 'user_already_exists' }), ['aUsername']);
        return;
      }

      // Onboarding flagi signUp'dan OLDIN — onAuthStateChange tezroq ishlab ketishi mumkin
      sessionStorage.setItem('mrspace_new_signup', '1');
      const { data, error } = await sb.auth.signUp({
        email: uToEmail(cleaned),
        password: p,
        // Profilni DB trigger (handle_new_user) yaratadi; approval doim 'pending'
        options: { data: { username: cleaned, full_name: fn, avatar: defAvi(fn) } },
      });
      if (error) throw error;
      if (!data.session) {
        // "Confirm email" yoqilgan — soxta email'ga xat hech qachon yetmaydi
        throw new Error('Supabase: Authentication → Email → "Confirm email" ni o\'chiring');
      }
      // Keyingi qadamni onAuthStateChange bajaradi (pending ekran)
    } catch (err) {
      console.error('❌ Auth error:', err?.code || '', err?.message);
      if (!isLogin) sessionStorage.removeItem('mrspace_new_signup');
      authBtn.disabled = false;
      authBtn.textContent = isLogin ? 'Kirish' : "Ro'yxatdan o'tish";
      const known = sbErrUz(err);
      if (known === 'Foydalanuvchi nomi yoki parol xato') {
        showErr(known, ['aUsername','aPassword']);
      } else if (known === 'Bu login allaqachon band') {
        showErr(known, ['aUsername']);
      } else if (known === `Parol kamida 6 ta belgi bo'lishi kerak`) {
        showErr(known, ['aPassword']);
      } else if (/Confirm email/.test(err?.message || '')) {
        showErr(err.message);
      } else {
        showErr(known);
      }
    }
  };
}

/* ── Parol warning modal (signup only) ────────────────────────────── */
let _pwdWarnShown = false;

function showPwdWarn() {
  if (_pwdWarnShown || isLogin) return;
  _pwdWarnShown = true;
  const overlay = $('pwdWarnOverlay');
  if (overlay) overlay.classList.add('show');
}

function hidePwdWarn() {
  const overlay = $('pwdWarnOverlay');
  if (overlay) overlay.classList.remove('show');
}

const aPassword = $('aPassword');
if (aPassword) {
  aPassword.addEventListener('focus', () => { if (!isLogin) showPwdWarn(); });
}

const pwdWarnOk = $('pwdWarnOk');
if (pwdWarnOk) {
  pwdWarnOk.addEventListener('click', hidePwdWarn);
}

const pwdWarnOverlay = $('pwdWarnOverlay');
if (pwdWarnOverlay) {
  pwdWarnOverlay.addEventListener('click', e => {
    if (e.target === pwdWarnOverlay) hidePwdWarn();
  });
}

/* Reset shown flag when switching back to login */
if (authSwitchBtn) {
  authSwitchBtn.addEventListener('click', () => {
    setTimeout(() => {
      if (isLogin) { _pwdWarnShown = false; hidePwdWarn(); }
    }, 0);
  });
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
    const now = serverNow();
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


function showPendingScreen(reason = 'pending', blockedUntilMs = null) {
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
      if (blockedUntilMs && blockedUntilMs > serverNow()) {
        p.innerHTML = `Siz admin tomonidan vaqtinchalik <strong style="color:var(--red,#ef4444)">bloklangansiz.</strong><br>Muddat tugagach avtomatik ochilasiz.`;
        _startBlockedCountdown(blockedUntilMs, async () => {
          // Vaqt tugadi — pending ekranni yashirib app ga kiritamiz
          // banJustExpired=true: snapshot da blocked:true kelsa ignore qilsinlar
          hidePendingScreen();
          if (state.me) {
            await _enterApp(state.me);
            _startRealtimeUserWatch(state.me);
          }
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

function hidePendingScreen() {
  const screen = $('pendingApprovalScreen');
  if (screen) { screen.style.display = 'none'; }
  _stopPendingNoticeWatcher();
  _stopBlockedCountdown();
}

// "Chiqish" tugmasi — pending ekrandagi
const pendingSignOutBtn = $('pendingSignOutBtn');
if (pendingSignOutBtn) {
  pendingSignOutBtn.addEventListener('click', async () => {
    if (_approvalListener) { _approvalListener(); _approvalListener = null; }
    if (_activeUserUnsub) { _activeUserUnsub(); _activeUserUnsub = null; }
    hidePendingScreen();
    try { await sb.auth.signOut(); } catch (_) {}
    location.replace('/');
  });
}

/* ── Profil holati kuzatuvi (blok / ruxsat / o'chirilish) ──────────────
 * Kirgan har bir user uchun: realtime (profiles qatori) + 60s zaxira
 * so'rov (realtime uzilib qolsa ham blok/ruxsat kechikmasin).
 * ─────────────────────────────────────────────────────────────────────── */
let _activeUserUnsub = null;
let _currentUid = null;   // hozir ishlanayotgan sessiya (takroriy SIGNED_IN'dan himoya)
let _entering = false;    // _enterApp ikki marta parallel ishlamasin
let _shownKey = null;     // bir xil pending/blocked ekran qayta-qayta chizilmasin
const PROFILE_POLL_MS = 60 * 1000;

function _buildMe(user, p) {
  return {
    uid: user.id,
    email: user.email || p?.email || null,
    displayName: p?.fullName || '',
    photoURL: p?.avatar || null,
    username: p?.username || '',
    isAdmin: !!p?.isAdmin,
  };
}

function _blockedUntilMs(p) {
  return p?.blockedUntil?.toMillis ? p.blockedUntil.toMillis() : null;
}

/** blocked=true, lekin muddati o'tgan bo'lsa — bloklanmagan hisoblanadi
 *  (DB'dagi is_approved() ham shunday qaraydi). */
function _isBlockedNow(p) {
  if (!p?.blocked) return false;
  const until = _blockedUntilMs(p);
  return !until || until > serverNow();
}

async function _fetchProfile(uid) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return mapProfile(data); // qator yo'q bo'lsa null
}

function _showOnce(reason, until = null) {
  try { window.__mrspaceHideSplash?.('gate'); } catch (_) {}

  const key = reason + ':' + (until || '');
  if (_shownKey === key) return;
  _shownKey = key;
  showPendingScreen(reason, until);
}

function _stopUserWatch() {
  if (_activeUserUnsub) { _activeUserUnsub(); _activeUserUnsub = null; }
  if (_approvalListener) { _approvalListener(); _approvalListener = null; }
}

async function _forceSignOut() {
  _stopUserWatch();
  try { await sb.auth.signOut(); } catch (_) {}
  location.replace('/');
}

/** Profilning eng so'nggi holatiga qarab ekranni to'g'irlaydi (idempotent). */
async function _onLiveProfile(p, me) {
  if (!p) return;
  _saveVerifiedState(me.uid, p);
  Object.assign(me, _buildMe({ id: me.uid, email: me.email }, p));

  const appEl = $('app');
  const isInApp = !!(appEl && appEl.classList.contains('show'));

  // Bloklangan (muddati o'tmagan)
  if (_isBlockedNow(p)) {
    if (isInApp) {
      stopChatsWatcher();
      stopCallWatcher();
      stopPresenceHeartbeat();
      appEl.classList.remove('show');
    }
    _showOnce('blocked', _blockedUntilMs(p));
    return;
  }

  // Ruxsat berilgan
  if (p.approved === true) {
    if (!isInApp && !_entering) {
      hidePendingScreen();
      _shownKey = null;
      await _enterApp(me);
    }
    return;
  }

  // Pending yoki rejected
  if (isInApp) { await _forceSignOut(); return; }
  _showOnce(p.approved === 'rejected' ? 'rejected' : 'pending');
}

function _startRealtimeUserWatch(me) {
  _stopUserWatch();
  const uid = me.uid;
  const ch = sb.channel('profile-' + uid)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
        async payload => {
          if (payload.eventType === 'DELETE') { await _forceSignOut(); return; }
          await _onLiveProfile(mapProfile(payload.new), me);
        })
    .subscribe();
  const poll = setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      const p = await _fetchProfile(uid);
      if (!p) await _forceSignOut();
      else await _onLiveProfile(p, me);
    } catch (_) { /* keyingi tikda qayta urinadi */ }
  }, PROFILE_POLL_MS);
  _activeUserUnsub = () => { clearInterval(poll); sb.removeChannel(ch); };
}

/* ── Sessiya boshqaruvi ──────────────────────────────────────────────── */
async function _handleSession(session) {
  const user = session?.user || null;

  if (!user) {
    _currentUid = null;
    _shownKey = null;
    state.me = null;
    _stopUserWatch();
    if (_postsUnsub) { _postsUnsub(); _postsUnsub = null; }
    hidePendingScreen();
    stopChatsWatcher();
    stopCallWatcher();
    stopPresenceHeartbeat();
    const app = $('app');
    const authWrap = $('authWrap');
    if (app) app.classList.remove('show');
    if (authWrap) authWrap.classList.add('show');
    try { window.__mrspaceHideSplash?.('no-session'); } catch (_) {}
    return;
  }

  // Token yangilanishi / takroriy SIGNED_IN — qayta ishlamaymiz
  if (_currentUid === user.id) return;
  _currentUid = user.id;

  if (!_serverTimeSynced) await _syncServerTime();

  let p = null, fetchErr = null;
  try { p = await _fetchProfile(user.id); } catch (err) { fetchErr = err; }

  const me = _buildMe(user, p);
  state.me = me;

  // Profil xato bilan olinmadi yoki offline
  if (fetchErr || (!p && !navigator.onLine)) {
    console.warn('[Auth] Profil olinmadi:', fetchErr?.message);
    if (!navigator.onLine) {
      const decision = _offlineAccessDecision(user.id);
      if (!decision.allow) {
        if (decision.blocked) _showOnce('blocked', decision.blockedUntil);
        else _showOnce('offline-verify');
        return;
      }
      _enterApp(me);
      _startRealtimeUserWatch(me);
      return;
    }
    // Onlayn, lekin server xato berdi — ruxsatsiz kiritmaymiz
    _showOnce('pending');
    _startRealtimeUserWatch(me);
    return;
  }

  // Profil qatori yo'q (o'chirilgan) — hisobdan chiqaramiz
  if (!p) { await _forceSignOut(); return; }

  try {
    const { applyAdminNav } = await import('./router.js');
    applyAdminNav();
  } catch (_) {}

  // Faqat serverdan haqiqatan olingan holat — tasdiqlangan holat sifatida saqlanadi
  await _onLiveProfile(p, me);
  _startRealtimeUserWatch(me);
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
  // Callback ichida supabase chaqiruvlarini kutmaymiz (deadlock xavfi)
  setTimeout(() => { _handleSession(session); }, 0);
});
// INITIAL_SESSION hodisasi versiyaga bog'liq — kafolat uchun bir marta o'zimiz ham so'raymiz
sb.auth.getSession().then(({ data }) => { _handleSession(data?.session || null); });

/* ── User cache invalidation helper ────────────────────────────────── */
export function invalidateUserCache(uid) {
  if (state._userCache && uid) {
    delete state._userCache[uid];
  }
}

async function _enterApp(user) {
  if (_entering) return;
  _entering = true;
  try {
    const authWrap = $('authWrap');
    const app = $('app');
    if (authWrap) authWrap.classList.remove('show');
    if (app) app.classList.add('show');
    _shownKey = null;

    /* Faqat yangi ro'yxatdan o'tgan foydalanuvchilarga onboarding */
    if (sessionStorage.getItem('mrspace_new_signup')) {
      sessionStorage.removeItem('mrspace_new_signup');
      setTimeout(() => {
        if (typeof window._startOnboarding === 'function') window._startOnboarding(true);
      }, 1100);
    }

    listenPosts();
    if (!notificationsUserDisabled()) initPush();
    startChatsWatcher(); // ichida startGroupsWatcher ham
    startCallWatcher();

    // "Oxirgi faollik" — admin panelida ko'rsatish uchun
    try {
      await sb.from('profiles').update({
        last_seen: new Date().toISOString(),
        last_user_agent: navigator.userAgent || null,
        last_platform: navigator.platform || null,
      }).eq('id', user.uid);
      await _logLoginHistory(user.uid, 'session');
    } catch (_) { /* jim o'tkazib yuboramiz */ }

    startPresenceHeartbeat();

    // Splash davomida ko'proq ma'lumot yuklash
    try {
      await _preloadForSplash(user.uid);
    } catch (e) {
      console.warn('[Auth] preload:', e?.message || e);
    }
    try { window.__mrspaceHideSplash?.('app-ready'); } catch (_) {}

    // Stories bar birinchi yuklanishda ham chiqsin (router auth dan oldin ishlagan bo'lishi mumkin)
    try {
      const { initStories } = await import('./stories.js');
      initStories();
    } catch (e) { console.warn('[Auth] stories', e?.message || e); }
  } finally {
    _entering = false;
  }
}

/** Splash yopilishidan oldin parallel yuklash */
async function _preloadForSplash(uid) {
  const tasks = [];

  // 1) Postlar (listenPosts load() async — qayta so'rov, tezkor kesh + network)
  tasks.push((async () => {
    try {
      const { data } = await sb.from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80);
      if (data?.length) {
        const posts = data.map(r => {
          try { return mapPost(r); } catch { return null; }
        }).filter(Boolean);
        if (posts.length) {
          state.allPosts = posts;
          try { cachePosts(uid, posts); } catch (_) {}
          if (state.view === 'home') _cb.renderFeed?.();
        }
      }
    } catch (e) { console.warn('[preload] posts', e?.message); }
  })());

  // 2) Onlayn profillar (right-rail)
  tasks.push((async () => {
    try {
      const { data } = await sb.from('profiles')
        .select('id, username, full_name, avatar, last_seen, approval, blocked')
        .eq('approval', 'approved')
        .eq('blocked', false)
        .order('last_seen', { ascending: false })
        .limit(40);
      for (const row of data || []) {
        const d = mapProfile(row);
        if (!d?.uid) continue;
        state._userCache[d.uid] = {
          uid: d.uid, fullName: d.fullName, avatar: d.avatar,
          username: d.username, blocked: d.blocked, approved: d.approved,
          lastSeenAt: d.lastSeenAt,
        };
      }
      // right-rail yangilansin
      document.dispatchEvent(new CustomEvent('profilesPreloaded'));
    } catch (e) { console.warn('[preload] profiles', e?.message); }
  })());

  // 3) Guruhlar ro'yxati allaqachon startGroupsWatcher da — biroz kutamiz
  tasks.push(new Promise(r => setTimeout(r, 400)));

  // 4) Post mualliflari
  tasks.push((async () => {
    try {
      const uids = [...new Set((state.allPosts || []).map(p => p.userId).filter(Boolean))]
        .filter(id => !state._userCache[id])
        .slice(0, 30);
      if (!uids.length) return;
      const { data } = await sb.from('profiles')
        .select('id,full_name,avatar,username,blocked,approval')
        .in('id', uids);
      for (const row of data || []) {
        const d = mapProfile(row);
        state._userCache[d.uid] = {
          uid: d.uid, fullName: d.fullName, avatar: d.avatar,
          username: d.username, blocked: d.blocked, approved: d.approved,
        };
      }
    } catch (_) {}
  })());

  await Promise.allSettled(tasks);
  // right-rail qayta chizsin
  try {
    const rr = await import('./right-rail.js');
    rr.startRightRail?.();
  } catch (_) {}
  document.dispatchEvent(new CustomEvent('groupsUpdated'));
}

/* ── Onlayn holat (presence) heartbeat ─────────────────────────────────
 * profiles.last_seen har ~25s yangilanadi; boshqalar isOnline(lastSeenAt)
 * (utils.js) bilan "onlayn/oxirgi faollik"ni hisoblaydi.
 * Sahifa fonda bo'lsa to'xtaydi (batareya va yozuvlarni tejash).
 ─────────────────────────────────────────────────────────────────────── */
const HEARTBEAT_MS = 25 * 1000;
let _heartbeatTimer = null;

async function _pingPresence() {
  const uid = state.me?.uid;
  if (!uid || document.visibilityState !== 'visible') return;
  try {
    await sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid);
  } catch (_) { /* tarmoq yo'q — keyingi tikda qayta urinadi */ }
}

function startPresenceHeartbeat() {
  if (_heartbeatTimer) return;
  _pingPresence(); // darhol bitta marta
  _heartbeatTimer = setInterval(_pingPresence, HEARTBEAT_MS);
  document.addEventListener('visibilitychange', _onVisibilityChangeForPresence);
}

function stopPresenceHeartbeat() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  document.removeEventListener('visibilitychange', _onVisibilityChangeForPresence);
}

function _onVisibilityChangeForPresence() {
  if (document.visibilityState === 'visible') _pingPresence();
}

/* ── Live posts listener ─────────────────────────────────────────────────
   RLS o'zi filtrlaydi: oddiy user public + o'z postlarini, admin hammasini
   oladi. Boshida bitta so'rov, keyin realtime (posts jadvali) orqali
   INSERT/UPDATE/DELETE. Like/izoh/ko'rish sonlarini DB triggerlari
   yangilaydi — UPDATE hodisasi patchCounts()ga olib boradi. ─────────── */
let _postsUnsub = null;
export function listenPosts() {
  if (_postsUnsub) return; // Allaqachon tinglayapti
  if (!state.me?.uid) return;
  let _lastPostIds = '';

  const myUid = state.me.uid;
  const byId = new Map();

  // Bir necha hodisa ketma-ket kelsa — bitta render'ga birlashtiramiz
  let _renderDebounceTimer = null;
  function _scheduleRender() {
    clearTimeout(_renderDebounceTimer);
    _renderDebounceTimer = setTimeout(() => { render(); }, 120);
  }

  // ── KESH-BIRINCHI: oldingi safar saqlangan postlarni darhol ko'rsatamiz ──
  const _cachedPosts = getCachedPosts(myUid);
  if (_cachedPosts && _cachedPosts.length) {
    state.allPosts = _cachedPosts;
    _lastPostIds = _cachedPosts.map(p => p.id).join(',');
    if (state.view === 'home')    _cb.renderFeed?.();
    if (state.view === 'reels')   _cb.renderReels?.();
    if (state.view === 'profile') _cb.renderProfile?.();
  }

  const render = async () => {
    const newPosts = [...byId.values()].sort((a, b) => {
      const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bt - at;
    });

    // Muallif ma'lumotlarini keshlash (bitta so'rov bilan)
    const uidsToFetch = [...new Set(newPosts.map(p => p.userId).filter(Boolean))]
      .filter(uid => !state._userCache[uid]);
    if (uidsToFetch.length) {
      try {
        const { data } = await sb.from('profiles')
          .select('id,full_name,avatar,username,blocked,approval')
          .in('id', uidsToFetch);
        for (const row of data || []) {
          const d = mapProfile(row);
          state._userCache[d.uid] = {
            uid: d.uid, fullName: d.fullName, avatar: d.avatar,
            username: d.username, blocked: d.blocked, approved: d.approved,
          };
        }
      } catch (err) {
        console.warn('[Auth] Muallif profillarini olishda xato:', err?.message);
      }
    }

    // Faqat post ID'lari o'zgarganda to'liq re-render
    const currentIds = newPosts.map(p => p.id).join(',');
    const structural = _lastPostIds !== currentIds;

    const countChanged = state.allPosts && state.allPosts.some(oldP => {
      const newP = newPosts.find(p => p.id === oldP.id);
      return newP && (
        newP.likes !== oldP.likes ||
        newP.views !== oldP.views ||
        newP.commentCount !== oldP.commentCount
      );
    });

    state.allPosts = newPosts;
    _lastPostIds = currentIds;

    if (structural) cachePosts(myUid, newPosts);

    if (structural) {
      if (state.view === 'home')      _cb.renderFeed?.();
      if (state.view === 'reels')     _cb.renderReels?.();
      if (state.view === 'profile')   _cb.renderProfile?.();
      if (state.currentViewingUserId) {
        const modal = document.getElementById('userProfileModal');
        if (modal?.classList.contains('show')) _cb.renderUserProfileModal?.(state.currentViewingUserId);
      }
    } else if (countChanged) {
      _cb.patchCounts?.(newPosts);
    }
  };

  const POST_LIMIT = 1000; // scroll orqali 10 tadan ko'rsatiladi

  const load = async () => {
    const { data, error } = await sb.from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(POST_LIMIT);
    if (error) { console.warn('[Auth] Posts yuklashda xato:', error.message); return; }
    byId.clear();
    for (const r of data || []) byId.set(r.id, mapPost(r));
    _scheduleRender();
  };

  load();

  let _subscribedOnce = false;
  const ch = sb.channel('posts-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, payload => {
      if (payload.eventType === 'DELETE') byId.delete(payload.old?.id);
      else if (payload.new?.id) byId.set(payload.new.id, mapPost(payload.new));
      _scheduleRender();
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        // Uzilib qayta ulanganda o'tkazib yuborilgan o'zgarishlarni to'ldiramiz
        if (_subscribedOnce) load();
        _subscribedOnce = true;
      }
    });

  _postsUnsub = () => { clearTimeout(_renderDebounceTimer); sb.removeChannel(ch); };
}

/* ── Profil edit / logout — to'liq implementatsiya ─────────────────── */

let _peAviPending = null;
let _peCoverPending = null;
let _peOriginalUsername = '';

const editProfileBtn = $('editProfileBtn');
if (editProfileBtn) {
  editProfileBtn.onclick = async () => {
    if (!state.me) return;
    const { data: _row } = await sb.from('profiles').select('*').eq('id', state.me.uid).maybeSingle();
    const d = mapProfile(_row) || {};
    _peOriginalUsername = d.username || '';

    const editName = $('editName');
    const editBioInput = $('editBioInput');
    const editUsername = $('editUsername');
    const editWebsite = $('editWebsite');
    const editLocation = $('editLocation');
    if (editName) editName.value = d.fullName || '';
    if (editBioInput) editBioInput.value = d.bio || '';
    if (editUsername) editUsername.value = d.username || '';
    if (editWebsite) editWebsite.value = d.website || '';
    if (editLocation) editLocation.value = d.location || '';

    _peAviPending = null;
    const peAviImg = $('peAviImg');
    if (peAviImg) {
      const av = d.avatar || defAvi(d.fullName || 'U');
      peAviImg.innerHTML = `<img src="${av}" onerror="this.style.display='none'">`;
    }

    _peCoverPending = null;
    const peCoverImg = $('peCoverImg');
    if (peCoverImg) {
      if (d.coverUrl) {
        peCoverImg.style.backgroundImage = `url(${d.coverUrl})`;
        peCoverImg.style.backgroundSize = 'cover';
        peCoverImg.style.backgroundPosition = 'center';
      } else {
        peCoverImg.style.backgroundImage = '';
        peCoverImg.style.background = 'var(--glass-mid)';
      }
    }

    const peAviInput = $('peAviInput');
    const peAviEditBadge = $('peAviEditBadge');
    if (peAviEditBadge && peAviInput) {
      peAviEditBadge.onclick = () => peAviInput.click();
      peAviInput.onchange = async ev => {
        const f = ev.target.files[0];
        if (!f || !f.type.startsWith('image/')) return;
        if (f.size > 5*1024*1024) { toast("Avatar 5 MB dan kam bo'lishi kerak", 'error'); return; }
        toast('Yuklanmoqda...', 'info');
        try {
          const result = await uploadViaController(f, 'avatars');
          _peAviPending = result.url;
          if (peAviImg) peAviImg.innerHTML = `<img src="${result.url}">`;
          toast('Avatar tanlandi', 'success');
        } catch(e) { toast('Xato: ' + e.message, 'error'); }
      };
    }

    const peCoverInput = $('peCoverInput');
    const peCoverWrap = $('peCoverWrap');
    if (peCoverWrap && peCoverInput) {
      peCoverWrap.onclick = (e) => { if (e.target !== peCoverInput) peCoverInput.click(); };
      peCoverInput.onchange = async ev => {
        const f = ev.target.files[0];
        if (!f || !f.type.startsWith('image/')) return;
        if (f.size > 20*1024*1024) { toast("Rasm 20 MB dan kichik bo'lishi kerak", 'error'); return; }
        try {
          const { openCropModal } = await import('./cover-crop.js');
          const blob = await openCropModal(f);
          const croppedFile = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
          toast('Cover yuklanmoqda...', 'info');
          const result = await uploadViaController(croppedFile, 'covers');
          _peCoverPending = result.url;
          if (peCoverImg) {
            peCoverImg.style.backgroundImage = `url(${result.url})`;
            peCoverImg.style.backgroundSize = 'cover';
            peCoverImg.style.backgroundPosition = 'center';
          }
          toast('Cover tanlandi ✓', 'success');
        } catch(e) {
          if (e.message !== 'cancelled') toast('Xato: ' + e.message, 'error');
        }
        peCoverInput.value = '';
      };
    }

    const profileEditOverlay = $('profileEditOverlay');
    if (profileEditOverlay) { profileEditOverlay.classList.add('show'); lockScroll(); }
  };
}

const saveProfileBtn = $('saveProfileBtn');
if (saveProfileBtn) {
  saveProfileBtn.onclick = async () => {
    if (!state.me) return;
    const fn = $('editName')?.value?.trim();
    if (!fn) { toast('Ismingizni kiriting', 'error'); return; }

    const updates = {
      full_name: fn,
      bio:       $('editBioInput')?.value?.trim() || '',
      website:   $('editWebsite')?.value?.trim() || '',
      location:  $('editLocation')?.value?.trim() || '',
    };

    const rawUser = $('editUsername')?.value?.trim() || '';
    if (rawUser) {
      const cleaned = rawUser.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleaned.length < 2) { toast("Username kamida 2 ta belgi bo'lishi kerak (a-z, 0-9, _)", 'error'); return; }
      if (cleaned.length > 20) { toast("Username 20 ta belgidan oshmasligi kerak", 'error'); return; }
      updates.username = cleaned;
    }

    if (_peAviPending)   updates.avatar    = _peAviPending;
    if (_peCoverPending) updates.cover_url = _peCoverPending;

    try {
      const { error } = await sb.from('profiles').update(updates).eq('id', state.me.uid);
      if (error) {
        if (error.code === '23505') { toast('Bu username band', 'error'); return; }
        throw error;
      }
      // Login username'dan email'ni DB'dan topadi (email_for_username) —
      // username o'zgarsa ham login yangi nom bilan ishlayveradi.
      state.me.displayName = fn;
      if (updates.username) state.me.username = updates.username;
      if (updates.avatar)   state.me.photoURL = updates.avatar;
      invalidateUserCache(state.me.uid);

      const profileEditOverlay = $('profileEditOverlay');
      if (profileEditOverlay) { profileEditOverlay.classList.remove('show'); unlockScroll(); }
      toast('Profil yangilandi', 'success');
      _cb.renderProfile?.();
    } catch(e) { toast('Xato: ' + e.message, 'error'); }
  };
}

const cancelEditBtn = $('cancelEditBtn');
if (cancelEditBtn) {
  cancelEditBtn.onclick = () => {
    const profileEditOverlay = $('profileEditOverlay');
    if (profileEditOverlay) { profileEditOverlay.classList.remove('show'); unlockScroll(); }
  };
}

const logoutBtn = $('logoutBtn');
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    await removePushToken();
    clearAllCache();
    try { await sb.auth.signOut(); } catch (_) {}
    location.replace('/');
  };
}

/* ── Sozlamalar (Settings) sheet — bildirishnoma + hisobni o'chirish ── */

function _applyNotifToggleUI() {
  const toggle = $('notifToggle');
  const hint   = $('notifHint');
  if (!toggle) return;
  const denied = ('Notification' in window) && Notification.permission === 'denied';
  const on     = areNotificationsEnabled();
  toggle.classList.toggle('on', on);
  toggle.classList.toggle('disabled', denied);
  toggle.setAttribute('aria-checked', String(on));
  if (hint) {
    hint.textContent = denied
      ? "Brauzer bildirishnomalarni bloklagan — brauzer sozlamalaridan yoqing"
      : "Yangi xabar, izoh va qo'ng'iroqlar haqida xabar bering";
  }
}

/** Sozlamalar sahifasi tepasidagi profil kartasini to'ldiradi
 *  (avatar, ism, username) — keshdan darhol, tarmoqni kutmasdan. */
function _paintSettingsProfileCard() {
  if (!state.me) return;
  const cached = getCachedProfile(state.me.uid) || {};
  const fn = cached.fullName || state.me.displayName || 'Foydalanuvchi';
  const av = cached.avatar || defAvi(fn);

  const aviEl = $('settingsAvi');
  if (aviEl) aviEl.innerHTML = `<img src="${av}" onerror="this.style.display='none'">`;

  const nameEl = $('settingsName');
  if (nameEl) nameEl.textContent = fn;

  const userEl = $('settingsUsername');
  if (userEl) userEl.textContent = cached.username ? '@' + cached.username : "Foydalanuvchi nomi yo'q";
}

const settingsBtn = $('settingsBtn');
if (settingsBtn) {
  settingsBtn.onclick = () => {
    _paintSettingsProfileCard();
    _applyNotifToggleUI();
    $('settingsMoreMenu')?.classList.remove('show');
    const settingsOverlay = $('settingsOverlay');
    if (settingsOverlay) { settingsOverlay.classList.add('show'); lockScroll(); }
  };
}

const closeSettingsBtn = $('closeSettingsBtn');
if (closeSettingsBtn) {
  closeSettingsBtn.onclick = () => {
    $('settingsMoreMenu')?.classList.remove('show');
    const settingsOverlay = $('settingsOverlay');
    if (settingsOverlay) { settingsOverlay.classList.remove('show'); unlockScroll(); }
  };
}

const settingsOverlay = $('settingsOverlay');
if (settingsOverlay) {
  settingsOverlay.onclick = e => {
    if (e.target === settingsOverlay) {
      $('settingsMoreMenu')?.classList.remove('show');
      settingsOverlay.classList.remove('show');
      unlockScroll();
    }
  };
}

const notifToggle = $('notifToggle');
if (notifToggle) {
  notifToggle.onclick = async () => {
    if (notifToggle.classList.contains('disabled')) {
      toast('Bildirishnomalar brauzer sozlamalaridan bloklangan', 'error');
      return;
    }
    const turningOn = !notifToggle.classList.contains('on');
    notifToggle.classList.add('disabled'); // ishlov tugaguncha qayta bosilmasin
    try {
      const finalState = await setNotificationsEnabled(turningOn);
      _applyNotifToggleUI();
      if (turningOn && !finalState) {
        toast('Ruxsat berilmadi — brauzer bildirishnomalarni bloklagan bo\'lishi mumkin', 'error');
      } else {
        toast(finalState ? 'Bildirishnomalar yoqildi' : "Bildirishnomalar o'chirildi", 'success');
      }
    } catch (e) {
      toast('Xato: ' + e.message, 'error');
      _applyNotifToggleUI();
    }
  };
}

const clearCacheBtn = $('clearCacheBtn');
if (clearCacheBtn) {
  clearCacheBtn.onclick = async () => {
    clearCacheBtn.disabled = true;
    try {
      clearAllCache();
      await clearRuntimeCache();
      toast('Kesh tozalandi', 'success');
    } catch (e) {
      toast('Xato: ' + e.message, 'error');
    } finally {
      clearCacheBtn.disabled = false;
    }
  };
}

/* "..." menyusi — nozik/ko'rinmasroq joyda, tasodifan bosilib ketmasligi
 * uchun hisobni o'chirish shu menyu ichida yashiringan. */
const settingsMoreBtn  = $('settingsMoreBtn');
const settingsMoreMenu = $('settingsMoreMenu');
if (settingsMoreBtn && settingsMoreMenu) {
  settingsMoreBtn.onclick = (e) => {
    e.stopPropagation();
    settingsMoreMenu.classList.toggle('show');
  };
  document.addEventListener('click', (e) => {
    if (!settingsMoreMenu.classList.contains('show')) return;
    if (e.target === settingsMoreBtn || settingsMoreMenu.contains(e.target)) return;
    settingsMoreMenu.classList.remove('show');
  });
}

const _purgeMyMedia = () => purgeUserMedia(state.me?.uid);

const deleteAccountBtn = $('deleteAccountBtn');
if (deleteAccountBtn) {
  deleteAccountBtn.onclick = () => {
    if (!state.me) return;
    settingsMoreMenu?.classList.remove('show');
    showConfirm(
      "Hisobingiz, barcha postlaringiz, xabarlaringiz va izohlaringiz BUTUNLAY o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi. Davom etasizmi?",
      async () => {
        deleteAccountBtn.disabled = true;
        toast("Hisob o'chirilmoqda...", 'info');
        try {
          await _purgeMyMedia();
          const { error: delErr } = await sb.rpc('delete_my_account');
          if (delErr) throw delErr;
          await removePushToken().catch(() => {});
          clearAllCache();
          try { await sb.auth.signOut(); } catch (_) {}
          try { localStorage.removeItem('mrspace-auth'); } catch (_) {}
          location.replace('/');
        } catch (e) {
          deleteAccountBtn.disabled = false;
          toast('Xato: ' + e.message, 'error');
        }
      },
      "Hisobni o'chirish"
    );
  };
}

const profileEditOverlay = $('profileEditOverlay');
if (profileEditOverlay) {
  profileEditOverlay.onclick = e => {
    if (e.target === profileEditOverlay) { profileEditOverlay.classList.remove('show'); unlockScroll(); }
  };
}

// Initialize call handlers (buttons for accept/reject/end)
