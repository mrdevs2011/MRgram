import { sb, state, uploadViaController, mapProfile, mapPost, purgeUserMedia, verifyPassword } from './config.js';
import { $, esc, defAvi, uToEmail, lockScroll, unlockScroll, showConfirm } from './utils.js';
import { toast }                       from './toast.js';
import { initPush, removePushToken, areNotificationsEnabled, setNotificationsEnabled, notificationsUserDisabled } from './push.js';
import { startChatsWatcher, stopChatsWatcher, repaintNoticeBanner } from './chat.js';
import { startBus, stopBus, busOn } from './rt-bus.js';
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
const OFFLINE_TRUST_MS = 24 * 60 * 60 * 1000; // 24 soat (avval 15 daqiqa edi)

function _verifiedKey(uid) { return `mrg_verified_${uid}`; }

function _saveVerifiedState(uid, data) {
  try {
    const blockedUntilMs = data.blockedUntil || null;
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
    authSwitchBtn.textContent       = isLogin ? 'Ro\'yxatdan o\'tish' : 'Kirish';
    $('nameRow').style.display      = isLogin ? 'none' : 'block';
    $('confirmRow').style.display   = isLogin ? 'none' : 'block';
    _hideForgotPasswordBtn();
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
        el.addEventListener('input', () => {
          el.classList.remove('input-error');
          if (id === 'aUsername') _hideForgotPasswordBtn();
        });
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
        _hideForgotPasswordBtn();
        if (data?.user?.id) {
          _setLocalPwdTs(data.user.id, Date.now());
        }
        try {
          await sb.from('profiles').update({
            last_login: new Date().toISOString(),
            last_user_agent: navigator.userAgent || null,
            last_platform: navigator.platform || null,
          }).eq('id', data.user.id);
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
      let isFree = free;
      if (isFree) {
        try {
          const { data: grpRows } = await sb.from('groups').select('id').ilike('username', cleaned).limit(1);
          if (grpRows && grpRows.length) isFree = false;
        } catch (_) {}
      }
      if (!isFree) {
        authBtn.disabled = false;
        authBtn.textContent = "Ro'yxatdan o'tish";
        showErr('Bu nom allaqachon band', ['aUsername']);
        return;
      }

      // Hamma tekshiruvlar to'liq o'tdi — zaxira email maslahat popupini ochamiz
      authBtn.disabled = false;
      authBtn.textContent = "Ro'yxatdan o'tish";

      _openRegRecoveryModal({
        cleaned,
        fn,
        p,
      });
      return;
    } catch (err) {
      console.error('Auth error:', err?.code || '', err?.message);
      if (!isLogin) {
        sessionStorage.removeItem('spacemr_new_signup');
        sessionStorage.removeItem('mrspace_new_signup');
      }
      authBtn.disabled = false;
      authBtn.textContent = isLogin ? 'Kirish' : "Ro'yxatdan o'tish";
      const known = sbErrUz(err);
      if (known === 'Foydalanuvchi nomi yoki parol xato') {
        showErr(known, ['aUsername','aPassword']);
        if (isLogin) {
          try {
            const { data: recInfo } = await sb.rpc('check_user_recovery', { p_username: cleaned });
            if (recInfo && recInfo.exists) {
              _showForgotPasswordBtn(cleaned, recInfo);
            } else {
              _hideForgotPasswordBtn();
            }
          } catch (_) {
            _hideForgotPasswordBtn();
          }
        }
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

/* ── Qat'iy email validatsiyasi ────────────────────────────────────── */
function validateStrictEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  if (!s) {
    return { ok: false, error: 'Email manzili kiritilmadi' };
  }
  if (s.length > 254) {
    return { ok: false, error: 'Email juda uzun (maksimal 254 belgi)' };
  }
  if (/\s/.test(s)) {
    return { ok: false, error: 'Email manzilida bo\'sh joy bo\'lishi mumkin emas' };
  }
  const atCount = (s.match(/@/g) || []).length;
  if (atCount !== 1) {
    return { ok: false, error: 'Emailda faqat bitta @ belgisi bo\'lishi kerak' };
  }

  const [localPart, domainPart] = s.split('@');
  if (!localPart || localPart.length < 1 || localPart.length > 64) {
    return { ok: false, error: 'Email bosh qismi noto\'g\'ri' };
  }
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return { ok: false, error: 'Email manzilida nuqtalar noto\'g\'ri qo\'yilgan' };
  }
  if (!domainPart || !domainPart.includes('.')) {
    return { ok: false, error: 'Email domeni to\'liq emas (masalan: @gmail.com)' };
  }
  if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..') || domainPart.startsWith('-') || domainPart.endsWith('-')) {
    return { ok: false, error: 'Email domenida xatolik bor' };
  }

  const parts = domainPart.split('.');
  const tld = parts[parts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { ok: false, error: 'Email domen kengaytmasi (.com, .uz...) noto\'g\'ri' };
  }

  const rfcRegex = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
  if (!rfcRegex.test(s)) {
    return { ok: false, error: 'Email formati noto\'g\'ri' };
  }

  // Keng tarqalgan xato yozilgan domenlar tekshiruvi (typo check)
  const typos = [
    { bad: 'gmail.con', good: 'gmail.com' },
    { bad: 'gmai.com', good: 'gmail.com' },
    { bad: 'gamil.com', good: 'gmail.com' },
    { bad: 'gmial.com', good: 'gmail.com' },
    { bad: 'yaho.com', good: 'yahoo.com' },
    { bad: 'hotmial.com', good: 'hotmail.com' },
    { bad: 'outlok.com', good: 'outlook.com' },
  ];
  for (const t of typos) {
    if (domainPart === t.bad) {
      return { ok: false, error: `Email domenida xato: @${t.good} kiritmoqchimisiz?` };
    }
  }

  const fakeDomains = ['test.com', 'example.com', 'sample.com', 'asdf.com', 'test.uz', 'fake.com', 'aaa.com'];
  if (fakeDomains.includes(domainPart)) {
    return { ok: false, error: 'Iltimos, haqiqiy shaxsiy emailingizni kiriting' };
  }

  return { ok: true, email: s };
}

/* ── Ro'yxatdan o'tishda zaxira email maslahati va kiritish ────────── */
let _pendingRegData = null;

function _openRegRecoveryModal(regData) {
  _pendingRegData = regData;
  const tipStep = $('regRecoveryStepTip');
  const inputStep = $('regRecoveryStepInput');
  const emailInp = $('regRecoveryEmailInput');
  const errEl = $('regRecoveryEmailErr');

  if (tipStep) tipStep.style.display = 'block';
  if (inputStep) inputStep.style.display = 'none';
  if (emailInp) {
    emailInp.value = '';
    emailInp.classList.remove('input-error');
  }
  if (errEl) errEl.textContent = '';

  const modal = $('regRecoveryModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
    lockScroll();
  }
}

function _hideRegRecoveryModal() {
  const modal = $('regRecoveryModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    unlockScroll();
  }
}

async function _completeSignUp(recoveryEmail = '') {
  if (!_pendingRegData) return;
  const { cleaned, fn, p } = _pendingRegData;
  _pendingRegData = null;
  _hideRegRecoveryModal();

  const authBtn = $('authBtn');
  if (authBtn) {
    authBtn.disabled = true;
    authBtn.textContent = 'Hisob yaratilmoqda...';
  }

  try {
    sessionStorage.setItem('spacemr_new_signup', '1');
    const { data, error } = await sb.auth.signUp({
      email: uToEmail(cleaned),
      password: p,
      options: {
        data: {
          username: cleaned,
          full_name: fn,
          avatar: defAvi(fn),
          recovery_email: recoveryEmail || '',
        }
      },
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error('Supabase: Authentication → Email → "Confirm email" ni o\'chiring');
    }
  } catch (err) {
    console.error('Sign up error:', err);
    sessionStorage.removeItem('spacemr_new_signup');
    sessionStorage.removeItem('mrspace_new_signup');
    if (authBtn) {
      authBtn.disabled = false;
      authBtn.textContent = "Ro'yxatdan o'tish";
    }
    const known = sbErrUz(err);
    const errEl = $('authErr');
    if (errEl) errEl.textContent = known;
    toast(known, 'error');
  }
}

const regRecoverySkipBtn = $('regRecoverySkipBtn');
if (regRecoverySkipBtn) {
  regRecoverySkipBtn.onclick = () => {
    _completeSignUp('');
  };
}

const regRecoveryAddBtn = $('regRecoveryAddBtn');
if (regRecoveryAddBtn) {
  regRecoveryAddBtn.onclick = () => {
    const tipStep = $('regRecoveryStepTip');
    const inputStep = $('regRecoveryStepInput');
    const emailInp = $('regRecoveryEmailInput');
    if (tipStep) tipStep.style.display = 'none';
    if (inputStep) inputStep.style.display = 'block';
    if (emailInp) emailInp.focus();
  };
}

const regRecoveryBackBtn = $('regRecoveryBackBtn');
if (regRecoveryBackBtn) {
  regRecoveryBackBtn.onclick = () => {
    const tipStep = $('regRecoveryStepTip');
    const inputStep = $('regRecoveryStepInput');
    const errEl = $('regRecoveryEmailErr');
    const emailInp = $('regRecoveryEmailInput');
    if (errEl) errEl.textContent = '';
    if (emailInp) emailInp.classList.remove('input-error');
    if (inputStep) inputStep.style.display = 'none';
    if (tipStep) tipStep.style.display = 'block';
  };
}

const regRecoverySubmitBtn = $('regRecoverySubmitBtn');
if (regRecoverySubmitBtn) {
  regRecoverySubmitBtn.onclick = () => {
    const emailInp = $('regRecoveryEmailInput');
    const errEl = $('regRecoveryEmailErr');
    const val = emailInp?.value || '';

    const res = validateStrictEmail(val);
    if (!res.ok) {
      if (errEl) errEl.textContent = res.error;
      if (emailInp) {
        emailInp.classList.add('input-error');
        emailInp.focus();
      }
      if ('vibrate' in navigator) navigator.vibrate([14, 6, 14]);
      return;
    }

    if (errEl) errEl.textContent = '';
    if (emailInp) emailInp.classList.remove('input-error');
    _completeSignUp(res.email);
  };
}

const regRecoveryEmailInput = $('regRecoveryEmailInput');
if (regRecoveryEmailInput) {
  regRecoveryEmailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('regRecoverySubmitBtn')?.click();
    }
  });
  regRecoveryEmailInput.addEventListener('input', () => {
    regRecoveryEmailInput.classList.remove('input-error');
    const errEl = $('regRecoveryEmailErr');
    if (errEl) errEl.textContent = '';
  });
}

/* ── Parolni unutdingizmi? (8 xonali vaqtinchalik parol) ───────────── */
let _lastTestedUsername = '';
let _lastRecoveryInfo = null;

function _showForgotPasswordBtn(username, recInfo) {
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

function _hideForgotPasswordBtn() {
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
    const u = _lastTestedUsername || _cleanUsername($('aUsername')?.value);
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

    const tempPassword = gen8CharTempPassword();
    forgotPasswordBtn.disabled = true;
    forgotPasswordBtn.style.color = 'var(--text3, #888)';
    forgotPasswordBtn.style.cursor = 'default';
    forgotPasswordBtn.textContent = 'Yuborilmoqda...';

    const hintEl = $('forgotPasswordHint');
    if (hintEl) {
      hintEl.style.display = 'none';
      hintEl.textContent = '';
    }

    try {
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

      // Tugma kulrang (disabled) bo'lib "Yuborildi" deb qoladi
      forgotPasswordBtn.disabled = true;
      forgotPasswordBtn.style.color = 'var(--text3, #888)';
      forgotPasswordBtn.style.cursor = 'default';
      forgotPasswordBtn.textContent = 'Yuborildi';

      const masked = data.masked_email || '';
      if (hintEl) {
        hintEl.style.display = 'block';
        hintEl.innerHTML = masked
          ? `Parol <strong style="color:var(--text,#fff);">${masked}</strong> ga yuborildi.<br>Kelmasa, <u>Spam (Keraksiz)</u> papkasini tekshiring.`
          : `Parol emailingizga yuborildi.<br>Kelmasa, <u>Spam (Keraksiz)</u> papkasini tekshiring.`;
      }

      // Parol inputini tozalash va fokus berish
      const pInp = $('aPassword');
      if (pInp) {
        pInp.value = '';
        pInp.placeholder = 'Emailga kelgan 8 xonali parol';
        pInp.focus();
      }

      toast(
        masked
          ? `Vaqtinchalik parol ${masked} ga yuborildi. Spam papkasini ham tekshiring!`
          : `Vaqtinchalik parol emailingizga yuborildi. Spam papkasini ham tekshiring!`,
        'info',
        8000
      );
    } catch (err) {
      console.error('[forgotPasswordBtn] error:', err);
      forgotPasswordBtn.disabled = false;
      forgotPasswordBtn.style.color = 'var(--tg-primary-blue,#1d9bf0)';
      forgotPasswordBtn.style.cursor = 'pointer';
      forgotPasswordBtn.textContent = 'Parolni unutdingizmi?';
      toast(err.message || 'Parolni tiklashda xatolik yuz berdi', 'error');
    }
  };
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

function _getDeviceId() {
  let id = null;
  try {
    id = localStorage.getItem('spacemr_device_id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem('spacemr_device_id', id);
    }
  } catch (_) {
    id = 'dev-' + Date.now();
  }
  return id;
}

function _getLocalPwdTs(uid) {
  return Number(localStorage.getItem(`spacemr_pwd_ts_${uid}`) || 0);
}
function _setLocalPwdTs(uid, ts) {
  if (uid && ts) localStorage.setItem(`spacemr_pwd_ts_${uid}`, String(ts));
}

export async function notifyPasswordChanged(uid) {
  if (!uid) return;
  const now = Date.now();
  _setLocalPwdTs(uid, now);
  try {
    const ch = sb.channel('user-session-' + uid);
    await ch.subscribe();
    await ch.send({
      type: 'broadcast',
      event: 'password_changed',
      payload: { sessionId: _getDeviceId(), at: now }
    });
  } catch (err) {
    console.warn('[Auth] notifyPasswordChanged broadcast error:', err?.message);
  }
}

function _buildMe(user, p) {
  return {
    uid: user.id,
    email: user.email || p?.email || null,
    displayName: p?.fullName || '',
    photoURL: p?.avatar || null,
    username: p?.username || '',
    isAdmin: !!p?.isAdmin,
    mustChangePassword: !!p?.mustChangePassword,
    passwordChangedAt: p?.passwordChangedAt || null,
    recoveryEmail: p?.recoveryEmail || null,
  };
}

function _blockedUntilMs(p) {
  return p?.blockedUntil || null;
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
  try { (window.__spacemrHideSplash || window.__mrspaceHideSplash)?.('gate'); } catch (_) {}

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
  _hideMandatoryPasswordResetModal();
  try { await Promise.race([removePushToken(), new Promise(r => setTimeout(r, 800))]); } catch (_) {}
  try { clearAllCache(); } catch (_) {}
  try { await sb.auth.signOut({ scope: 'local' }); } catch (_) {}
  try { await sb.auth.signOut({ scope: 'global' }); } catch (_) {}
  try {
    Object.keys(localStorage).forEach(k => {
      if (/supabase|spacemr|mrspace|sb-/i.test(k)) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage).forEach(k => {
      if (/supabase|spacemr|mrspace|sb-/i.test(k)) sessionStorage.removeItem(k);
    });
  } catch (_) {}
  state.me = null;
  _currentUid = null;
  _shownKey = null;
  stopChatsWatcher();
  stopBus();
  stopCallWatcher();
  stopPresenceHeartbeat();
  const app = $('app');
  const authWrap = $('authWrap');
  if (app) app.classList.remove('show');
  if (authWrap) authWrap.classList.add('show');
  hidePendingScreen();
  location.replace('/');
}

let _mandatoryModalActive = false;

function _showMandatoryPasswordResetModal(me) {
  _mandatoryModalActive = true;
  const overlay = $('mandatoryPwdOverlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  lockScroll();

  const errEl = $('mandatoryPwdErr');
  if (errEl) errEl.textContent = '';

  const newInp = $('mNewPassword');
  const confInp = $('mConfirmPassword');
  const saveBtn = $('mandatoryPwdSaveBtn');
  const outBtn = $('mandatoryPwdSignOutBtn');

  if (newInp) { newInp.value = ''; newInp.classList.remove('input-error'); }
  if (confInp) { confInp.value = ''; confInp.classList.remove('input-error'); }

  overlay.querySelectorAll('.pwd-eye-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const targetId = btn.dataset.target;
      const inp = $(targetId);
      if (!inp) return;
      const isPwd = inp.type === 'password';
      inp.type = isPwd ? 'text' : 'password';
      btn.innerHTML = isPwd
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    };
  });

  if (outBtn) {
    outBtn.onclick = async () => {
      _hideMandatoryPasswordResetModal();
      await _forceSignOut();
    };
  }

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Parolni saqlash va kirish';

    saveBtn.onclick = async () => {
      const p1 = newInp?.value || '';
      const p2 = confInp?.value || '';

      if (errEl) errEl.textContent = '';
      newInp?.classList.remove('input-error');
      confInp?.classList.remove('input-error');

      if (!p1 || p1.length < 6) {
        if (errEl) errEl.textContent = `Yangi parol kamida 6 ta belgi bo'lishi kerak`;
        newInp?.classList.add('input-error');
        newInp?.focus();
        return;
      }
      if (p1 !== p2) {
        if (errEl) errEl.textContent = 'Parollar bir-biriga mos kelmadi';
        confInp?.classList.add('input-error');
        confInp?.focus();
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saqlanmoqda...';

      try {
        const { error: pErr } = await sb.auth.updateUser({ password: p1 });
        if (pErr) throw pErr;

        try {
          await sb.rpc('user_password_updated');
        } catch (_) {
          await sb.from('profiles').update({
            must_change_password: false,
            password_changed_at: new Date().toISOString()
          }).eq('id', me.uid);
        }

        await notifyPasswordChanged(me.uid);

        me.mustChangePassword = false;
        _hideMandatoryPasswordResetModal();

        toast("Yangi parolingiz muvaffaqiyatli o'rnatildi!", 'success');
        await _enterApp(me);
      } catch (err) {
        console.error('[MandatoryPwdReset]', err);
        if (errEl) errEl.textContent = err.message || 'Xatolik yuz berdi';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Parolni saqlash va kirish';
      }
    };
  }
}

function _hideMandatoryPasswordResetModal() {
  _mandatoryModalActive = false;
  const overlay = $('mandatoryPwdOverlay');
  if (overlay) overlay.style.display = 'none';
  unlockScroll();
}

/** Profilning eng so'nggi holatiga qarab ekranni to'g'irlaydi (idempotent). */
async function _onLiveProfile(p, me) {
  if (!p) return;
  _saveVerifiedState(me.uid, p);
  Object.assign(me, _buildMe({ id: me.uid, email: me.email }, p));

  const appEl = $('app');
  const isInApp = !!(appEl && appEl.classList.contains('show'));

  // 0. Boshqa qurilmada parol yangilangan bo'lsa darhol logout qilish (kamida 60s farq bilan)
  const knownPwdTs = _getLocalPwdTs(me.uid);
  if (p.passwordChangedAt && knownPwdTs && (p.passwordChangedAt - knownPwdTs > 60000)) {
    console.warn('[Auth] Parol boshqa qurilmada yangilandi (ts tekshiruvi). Chiqilmoqda...');
    toast('Parolingiz boshqa qurilmada o\'zgartirildi. Iltimos, qayta kiring', 'warning');
    await _forceSignOut();
    return;
  }

  // 1. Bloklangan (muddati o'tmagan)
  if (_isBlockedNow(p)) {
    if (isInApp) {
      stopChatsWatcher();
      stopBus();
      stopCallWatcher();
      stopPresenceHeartbeat();
      appEl.classList.remove('show');
    }
    _showOnce('blocked', _blockedUntilMs(p));
    return;
  }

  // 2. Parolni majburiy yangilash talabi (admin tomonidan reset qilingan)
  if (p.mustChangePassword === true) {
    if (isInApp) {
      stopChatsWatcher();
      stopBus();
      stopCallWatcher();
      stopPresenceHeartbeat();
      appEl.classList.remove('show');
    }
    hidePendingScreen();
    _showMandatoryPasswordResetModal(me);
    return;
  } else {
    _hideMandatoryPasswordResetModal();
  }

  // 3. Ruxsat berilgan
  if (p.approved === true) {
    if (!isInApp && !_entering) {
      hidePendingScreen();
      _shownKey = null;
      await _enterApp(me);
    }
    return;
  }

  // 4. Pending yoki rejected (sessiyani o'chirib yubormasdan ekranni ko'rsatish)
  if (p.approved === 'rejected') {
    if (isInApp) {
      stopChatsWatcher();
      stopBus();
      stopCallWatcher();
      stopPresenceHeartbeat();
      appEl.classList.remove('show');
    }
    _showOnce('rejected');
    return;
  }
  if (p.approved === false) {
    if (isInApp) {
      stopChatsWatcher();
      stopBus();
      stopCallWatcher();
      stopPresenceHeartbeat();
      appEl.classList.remove('show');
    }
    _showOnce('pending');
  }
}

function _startRealtimeUserWatch(me) {
  _stopUserWatch();
  const uid = me.uid;

  // 1. Jonli signal (broadcast): hisob o'chirilganda yoki parol boshqa qurilmada o'zgarganda darhol logout qilish
  const sessionCh = sb.channel('user-session-' + uid)
    .on('broadcast', { event: 'account_deleted' }, async () => {
      console.warn('[Auth] Hisob admin tomonidan o\'chirildi');
      await _forceSignOut();
    })
    .on('broadcast', { event: 'password_changed' }, async payload => {
      const fromSession = payload?.payload?.sessionId;
      if (fromSession && fromSession === _getDeviceId()) {
        return; // o'z qurilmamiz parolni o'zgartirgan
      }
      console.warn('[Auth] Parol boshqa qurilmada o\'zgartirildi (broadcast). Darhol chiqilmoqda...');
      toast('Parolingiz boshqa qurilmada o\'zgartirildi. Barcha sessiyalar yopildi', 'warning');
      await _forceSignOut();
    })
    .subscribe();

  // 2. Postgres changes: profiles qatori o'chirilganda (DELETE) yoki o'zgarganda
  const profileCh = sb.channel('profile-' + uid)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
        async payload => {
          if (payload.eventType === 'DELETE') {
            await _forceSignOut();
            return;
          }
          await _onLiveProfile(mapProfile(payload.new), me);
        })
    .subscribe();

  // 3. Polling zaxira — 60s va tab fokuslanganda (debounce va token yangilanishi bilan)
  let consecutiveFailures = 0;
  let isChecking = false;

  const checkProfile = async () => {
    if (!navigator.onLine || isChecking) return;
    isChecking = true;
    try {
      let p = null;
      try {
        p = await _fetchProfile(uid);
      } catch (fErr) {
        // Agar JWT muddati o'tgan bo'lsa, avval tokenni yangilab qayta ko'ramiz
        if (/unauthorized|jwt expired|invalid claim|token is expired/i.test(fErr?.message || '')) {
          try {
            const { data: refData } = await sb.auth.refreshSession();
            if (refData?.session) {
              p = await _fetchProfile(uid);
            }
          } catch (_) {}
        }
      }

      if (p) {
        consecutiveFailures = 0;
        await _onLiveProfile(p, me);
      } else {
        consecutiveFailures++;
        console.warn(`[Auth] Profil tekshiruvi vaqtinchalik javob bermadi (${consecutiveFailures}/5)`);
        // Faqat ketma-ket 5 marta muvaffaqiyatsiz bo'lsa va auth.users da foydalanuvchi yo'q bo'lsa
        if (consecutiveFailures >= 5) {
          const { error: uErr } = await sb.auth.getUser();
          if (uErr && /not found|invalid claim|user does not exist/i.test(uErr.message || '')) {
            console.warn('[Auth] Foydalanuvchi bazadan o\'chirilgani tasdiqlandi');
            await _forceSignOut();
          }
        }
      }
    } catch (err) {
      console.warn('[Auth] checkProfile xatoligi:', err?.message || err);
    } finally {
      isChecking = false;
    }
  };

  const poll = setInterval(checkProfile, PROFILE_POLL_MS);

  let focusDebounce = null;
  const triggerDebouncedCheck = () => {
    if (focusDebounce) clearTimeout(focusDebounce);
    focusDebounce = setTimeout(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        checkProfile();
      }
    }, 2500);
  };

  window.addEventListener('focus', triggerDebouncedCheck);
  document.addEventListener('visibilitychange', triggerDebouncedCheck);

  _activeUserUnsub = () => {
    clearInterval(poll);
    if (focusDebounce) clearTimeout(focusDebounce);
    window.removeEventListener('focus', triggerDebouncedCheck);
    document.removeEventListener('visibilitychange', triggerDebouncedCheck);
    sb.removeChannel(sessionCh);
    sb.removeChannel(profileCh);
  };
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
    stopBus();
    stopCallWatcher();
    stopPresenceHeartbeat();
    const app = $('app');
    const authWrap = $('authWrap');
    if (app) app.classList.remove('show');
    if (authWrap) authWrap.classList.add('show');
    try { (window.__spacemrHideSplash || window.__mrspaceHideSplash)?.('no-session'); } catch (_) {}
    return;
  }

  // Token yangilanishi / takroriy SIGNED_IN — qayta ishlamaymiz
  if (_currentUid === user.id) return;
  _currentUid = user.id;

  if (!_serverTimeSynced) await _syncServerTime();

  let p = null, fetchErr = null;
  try { p = await _fetchProfile(user.id); } catch (err) { fetchErr = err; }

  // Yangi signup: handle_new_user trigger biroz kechikishi mumkin — 3 marta qayta urin
  if (!p && !fetchErr && navigator.onLine) {
    for (let i = 0; i < 3 && !p; i++) {
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
      try { p = await _fetchProfile(user.id); } catch (err) { fetchErr = err; break; }
    }
  }

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
    // Agar token eskirgan bo'lsa, uni avtomatik yangilashga urinib ko'ramiz
    if (/unauthorized|jwt expired|invalid claim|token is expired/i.test(fetchErr?.message || '')) {
      try {
        const { data: refData } = await sb.auth.refreshSession();
        if (refData?.session) {
          try {
            p = await _fetchProfile(user.id);
            fetchErr = null;
          } catch (rErr) { fetchErr = rErr; }
        }
      } catch (_) {}
    }

    if (!p) {
      // Faqatgina auth.users da foydalanuvchi yo'q bo'lsa (haqiqatan o'chirilgan bo'lsa) hisobdan chiqaramiz
      const { error: uErr } = await sb.auth.getUser();
      if (uErr && /not found|user does not exist/i.test(uErr.message || '')) {
        await _forceSignOut();
        return;
      }
      // Onlayn, lekin server xato berdi yoki kechikmoqda — sessiyani o'chirmasdan pending ko'rsatamiz
      _showOnce('pending');
      _startRealtimeUserWatch(me);
      return;
    }
  }

  // Profil qatori olinmagan bo'lsa — sessiyani buzmasdan kutish
  if (!p) {
    console.warn('[Auth] Profil qatori olinmadi, sessiya saqlanadi');
    _showOnce('pending');
    _startRealtimeUserWatch(me);
    return;
  }

  try {
    const { applyAdminNav } = await import('./router.js');
    applyAdminNav();
  } catch (_) {}

  // Sessiyadagi joriy parol vaqtini muhrlaymiz
  const currentTs = p.passwordChangedAt || Date.now();
  const existingTs = _getLocalPwdTs(me.uid);
  if (!existingTs || currentTs > existingTs) {
    _setLocalPwdTs(me.uid, currentTs);
  }

  // Faqat serverdan haqiqatan olingan holat — tasdiqlangan holat sifatida saqlanadi
  await _onLiveProfile(p, me);
  _startRealtimeUserWatch(me);
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
  // Yangi kirishda (SIGNED_IN) darhol joriy parol vaqtini yangilash (eski ts tufayli soxta logout bo'lmasligi uchun)
  if (event === 'SIGNED_IN' && session?.user?.id) {
    _setLocalPwdTs(session.user.id, Date.now());
  }
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
    if (sessionStorage.getItem('spacemr_new_signup') || sessionStorage.getItem('mrspace_new_signup')) {
      sessionStorage.removeItem('spacemr_new_signup');
      sessionStorage.removeItem('mrspace_new_signup');
      setTimeout(() => {
        if (typeof window._startOnboarding === 'function') window._startOnboarding(true);
      }, 1100);
    }

    listenPosts();
    if (!notificationsUserDisabled()) initPush();
    startBus();          // tezkor shina: like/izoh/post/presence/kirish qutisi
    startChatsWatcher(); // ichida startGroupsWatcher ham
    startCallWatcher();

    // "Oxirgi faollik" — admin panelida ko'rsatish uchun
    try {
      await sb.from('profiles').update({
        last_seen: new Date().toISOString(),
        last_user_agent: navigator.userAgent || null,
        last_platform: navigator.platform || null,
      }).eq('id', user.uid);
    } catch (_) { /* jim o'tkazib yuboramiz */ }

    startPresenceHeartbeat();

    // Splash davomida ko'proq ma'lumot yuklash
    try {
      await _preloadForSplash(user.uid);
    } catch (e) {
      console.warn('[Auth] preload:', e?.message || e);
    }
    try { (window.__spacemrHideSplash || window.__mrspaceHideSplash)?.('app-ready'); } catch (_) {}

    // Stories bar birinchi yuklanishda ham chiqsin (router auth dan oldin ishlagan bo'lishi mumkin)
    try {
      const { initStories } = await import('./stories.js');
      initStories();
    } catch (e) { console.warn('[Auth] stories', e?.message || e); }

    // Target post havolasi bilan kelgan bo'lsa (login qilingandan so'ng avtomatik postga o'tish)
    try {
      const { scrollToPostFromHash, getTargetPostId } = await import('./feed.js');
      const targetId = getTargetPostId();
      if (targetId) {
        const { navigateTo } = await import('./router.js');
        navigateTo('home', false);
        scrollToPostFromHash();
      }
    } catch (e) { console.warn('[Auth] target post scroll:', e?.message || e); }
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
 * Fon/yopiq oynada ham yuboriladi (brauzer taymerni sekinlatadi, lekin oyna baribir ochiq).
 ─────────────────────────────────────────────────────────────────────── */
const HEARTBEAT_MS = 25 * 1000;
let _heartbeatTimer = null;

async function _pingPresence() {
  const uid = state.me?.uid;
  if (!uid) return; // fon/yopiq oyna ham "onlayn" hisoblanadi (brauzer taymerni 1/min gacha sekinlatadi)
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
    _renderDebounceTimer = setTimeout(() => { render(); }, 0);
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
      const at = a.createdAt || 0;
      const bt = b.createdAt || 0;
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
    // O'ng panel ("So'nggi") shu hodisa orqali yangilanadi — alohida realtime kanal kerak emas (5.3)
    if (structural) document.dispatchEvent(new CustomEvent('postsUpdated'));
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

  // Tezkor shina: yozuvchidan to'g'ridan-to'g'ri keladi (postgres_changes kutilmaydi); keyin DB hodisasi to'g'rilaydi
  const _offBus = [
    busOn('post', o => {
      if (o.op === 'new' && o.row?.id) byId.set(o.row.id, mapPost(o.row));
      else if (o.op === 'del' && o.id) byId.delete(o.id);
      else return;
      _scheduleRender();
    }),
    busOn('like', o => {
      const p = byId.get(o.postId);
      if (p && Number.isFinite(o.n)) { byId.set(o.postId, { ...p, likes: o.n }); _scheduleRender(); }
    }),
    busOn('cmt', o => {
      const p = byId.get(o.postId);
      if (p && Number.isFinite(o.n)) { byId.set(o.postId, { ...p, commentCount: o.n }); _scheduleRender(); }
    }),
  ];

  _postsUnsub = () => { clearTimeout(_renderDebounceTimer); _offBus.forEach(f => f()); sb.removeChannel(ch); };
}

/* ── Profil edit / logout — to'liq implementatsiya ─────────────────── */

let _peAviPending = null;
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
    const editRecoveryEmail = $('editRecoveryEmail');
    if (editName) editName.value = d.fullName || '';
    if (editBioInput) editBioInput.value = d.bio || '';
    if (editUsername) editUsername.value = d.username || '';
    if (editRecoveryEmail) editRecoveryEmail.value = d.recoveryEmail || '';

    _peAviPending = null;
    const peAviImg = $('peAviImg');
    if (peAviImg) {
      const av = d.avatar || defAvi(d.fullName || 'U');
      peAviImg.innerHTML = `<img src="${av}" onerror="this.style.display='none'">`;
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

    const rawRecEmail = $('editRecoveryEmail')?.value?.trim() || '';
    if (rawRecEmail) {
      const emailRes = validateStrictEmail(rawRecEmail);
      if (!emailRes.ok) {
        toast(emailRes.error, 'error');
        return;
      }
    }

    const updates = {
      full_name: fn,
      bio:       $('editBioInput')?.value?.trim() || '',
      recovery_email: rawRecEmail || null,
    };

    const rawUser = $('editUsername')?.value?.trim() || '';
    if (rawUser) {
      const cleaned = rawUser.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (cleaned.length < 2) { toast("Username kamida 2 ta belgi bo'lishi kerak (a-z, 0-9, _)", 'error'); return; }
      if (cleaned.length > 20) { toast("Username 20 ta belgidan oshmasligi kerak", 'error'); return; }
      if (cleaned !== _peOriginalUsername) {
        try {
          const { data: grpRows } = await sb.from('groups').select('id').ilike('username', cleaned).limit(1);
          if (grpRows && grpRows.length) { toast('Bu nom allaqachon band', 'error'); return; }
        } catch (_) {}
      }
      updates.username = cleaned;
    }

    if (_peAviPending)   updates.avatar    = _peAviPending;

    // Parol o'zgartirish (ixtiyoriy)
    const oldPwd = $('editOldPassword')?.value || '';
    const newPwd = $('editNewPassword')?.value || '';
    const newPwd2 = $('editNewPassword2')?.value || '';
    const wantsPwd = !!(oldPwd || newPwd || newPwd2);
    if (wantsPwd) {
      if (!oldPwd) { toast('Joriy parolni kiriting', 'error'); return; }
      if (newPwd.length < 6) { toast("Yangi parol kamida 6 ta belgi bo'lishi kerak", 'error'); return; }
      if (newPwd !== newPwd2) { toast('Yangi parollar mos emas', 'error'); return; }
      try {
        const email = state.me.email || (state.me.username ? (state.me.username + '@spacemr.local') : null);
        // email DB dan
        let loginEmail = email;
        if (state.me.username) {
          const { data: em } = await sb.rpc('email_for_username', { p_username: state.me.username });
          if (em) loginEmail = em;
        }
        if (!loginEmail) { toast('Email topilmadi', 'error'); return; }
        await verifyPassword(loginEmail, oldPwd);
      } catch (err) {
        toast(err.code === 'wrong-password' ? "Joriy parol noto'g'ri" : ('Parol tekshiruvi: ' + err.message), 'error');
        return;
      }
    }

    try {
      const { error } = await sb.from('profiles').update(updates).eq('id', state.me.uid);
      if (error) {
        if (error.code === '23505') { toast('Bu username band', 'error'); return; }
        throw error;
      }
      if (wantsPwd) {
        const { error: pErr } = await sb.auth.updateUser({ password: newPwd });
        if (pErr) throw pErr;

        try {
          await sb.rpc('user_password_updated');
        } catch (_) {
          await sb.from('profiles').update({
            must_change_password: false,
            password_changed_at: new Date().toISOString()
          }).eq('id', state.me.uid);
        }

        await notifyPasswordChanged(state.me.uid);
      }
      state.me.displayName = fn;
      if (updates.username) state.me.username = updates.username;
      if (updates.avatar)   state.me.photoURL = updates.avatar;
      if (updates.recovery_email !== undefined) {
        state.me.recoveryEmail = updates.recovery_email;
        _paintSettingsRecoveryRow();
      }
      invalidateUserCache(state.me.uid);

      // parol maydonlarini tozalash
      ['editOldPassword','editNewPassword','editNewPassword2'].forEach(id => {
        const el = $(id); if (el) el.value = '';
      });

      const profileEditOverlay = $('profileEditOverlay');
      if (profileEditOverlay) { profileEditOverlay.classList.remove('show'); unlockScroll(); }
      toast(wantsPwd ? 'Profil va parol yangilandi' : 'Profil yangilandi', 'success');
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

export async function logOut() {
  try { await Promise.race([removePushToken(), new Promise(r => setTimeout(r, 1500))]); } catch (_) {}
  try { clearAllCache(); } catch (_) {}
  try { await sb.auth.signOut({ scope: 'local' }); } catch (_) {}
  try { await sb.auth.signOut({ scope: 'global' }); } catch (_) {}
  // Qolgan sessiya kalitlarini tozalash
  try {
    Object.keys(localStorage).forEach(k => {
      if (/supabase|spacemr-auth|mrspace-auth|sb-/i.test(k)) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage).forEach(k => {
      if (/supabase|spacemr|mrspace|sb-/i.test(k)) sessionStorage.removeItem(k);
    });
  } catch (_) {}
  location.replace('/');
}

const logoutBtn = $('logoutBtn');
if (logoutBtn) {
  logoutBtn.onclick = () => { logOut(); };
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

/** Sozlamalardagi Zaxira email qatorini yangilaydi */
function _paintSettingsRecoveryRow() {
  if (!state.me) return;
  const hintEl = $('settingsRecoveryHint');
  if (!hintEl) return;
  const rec = state.me.recoveryEmail;
  if (rec) {
    hintEl.textContent = `Faol: ${rec}`;
    hintEl.style.color = '#22c55e';
  } else {
    hintEl.textContent = "O'rnatilmagan (parolni tiklash uchun qo'shing)";
    hintEl.style.color = 'var(--tg-primary-blue, #1d9bf0)';
  }
}

function hideSettingsRecoveryModal() {
  const modal = $('settingsRecoveryModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    unlockScroll();
  }
}

const settingsRecoveryRow = $('settingsRecoveryRow');
if (settingsRecoveryRow) {
  settingsRecoveryRow.onclick = () => {
    const modal = $('settingsRecoveryModal');
    const inp = $('settingsRecoveryEmailInput');
    const errEl = $('settingsRecoveryEmailErr');
    if (inp) {
      inp.value = state.me?.recoveryEmail || '';
      inp.classList.remove('input-error');
    }
    if (errEl) errEl.textContent = '';
    if (modal) {
      modal.classList.add('show');
      modal.style.display = 'flex';
      lockScroll();
      if (inp) inp.focus();
    }
  };
}

const settingsRecoveryCancelBtn = $('settingsRecoveryCancelBtn');
if (settingsRecoveryCancelBtn) {
  settingsRecoveryCancelBtn.onclick = hideSettingsRecoveryModal;
}

const settingsRecoveryModal = $('settingsRecoveryModal');
if (settingsRecoveryModal) {
  settingsRecoveryModal.addEventListener('click', (e) => {
    if (e.target === settingsRecoveryModal) hideSettingsRecoveryModal();
  });
}

const settingsRecoverySaveBtn = $('settingsRecoverySaveBtn');
if (settingsRecoverySaveBtn) {
  settingsRecoverySaveBtn.onclick = async () => {
    if (!state.me) return;
    const inp = $('settingsRecoveryEmailInput');
    const errEl = $('settingsRecoveryEmailErr');
    const val = inp?.value?.trim() || '';

    if (val) {
      const res = validateStrictEmail(val);
      if (!res.ok) {
        if (errEl) errEl.textContent = res.error;
        if (inp) {
          inp.classList.add('input-error');
          inp.focus();
        }
        if ('vibrate' in navigator) navigator.vibrate([14, 6, 14]);
        return;
      }

      settingsRecoverySaveBtn.disabled = true;
      const oldText = settingsRecoverySaveBtn.textContent;
      settingsRecoverySaveBtn.textContent = 'Saqlanmoqda...';

      try {
        const { error } = await sb.from('profiles').update({ recovery_email: res.email }).eq('id', state.me.uid);
        if (error) throw error;
        state.me.recoveryEmail = res.email;
        const editRecoveryEmail = $('editRecoveryEmail');
        if (editRecoveryEmail) editRecoveryEmail.value = res.email;
        _paintSettingsRecoveryRow();
        hideSettingsRecoveryModal();
        toast('Zaxira email muvaffaqiyatli saqlandi!', 'success');
      } catch (err) {
        console.error('Settings recovery save error:', err);
        if (errEl) errEl.textContent = err.message || 'Saqlashda xatolik';
        toast(err.message || 'Saqlashda xatolik', 'error');
      } finally {
        settingsRecoverySaveBtn.disabled = false;
        settingsRecoverySaveBtn.textContent = oldText;
      }
    } else {
      settingsRecoverySaveBtn.disabled = true;
      const oldText = settingsRecoverySaveBtn.textContent;
      settingsRecoverySaveBtn.textContent = 'Saqlanmoqda...';

      try {
        const { error } = await sb.from('profiles').update({ recovery_email: null }).eq('id', state.me.uid);
        if (error) throw error;
        state.me.recoveryEmail = null;
        const editRecoveryEmail = $('editRecoveryEmail');
        if (editRecoveryEmail) editRecoveryEmail.value = '';
        _paintSettingsRecoveryRow();
        hideSettingsRecoveryModal();
        toast('Zaxira email olib tashlandi', 'info');
      } catch (err) {
        console.error('Settings recovery clear error:', err);
        if (errEl) errEl.textContent = err.message || 'Xatolik yuz berdi';
        toast(err.message || 'Xatolik yuz berdi', 'error');
      } finally {
        settingsRecoverySaveBtn.disabled = false;
        settingsRecoverySaveBtn.textContent = oldText;
      }
    }
  };
}

const settingsRecoveryEmailInput = $('settingsRecoveryEmailInput');
if (settingsRecoveryEmailInput) {
  settingsRecoveryEmailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('settingsRecoverySaveBtn')?.click();
    }
  });
  settingsRecoveryEmailInput.addEventListener('input', () => {
    settingsRecoveryEmailInput.classList.remove('input-error');
    const errEl = $('settingsRecoveryEmailErr');
    if (errEl) errEl.textContent = '';
  });
}

const settingsBtn = $('settingsBtn');
if (settingsBtn) {
  settingsBtn.onclick = () => {
    _paintSettingsProfileCard();
    _paintSettingsRecoveryRow();
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
          try { localStorage.removeItem('spacemr-auth'); localStorage.removeItem('mrspace-auth'); } catch (_) {}
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
