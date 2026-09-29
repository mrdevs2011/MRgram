/* ── Onlayn holat (presence) uchun CSS ────────────────────────────────── */
function _injectPresenceCSS() {
  if (document.getElementById('chat-presence-css')) return;
  const s = document.createElement('style');
  s.id = 'chat-presence-css';
  s.textContent = `
.chat-avi { position: relative; overflow: visible !important; }
.chat-avi img { border-radius: 50%; }
.presence-dot {
  position: absolute;
  right: -1px; bottom: -1px;
  width: 12px; height: 12px;
  background: #3ecf8e;
  border: 2px solid var(--bg1, #1a1a1a);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0,0.15);
  z-index: 2;
  pointer-events: none;
}
#chatTypingStatus {
  font-size: 12.5px;
  color: var(--text3, #767676);
  margin-top: 1px;
}
#chatTypingStatus.online { color: #3ecf8e; font-weight: 500; }
`;
  document.head.appendChild(s);
}

/* ── Search for non-admin users ──────────────────────────────────────── */
let _searchQuery = '';

function _injectSearchCSS() {
  if (document.getElementById('chat-search-css')) return;
  const s = document.createElement('style');
  s.id = 'chat-search-css';
  s.textContent = `
.ulist-search-wrap {
  position: relative; display: flex; align-items: center; gap: 12px;
  margin: 12px 14px 8px; height: 44px; padding: 0 16px;
  background: transparent;
  border: 1px solid #2f3336;
  border-radius: 999px;
  transition: border-color .15s;
}
.ulist-search-wrap:focus-within { border-color: var(--x-blue, #1d9bf0); box-shadow: none; }
.ulist-search-icon {
  color: var(--text3, #767676); flex-shrink: 0; cursor: pointer;
  display: flex; align-items: center; transition: color .15s;
}
.ulist-search-icon svg { width: 18px; height: 18px; }
.ulist-search-wrap:focus-within .ulist-search-icon { color: var(--x-blue, #1d9bf0); }
.ulist-search-input {
  flex: 1; min-width: 0; height: 100%; background: transparent; border: none; outline: none;
  box-shadow: none; color: var(--text, #fff); font-size: 15px; line-height: 1.4;
}
.ulist-search-input::placeholder { color: var(--text3, #767676); }
.ulist-search-result { margin: 0 18px 10px; font-size: 12.5px; font-weight: 500; color: var(--text3, #767676); }
.ulist-search-result.not-found { color: var(--red, #ef4444); }

/* ── Skeleton ── */
@keyframes skelShimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.chat-row-skeleton {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 16px;
  opacity: 0;
  animation: skelFadeIn .28s ease forwards;
}
@keyframes skelFadeIn { to { opacity: 1; } }
.skel-avi {
  width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0;
  background: var(--bg2,#262626);
  background-size: 400px 100%;
  animation: skelShimmer 1.3s infinite linear;
}
.skel-body { flex: 1; display: flex; flex-direction: column; gap: 7px; }
.skel-name, .skel-preview {
  height: 11px; border-radius: 7px;
  background: var(--bg2,#262626);
  background-size: 400px 100%;
  animation: skelShimmer 1.3s infinite linear;
}
.skel-name { height: 13px; }

/* ── Row slide-in animation ── */
`;
  document.head.appendChild(s);
}

function _renderSearchBox(container) {
  _injectSearchCSS();
  const existingBox = document.getElementById('chatSearchBoxWrap');
  if (existingBox) return; // already injected
  const wrap = document.createElement('div');
  wrap.id = 'chatSearchBoxWrap';
  wrap.innerHTML = `
    <div class="ulist-search-wrap">
      <div class="ulist-search-icon" id="chatSearchBtn" title="Havola bo'yicha qidirish">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"/><line x1="17" y1="17" x2="22" y2="22"/>
        </svg>
      </div>
      <input class="ulist-search-input" id="chatSearchInput" placeholder="Havola kiriting (username yoki link)..." autocomplete="off" spellcheck="false">
    </div>

    <div class="ulist-search-result d-none" id="chatSearchResult"></div>
  `;
  container.insertBefore(wrap, container.firstChild);

  const inp = document.getElementById('chatSearchInput');
  const btn = document.getElementById('chatSearchBtn');
  const res = document.getElementById('chatSearchResult');

  /* ── Havola bo'yicha qidirish ───────────────────────────────────────
     Xavfsizlik/maxfiylik uchun: yozayotganda (har harfda) HECH QANDAY
     natija ko'rsatilmaydi va fullName/username bo'yicha qisman (substring)
     moslik izlanmaydi. Faqat Enter bosilganda (yoki qidiruv belgisi
     bosilganda) qidiruv boshlanadi va faqat:
       1) to'liq mos username ("@username" yoki "username"), yoki
       2) to'liq mos guruh/kanal havolasi (maxfiy yoki ochiq)
     bo'yicha ANIQ (exact) moslik izlanadi. Muvaffaqiyatli holatda
     har doim faqat 1 ta natija chiqadi; aks holda "topilmadi" deyiladi. */
  function doSearch() {
    const raw = inp.value.trim();
    if (!raw) {
      _searchQuery = '';
      res.classList.add('d-none');
      const contacts = (_usersCache || []).filter(u => _myContacts.has(u.uid));
      _paintUserRows(contacts);
      return;
    }
    _searchQuery = raw;
    _paintSearchSkeleton();
    res.textContent = 'Qidirilmoqda...';
    res.className = 'ulist-search-result';
    res.classList.remove('d-none');
    setTimeout(async () => {
      // Qidiruv paytida input o'zgargan bo'lsa (masalan foydalanuvchi
      // qayta yozgan) — eskirgan natijani chizmaymiz
      if (inp.value.trim() !== raw) return;

      const uname = raw.startsWith('@') ? raw.slice(1) : raw;
      const foundUser = (_usersCache || []).find(u => (u.username || '').toLowerCase() === uname.toLowerCase());
      if (foundUser) {
        res.textContent = 'Natija topildi';
        res.className = 'ulist-search-result';
        res.classList.remove('d-none');
        _paintUserRows([foundUser], true /* animate */);
        return;
      }

      res.textContent = `"${raw}" — topilmadi`;
      res.className = 'ulist-search-result not-found';
      _paintUserRows([], true);
    }, 420);
  }

  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
  btn.addEventListener('click', doSearch);
  inp.addEventListener('input', () => {
    if (!inp.value.trim()) {
      _searchQuery = '';
      res.classList.add('d-none');
      const contacts = (_usersCache || []).filter(u => _myContacts.has(u.uid));
      _paintUserRows(contacts);
    }
  });
}

/* ── Skeleton loading for search ─────────────────────────────────────── */
function _paintSearchSkeleton() {
  const root = $('chatsListWrap');
  if (!root) return;
  let rowsWrap = document.getElementById('chatRowsWrap');
  if (!rowsWrap) {
    rowsWrap = document.createElement('div');
    rowsWrap.id = 'chatRowsWrap';
    root.appendChild(rowsWrap);
  }
  rowsWrap.innerHTML = [1,2,3].map((_, i) => `
    <div class="chat-row-skeleton" style="animation-delay:${i*0.08}s">
      <div class="skel-avi"></div>
      <div class="skel-body">
        <div class="skel-name" style="width:${55+i*12}%"></div>
        <div class="skel-preview" style="width:${40+i*8}%"></div>
      </div>
    </div>
  `).join('');
}

/* ── Paint only user rows (for search results / contacts) ────────────── */
function _paintUserRows(users, animate = false) {
  const root = $('chatsListWrap');
  if (!root) return;

  // Spinner yoki bo'sh placeholder ni o'chiramiz
  root.querySelectorAll('.spin-wrap, .empty').forEach(el => el.remove());

  let rowsWrap = document.getElementById('chatRowsWrap');
  if (!rowsWrap) {
    rowsWrap = document.createElement('div');
    rowsWrap.id = 'chatRowsWrap';
    root.appendChild(rowsWrap);
  }
  const chatMap = _latestChatMap;
  if (!users.length) {
    rowsWrap.innerHTML = '';
    return;
  }
  const rows = users.map(u => ({ u, c: chatMap[u.uid] || null }));
  rows.sort((a, b) => {
    const ta = a.c?.lastMessageAt || 0;
    const tb = b.c?.lastMessageAt || 0;
    if (ta !== tb) return tb - ta;
    return (a.u.fullName || '').localeCompare(b.u.fullName || '');
  });
  const html = rows.map(({ u, c }, idx) => {
    const av = u.avatar || defAvi(u.fullName || 'U');
    const isContact = _myContacts.has(u.uid);
    const online = isOnline(u.lastSeenAt);
    const preview = c
      ? `${c.lastSenderId === state.me.uid ? 'You: ' : ''}${esc((c.lastMessage || '').slice(0, 46))}`
      : isContact ? 'Kontakt' : 'Yangi suhbat boshlash';
    const time   = c?.lastMessageAt ? fmt(c.lastMessageAt) : '';
    const unread = c?.unreadCount?.[state.me.uid] || 0;
    const badgeTxt = unread > 99 ? '+99' : '+' + unread;
    const animStyle = '';
    return `<div class="chat-row${unread ? ' unread' : ''}${animate ? ' chat-row-anim' : ''}" data-uid="${u.uid}" ${animStyle}>
      <div class="chat-avi">
        <img src="${av}" onerror="this.style.display='none'">
        ${online ? '<span class="presence-dot" title="onlayn"></span>' : ''}
      </div>
      <div class="chat-row-body">
        <div class="chat-row-name">${esc(u.fullName || 'Foydalanuvchi')}</div>
        <div class="chat-row-preview${c ? '' : ' chat-row-empty'}">${preview}</div>
      </div>
      <div class="chat-row-right">
        ${time ? `<div class="chat-row-time">${time}</div>` : ''}
        ${unread ? `<div class="chat-row-badge">${badgeTxt}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  rowsWrap.innerHTML = html;
  _injectPresenceCSS();
  rowsWrap.querySelectorAll('.chat-row').forEach(row => {
    row.addEventListener('click', () => openChatThread(row.dataset.uid));
  });
}

/**
 * MRdatabase — Suhbatlar (1-on-1 DM)
 * Suhbatlar ro'yxati: barcha ro'yxatdan o'tgan userlar
 * Chat thread: real vaqtli xabarlashish (Firestore onSnapshot)
 *
 * Firestore schema:
 *   chats/{chatId} {
 *     participants:[uidA,uidB], lastMessage, lastSenderId, lastMessageAt,
 *     unreadCount: { [uid]: number }   // har bir ishtirokchi uchun alohida hisob
 *   }
 *   chats/{chatId}/messages/{msgId} {
 *     senderId, text, createdAt,
 *     status: 'sent' | 'read',         // 1 ptichka / 2 ptichka uchun
 *     readAt                           // o'qilgan vaqt (status='read' bo'lganda)
 *   }
 *   chatId = [uidA, uidB] tartiblanib '_' bilan birlashtiriladi (har doim bitta xat ID)
 *
 * NOT: agar real qurilmada ptichkalar 1dan 2ga o'tmasa — Firestore Security
 * Rules'ni tekshiring. messages/{msgId} hujjatini OLDIN faqat senderId yozgan,
 * endi esa qabul qiluvchi (boshqa ishtirokchi) ham shu hujjatni "status: read"
 * qilib yangilashi kerak — demak update qoidasi faqat
 * `senderId == request.auth.uid` bilan emas, balki ikkala ishtirokchiga ham
 * ruxsat berishi kerak (masalan: request.auth.uid in get(parent chat).data.participants).
 */
import {
  sb, state, uploadViaController, isAdmin, fetchAllRows, mapProfile, mapChat, mapMessage,
  mediaPublicUrl, ts, SUPABASE_URL, SUPABASE_ANON_KEY, MEDIA_BUCKET
} from './config.js';
import { $, esc, renderMarkdown, defAvi, fmt, fmtTime, fmtSz, isOnline, formatLastSeen } from './utils.js';
import { toast }            from './toast.js';
import {
  startGroupsWatcher, stopGroupsWatcher, bindGroupsRealtime,
  openGroupThread, closeGroupThread,
  sendGroupMessage, sendGroupFile,
  injectGroupsDOM, openCreateChoice, getGroupRows,
  getCurrentGroupId
} from './groups.js';
import {
  cacheChatsList, getCachedChatsList, getCachedChatsListAgeMs,
  cacheThreadMessages, getCachedThreadMessages, invalidateChatsListCache
} from './local-cache.js';

const MSG_LIMIT = 60; // Bir thread'da max xabar soni (RAM tejash)

/* ── Helpers ──────────────────────────────────────────────────────────── */
const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tasdiqlangan va (muddati o'tmagan) bloklanmagan foydalanuvchi */
function _isActiveUser(u) {
  if (u.approval !== 'approved') return false;
  if (!u.blocked) return true;
  return !!(u.blockedUntil && u.blockedUntil < Date.now());
}
async function _fetchChatUsers() {
  const rows = await fetchAllRows('profiles', '*', 'created_at');
  return rows.map(mapProfile).filter(u => u.uid !== state.me.uid && _isActiveUser(u));
}

let _threadUnsub = null;
let _reloadThread = null;
let _chatSelFile = null;

/* ── Global chats watcher (badge + chats list, real-time) ─────────────
   Bitta onSnapshot orqali HAR DOIM (foydalanuvchi qaysi view'da turishidan
   qat'i nazar) ishlaydi — login bo'lgan zahoti boshlanadi (auth.js orqali).
   Shu bitta listener ikki narsani ta'minlaydi:
     1) Sidebar/bottom-nav dagi "Suhbatlar" tugmasi ustidagi kichik qizil
        badge — barcha chatlardagi umumiy o'qilmagan xabarlar soni.
     2) Suhbatlar ro'yxati (har bir foydalanuvchi qatoridagi kattaroq badge) —
        agar foydalanuvchi hozir aynan shu view'da bo'lsa, real vaqtda
        qayta chiziladi.
   ──────────────────────────────────────────────────────────────────── */
let _chatsUnsub     = null;
let _usersCache     = null;
let _latestChatMap  = {};
let _watcherPromise = null;
let _noticeUnsub    = null;   // adminNotice real-time listener
let _loadNoticeFn   = null;   // 'chats-watcher' kanali admin_notice o'zgarganda shuni chaqiradi
let _presenceRepaintTick = null; // onlayn nuqtalarni vaqt bo'yicha yangilab turadi
let _latestNotice   = null;   // { text, target, createdAt } | null
let _contactsUnsub  = null;   // contacts real-time listener
let _myContacts     = new Set(); // current user's contact UIDs
let _groupsListenerAttached = false; // groupsUpdated leak oldini olish

function updateChatBadge(count) {
  const badge = $('chatBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = `+${count > 99 ? 99 : count}`;
    badge.classList.remove('d-none');
  } else {
    badge.textContent = '';
    badge.classList.add('d-none');
  }
}

/** Admin userni o'chirgan/bloklaganda chaqiriladi — hotira ichidagi va
 * localStorage'dagi kontaktlar (suhbat boshlash) keshini bekor qilib,
 * ro'yxatni Firestore'dan qayta yuklaydi (5 daqiqa kutilmaydi). */
export async function invalidateChatsUsersCache() {
  if (state.me?.uid) invalidateChatsListCache(state.me.uid);
  _usersCache = null;
  if (!state.me) return;
  try {
    _usersCache = await _fetchChatUsers();
    cacheChatsList(state.me.uid, _usersCache, _latestChatMap);
  } catch (err) {
    console.warn('[Chat] invalidateChatsUsersCache fetch failed:', err.message);
  }
  if (state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
}

export function startChatsWatcher() {
  // Also start groups watcher
  startGroupsWatcher();
  // Listen for group updates to repaint list — faqat BIR MARTA qo'shamiz
  if (!_groupsListenerAttached) {
    _groupsListenerAttached = true;
    document.addEventListener('groupsUpdated', () => {
      if (state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
    });
  }

  if (_chatsUnsub) return Promise.resolve();
  if (_watcherPromise) return _watcherPromise;

  _watcherPromise = (async () => {
    if (!state.me) return;

    // Agar kesh 5 daqiqadan yangi bo'lsa — butun "users" kolleksiyasini
    // qayta tarmoqdan yuklamaymiz (bu og'ir so'rov, foydalanuvchilar
    // ko'payib borgan sari sekinlashadi). Kesh eskirgan/yo'q bo'lsagina
    // yangilaymiz.
    const cacheAgeMs = getCachedChatsListAgeMs(state.me.uid);
    const cacheIsFresh = cacheAgeMs !== null && cacheAgeMs < 5 * 60 * 1000;

    if (cacheIsFresh) {
      // _usersCache hali o'rnatilmagan bo'lishi mumkin (masalan foydalanuvchi
      // "Suhbatlar" bo'limini hali ochmagan bo'lsa) — shu holatda ham
      // to'g'ridan-to'g'ri localStorage'dagi keshdan o'qib olamiz.
      if (!_usersCache) {
        const cached = getCachedChatsList(state.me.uid);
        _usersCache = cached?.users || [];
      }
    } else {
      try {
        _usersCache = await _fetchChatUsers();
        cacheChatsList(state.me.uid, _usersCache, _latestChatMap);
      } catch (err) {
        console.warn('[Chat] users fetch failed:', err.message);
        _usersCache = _usersCache || [];
      }
    }

    // Kontaktlar listener — oddiy user uchun contacts subcollection.
    // MUHIM: bu yerda ENDI hech narsani kutmaymiz (avval "birinchi snapshot
    // kelguncha yoki 5 soniya" deb sun'iy kutish bor edi — aynan shu
    // "10 soniya+" sekinlikning asosiy sababi edi). Listener fonda ishga
    // tushadi, ma'lumot kelganda ekran o'zi jimgina yangilanadi.
    if (!isAdmin() && !_contactsUnsub) {
      let _cDead = false;
      _contactsUnsub = () => { _cDead = true; };
      sb.from('contacts').select('contact_id').eq('owner_id', state.me.uid).then(({ data, error }) => {
        if (_cDead) return;
        if (error) { console.warn('[Chat] contacts load error:', error.message); return; }
        _myContacts = new Set((data || []).map(r => r.contact_id));
        if (state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
      });
    }

    if (!state.me) return; // logout race davomida

    // adminNotice real-time listener
    if (!_noticeUnsub) {
      let _nDead = false;
      const loadNotice = async () => {
        const { data } = await sb.from('admin_notice').select('*').eq('id', 'global').maybeSingle();
        if (_nDead) return;
        _latestNotice = data ? { text: data.text, target: data.target, createdAt: ts(data.created_at) } : null;
        if (state.view === 'chats') _repaintNoticeBanner();
      };
      // admin_notice o'zgarishini 'chats-watcher' kanali tinglaydi (5.3: alohida kanal yo'q)
      _noticeUnsub = () => { _nDead = true; };
      _loadNoticeFn = loadNotice;
      loadNotice();
    }

    let _chDead = false, _chTimer = null;
    const loadChats = async () => {
      const me = state.me?.uid;
      if (!me) return;
      const { data, error } = await sb.from('chats')
        .select('*, chat_members(user_id, unread_count)')
        .or(`user_a.eq.${me},user_b.eq.${me}`);
      if (_chDead || !state.me) return;
      if (error) { console.warn('[Chat] chats watcher error:', error.message); return; }
      const chatMap = {};
      let total = 0;
      (data || []).forEach(r => {
        const c = mapChat(r);
        const otherUid = c.participants.find(p => p !== me);
        if (otherUid) chatMap[otherUid] = c;
        total += c.unreadCount[me] || 0;
      });
      _latestChatMap = chatMap;
      updateChatBadge(total);
      if (_usersCache) cacheChatsList(state.me.uid, _usersCache, chatMap);
      if (state.view === 'chats') paintChatsList(_usersCache || [], chatMap);
    };
    const schedChats = () => { clearTimeout(_chTimer); _chTimer = setTimeout(loadChats, 200); };
    const chBase = sb.channel('chats-watcher')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notice' }, () => { _loadNoticeFn?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, schedChats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `user_id=eq.${state.me.uid}` }, p => {
        // faqat typing/last_seen o'zgargan bo'lsa ro'yxatni qayta yuklamaymiz
        if (p.eventType === 'UPDATE' && p.old && p.new.unread_count === p.old.unread_count) return;
        schedChats();
      });
    // guruh o'zgarishlari ham shu kanalda (5.3: 'groups-watcher' kanali yo'q)
    const chCh = bindGroupsRealtime(chBase).subscribe();
    _chatsUnsub = () => { _chDead = true; clearTimeout(_chTimer); sb.removeChannel(chCh); };
    loadChats();

    // Onlayn nuqtalar vaqt o'tishi bilan (masalan user oflayn bo'lib qolganda)
    // o'zi so'nishi uchun — yangi ma'lumot kelmasa ham ro'yxatni davriy
    // qayta chizamiz (isOnline() joriy vaqtga qarab hisoblanadi).
    if (!_presenceRepaintTick) {
      _presenceRepaintTick = setInterval(() => {
        if (state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
      }, 30000);
    }
  })();

  return _watcherPromise;
}

export function stopChatsWatcher() {
  stopGroupsWatcher();
  if (_chatsUnsub) { _chatsUnsub(); _chatsUnsub = null; }
  if (_noticeUnsub) { _noticeUnsub(); _noticeUnsub = null; }
  _loadNoticeFn = null;
  if (_contactsUnsub) { _contactsUnsub(); _contactsUnsub = null; }
  if (_presenceRepaintTick) { clearInterval(_presenceRepaintTick); _presenceRepaintTick = null; }
  _usersCache    = null;
  _latestChatMap = {};
  _latestNotice  = null;
  _myContacts    = new Set();
  _watcherPromise = null;
  _groupsListenerAttached = false;
  updateChatBadge(0);
}

/* ── Render chats list (all registered users) ───────────────────────── */
export async function renderChatsList() {
  const root = $('chatsListWrap');
  if (!root || !state.me) return;

  if (!_usersCache) {
    // Tarmoqni kutmasdan — keshdagi so'nggi ma'lumotni darhol ko'rsatamiz
    const cached = getCachedChatsList(state.me.uid);
    if (cached && cached.users && cached.users.length) {
      _usersCache    = cached.users;
      _latestChatMap = cached.chatMap || {};
      paintChatsList(_usersCache, _latestChatMap);
    } else {
      root.innerHTML = `<div class="spin-wrap pt-60px"><div class="spinner"></div></div>`;
    }
  }

  try {
    await startChatsWatcher();

    if (!_usersCache || !_usersCache.length) {
      root.innerHTML = `<div class="empty pt-30vh tac">
        <div class="fs-14px fw-600 c-text mb-6px">Hozircha boshqa foydalanuvchilar yo'q</div>
        <div class="fs-13px c-text2">Odamlar MRspace ga qo'shilgach, shu yerda ko'rinadi</div>
      </div>`;
      return;
    }

    paintChatsList(_usersCache, _latestChatMap);
  } catch (err) {
    console.error('❌ renderChatsList failed:', err.message);
    root.innerHTML = `<div class="empty pt-30vh tac">
      <div class="fs-14px fw-600 c-text mb-6px">Suhbatlar yuklanmadi</div>
      <div class="fs-13px c-text2">${esc(err.message)}</div>
    </div>`;
  }
}

/* ── Admin notice banner (chats tepasida) ────────────────────────────── */
function _injectNoticeCSS() {
  if (document.getElementById('admin-notice-css')) return;
  const s = document.createElement('style');
  s.id = 'admin-notice-css';
  s.textContent = `
.admin-notice-banner {
  display: flex; align-items: flex-start; gap: 10px;
  margin: 12px 16px 4px;
  background: color-mix(in srgb, var(--blue) 12%, var(--bg2));
  border: 1px solid color-mix(in srgb, var(--blue) 35%, transparent);
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13px;
  color: var(--text);
  line-height: 1.45;
}
.admin-notice-icon { color: var(--blue); flex-shrink:0; margin-top:1px; }
.admin-notice-text { flex: 1; word-break: break-word; }
`;
  document.head.appendChild(s);
}

function _repaintNoticeBanner() {
  const wrap = $('chatsListWrap');
  if (!wrap) return;
  const existing = document.getElementById('adminNoticeBanner');
  if (existing) existing.remove();
  if (!_latestNotice || !_latestNotice.text) return;
  const t = _latestNotice.target || 'all';
  if (t === 'pending') return; // kutayotganlar uchun — chatda ko'rinmaydi
  _injectNoticeCSS();
  const html = `<div class="admin-notice-banner" id="adminNoticeBanner">
    <div class="admin-notice-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <div class="admin-notice-text">${esc(_latestNotice.text)}</div>
  </div>`;
  wrap.insertAdjacentHTML('afterbegin', html);
}

export function repaintNoticeBanner() { _repaintNoticeBanner(); }

/* ── Append group/channel rows to chats list ─────────────────────────── */
function _appendGroupRows(root) {
  // Remove old group section if any
  root.querySelector('.grp-rows-section')?.remove();

  const groups = getGroupRows();
  if (!groups.length) return;

  const section = document.createElement('div');
  section.className = 'grp-rows-section';

  section.innerHTML = `<div class="chats-section-label">Guruhlar</div>` +
    groups.map(g => {
      const av      = g.avatar || defAvi(g.name || 'G');
      const unread  = g.unreadCount?.[state.me?.uid] || 0;
      const badgeTxt = unread > 99 ? '+99' : `+${unread}`;
      const preview  = g.lastMessage ? esc(g.lastMessage.slice(0, 46)) : 'Guruh';
      const time     = g.lastMessageAt ? fmt(g.lastMessageAt) : '';
      const typeIcon = `<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      const badgeClass = 'chat-row-grp-badge--group';

      return `<div class="chat-row${unread ? ' unread' : ''}" data-gid="${g.id}">
        <div class="chat-avi">
          <img src="${av}" onerror="this.style.display='none'">
          <div class="chat-row-grp-badge ${badgeClass}">${typeIcon}</div>
        </div>
        <div class="chat-row-body">
          <div class="chat-row-name">${esc(g.name || 'Guruh')}</div>
          <div class="chat-row-preview">${preview}</div>
        </div>
        <div class="chat-row-right">
          ${time ? `<div class="chat-row-time">${time}</div>` : ''}
          ${unread ? `<div class="chat-row-badge">${badgeTxt}</div>` : ''}
        </div>
      </div>`;
    }).join('');

  root.appendChild(section);

  section.querySelectorAll('.chat-row[data-gid]').forEach(row => {
    row.addEventListener('click', () => openGroupThread(row.dataset.gid));
  });
}

function paintChatsList(users, chatMap) {
  const root = $('chatsListWrap');
  if (!root) return;

  // Search box endi hamma uchun (admin va oddiy user) ko'rsatiladi
  _renderSearchBox(root);

  const admin = isAdmin();
  const q = _searchQuery;
  let filtered;
  if (q) {
    // Qidiruv faol — faqat ANIQ mos username natijasini ko'rsatamiz
    // (substring/fullName bo'yicha qidirish YO'Q — maxfiylik uchun)
    const uname = q.startsWith('@') ? q.slice(1) : q;
    const exact = users.find(u => (u.username || '').toLowerCase() === uname.toLowerCase());
    filtered = exact ? [exact] : [];
  } else if (admin) {
    // Admin uchun: qidiruv bo'sh bo'lsa to'liq ro'yxat ko'rinadi
    filtered = users;
  } else {
    // Oddiy user uchun: qidiruv bo'sh bo'lsa faqat kontaktlar ko'rinadi
    // (eski chat tarixi hisobga olinmaydi — hammada 0dan boshlanadi)
    filtered = users.filter(u => _myContacts.has(u.uid));
  }
  _paintUserRows(filtered);
  _repaintNoticeBanner();
  _appendGroupRows(root);
}

/* ── Other user avatar cache for DM messages ─────────────────────────── */
let _otherUserAvi = '';
let _otherUserUid = '';

/* ── Peer onlayn holati (chat thread sarlavhasi uchun) ────────────────── */
let _peerUserUnsub = null;
let _peerStatusTick = null;
let _peerLastSeenAt = null;
let _chatDocUnsub = null;
let _peerTyping = false;
let _iAmTyping = false;
let _typingTimeout = null;
let _typingCh = null;      // joriy DM uchun BITTA doimiy broadcast kanal (yuborish + qabul)
let _typingChReady = false;

function _paintPeerStatus(lastSeenAt) {
  _peerLastSeenAt = lastSeenAt;
  const el = $('chatTypingStatus');
  if (!el) return;
  if (_peerTyping) {
    el.textContent = 'yozmoqda...';
    el.classList.add('online');
    return;
  }
  const online = isOnline(lastSeenAt);
  el.textContent = formatLastSeen(lastSeenAt);
  el.classList.toggle('online', online);
}

/* ── "Yozmoqda..." — realtime broadcast (bazaga yozilmaydi) ──────────────
 * Chat ochilganda BITTA kanal (`typing-bc-<chatId>`) ochiladi (openChatThread),
 * ikki tomon ham shunga obuna; yuboruvchi shu kanaldan `send` qiladi.
 * Kanal chat yopilganda olib tashlanadi. Faqat DM.
 ─────────────────────────────────────────────────────────────────────── */
function _setTyping(isTyping) {
  if (!state.currentChatId || !state.me) return;
  if (_iAmTyping === isTyping) return; // ortiqcha yuborishlarni oldini olish
  if (!_typingCh || !_typingChReady) return; // kanal hali ulanmagan
  _iAmTyping = isTyping;
  try {
    _typingCh.send({ type: 'broadcast', event: 'typing', payload: { uid: state.me.uid, typing: isTyping } });
  } catch (_) {}
}

function _onChatInputTyping() {
  // Faqat 1v1 (DM) chatda ishlaydi — guruh/kanalda alohida mantiq kerak
  if (state.currentChatKind && state.currentChatKind !== 'dm') return;
  _setTyping(true);
  clearTimeout(_typingTimeout);
  _typingTimeout = setTimeout(() => _setTyping(false), 2500);
}

/* ── Open chat thread ─────────────────────────────────────────────────── */
export async function openChatThread(uid) {
  if (!uid || !state.me || uid === state.me.uid) return;

  _injectPresenceCSS();
  $('chatThreadModal').classList.add('show');
  $('chatThreadName').textContent   = '...';
  $('chatThreadAvi').innerHTML      = '';
  $('chatThreadInput').value        = '';

  state.currentChatUid = uid;
  let chatId = _latestChatMap[uid]?.id;
  if (!chatId || !_UUID_RE.test(chatId)) {
    const { data, error } = await sb.rpc('get_or_create_chat', { p_other: uid });
    if (error || !data) {
      console.warn('[Chat] get_or_create_chat:', error?.message);
      toast('Suhbat ochilmadi', 'error');
      closeChatThread();
      return;
    }
    if (state.currentChatUid !== uid) return; // shu orada boshqa chatga o'tilgan
    chatId = data;
  }
  state.currentChatId = chatId;
  // Boshqa chatga o'tilganda ID-kuzatuvchini tozalaymiz — aks holda Set
  // cheksiz o'sib ketishi mumkin va yangi chatning birinchi ochilishida
  // xabarlar tabiiy tarzda "pop-in" bo'lishi kerak.
  if (_seenMsgIdsChatId !== chatId) {
    _seenMsgIds = new Set();
    _seenMsgIdsChatId = chatId;
  }
  // Agar hozir ijro etilayotgan ovozli xabar aynan shu chatga tegishli
  // bo'lsa — mini-pleer bar endi kerak emas (xabar o'zi thread ichida
  // ko'rinadi), aks holda bar davom etib turadi.
  try { _syncMiniPlayer(); } catch (_) {}

  // Tarmoqni kutmasdan — keshdagi so'nggi xabarlarni darhol ko'rsatamiz
  const _cachedMsgs = getCachedThreadMessages(chatId);
  if (_cachedMsgs && _cachedMsgs.length) {
    paintMessages(_cachedMsgs);
  } else {
    $('chatThreadMessages').innerHTML = `<div class="spin-wrap pt-60px"><div class="spinner"></div></div>`;
  }
  // Reset voice/file state (functions defined below, safe after page load)
  try { cancelRecording(); } catch(_) {}
  $('chatVoiceBtn')?.classList.remove('active');
  _chatSelFile = null;
  $('chatFilePreview')?.classList.remove('active');
  $('chatFileInput') && ($('chatFileInput').value = '');
  try { updateVoiceSendBtn(); } catch(_) {}

  const videoBtn = $('chatVideoCallBtn');
  if (videoBtn) videoBtn.style.display = '';
  const voiceCallBtn = $('chatVoiceCallBtn');
  if (voiceCallBtn) voiceCallBtn.style.display = '';
  try {
    const { data: prow } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    const ud = mapProfile(prow) || {};
    const av = ud.avatar || defAvi(ud.fullName || 'U');
    $('chatThreadName').textContent = ud.fullName || 'Foydalanuvchi';
    $('chatThreadAvi').innerHTML = `<img src="${av}" onerror="this.style.display='none'">`;
    _paintPeerStatus(ud.lastSeenAt);
    // Cache for message avatars
    _otherUserAvi = av;
    _otherUserUid = uid;
  } catch (err) {
    console.warn('[Chat] Failed to load user info:', err.message);
    _otherUserAvi = defAvi('U');
    _otherUserUid = uid;
  }

  // Onlayn holatni real vaqtda kuzatib turish — peer user hujjatidagi
  // `lastSeenAt` heartbeat orqali yangilanganda darhol sarlavhada ko'rinsin.
  if (_peerUserUnsub) { _peerUserUnsub(); _peerUserUnsub = null; }
  {
    const pch = sb.channel('peer-' + uid)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
          p => _paintPeerStatus(ts(p.new?.last_seen)))
      .subscribe();
    _peerUserUnsub = () => sb.removeChannel(pch);
  }
  // "Onlayn"dan "N daqiqa oldin"ga o'tishini ko'rsatish uchun har 20s da
  // matnni qayta hisoblaymiz (server yozuvi o'zgarmasa ham vaqt o'tadi).
  if (_peerStatusTick) clearInterval(_peerStatusTick);
  _peerStatusTick = setInterval(() => _paintPeerStatus(_peerLastSeenAt), 20000);

  // "Yozmoqda..." — realtime broadcast (typing_until ustuni yo'q)
  _peerTyping = false;
  _iAmTyping = false;
  if (_chatDocUnsub) { _chatDocUnsub(); _chatDocUnsub = null; }
  {
    let tTimer = null;
    const tch = sb.channel('typing-bc-' + chatId)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.uid !== uid) return;
        clearTimeout(tTimer);
        _peerTyping = !!payload.typing;
        if (_peerTyping) tTimer = setTimeout(() => { _peerTyping = false; _paintPeerStatus(_peerLastSeenAt); }, 5000);
        _paintPeerStatus(_peerLastSeenAt);
      })
      .subscribe(st => { if (tch === _typingCh) _typingChReady = (st === 'SUBSCRIBED'); });
    _typingCh = tch;
    _typingChReady = false;
    _chatDocUnsub = () => {
      clearTimeout(tTimer);
      if (_typingCh === tch) { _typingCh = null; _typingChReady = false; }
      sb.removeChannel(tch);
    };
  }

  // Chat get_or_create_chat() bilan yaratilgan. Men ochyapman — o'qilmaganlarim nolga.
  sb.from('chat_members').update({ unread_count: 0 })
    .eq('chat_id', chatId).eq('user_id', state.me.uid)
    .then(({ error }) => { if (error) console.warn('[Chat] unread reset:', error.message); });

  // Kontaktlarni saqlash — xato bo'lsa chat ochilishga ta'sir qilmaydi.
  try {
    const od = (_usersCache || []).find(u => u.uid === uid) || {};
    const { error: cErr } = await sb.from('contacts').upsert(
      { owner_id: state.me.uid, contact_id: uid, full_name: od.fullName || '', avatar: od.avatar || '' },
      { onConflict: 'owner_id,contact_id' }
    );
    if (cErr) throw cErr;
    _myContacts.add(uid);
  } catch (err) {
    console.warn('[Chat] Failed to save contacts:', err.message);
  }

  if (_threadUnsub) { _threadUnsub(); _threadUnsub = null; }

  let _tDead = false, _tTimer = null;
  const loadThread = async () => {
    const { data, error } = await sb.from('messages').select('*')
      .eq('chat_id', chatId).order('created_at', { ascending: false }).limit(MSG_LIMIT);
    if (_tDead) return;
    if (error) {
      console.warn('[Chat] Thread load error:', error.message);
      if (!(_cachedMsgs && _cachedMsgs.length)) {
        $('chatThreadMessages').innerHTML = `<div class="empty pt-30vh tac">
          <div class="fs-13px c-text2">Xabarlar yuklanmadi</div>
        </div>`;
      }
      return;
    }
    const msgs = (data || []).map(mapMessage).reverse();
    paintMessages(msgs);
    cacheThreadMessages(chatId, msgs);
    // Thread ochiq turgan bo'lsa — kelgan xabarlarni shu zahoti "read" qilamiz
    if (state.currentChatId === chatId && $('chatThreadModal').classList.contains('show')) {
      markThreadRead(chatId, uid, msgs);
    }
  };
  const schedThread = () => { clearTimeout(_tTimer); _tTimer = setTimeout(loadThread, 80); };
  const mch = sb.channel('thread-' + chatId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, schedThread)
    .subscribe(st => { if (st === 'SUBSCRIBED') schedThread(); });
  _threadUnsub = () => { _tDead = true; clearTimeout(_tTimer); sb.removeChannel(mch); };
  _reloadThread = loadThread;
  loadThread();
}

/* ── Mark incoming (other user's) messages as read ───────────────────── */
async function markThreadRead(chatId, otherUid, msgs) {
  if (!state.me) return;
  const unread = msgs.filter(m => m.senderId === otherUid && m.status !== 'read');
  if (!unread.length) return;


  try {
    const { error } = await sb.from('messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .in('id', unread.map(m => m.id));
    if (error) throw error;
    await sb.from('chat_members').update({ unread_count: 0 })
      .eq('chat_id', chatId).eq('user_id', state.me.uid);
  } catch (err) {
    console.error('❌ markThreadRead failed:', err.message);
  }
}

function renderTicks(status) {
  // 'read' = 2 ko'k chek, boshqa holat (sent/undefined/null) = 1 oq chek
  if (status === 'read') {
    return `<svg class="msg-ticks read" width="18" height="11" viewBox="0 0 18 11" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 5.5L4.5 9L10 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 5.5L9.5 9L16 1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  // sent (yoki pending)
  return `<svg class="msg-ticks" width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 5.2L4.5 8.5L11 1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ── Voice waveform bars ──────────────────────────────────────────────
 * Boshlanishida — tekis (flat) past bar'lar (real ma'lumot hali yo'q).
 * Audio fayl fonda decode qilingach, har bir bar shu segmentdagi
 * HAQIQIY ovoz amplitudasiga (RMS) qarab balandligini oladi —
 * `_hydrateVoiceWaveforms()` orqali. Shu tufayli baland ovoz — baland
 * bar, past/jim joy — past bar bo'ladi (sun'iy sinus emas). */
const CVM_MIN_BARS  = 50;  // eng qisqa xabar uchun bar soni
const CVM_MAX_BARS  = 80;  // eng uzun xabar uchun bar soni
const CVM_BAR_COUNT = CVM_MIN_BARS; // fallback (davomiylik noma'lum bo'lganda)
const CVM_MIN_H = 3;   // tekis bazaviy balandlik (px)
const CVM_MAX_H = 24;  // eng baland pik (px) — ingichka, zich barlar bilan muvozanatli

/* Telegram — bar sonini xabar davomiyligiga qarab dinamik hisoblaydi:
 * qisqa ovozli xabar ~50 ta ingichka bar, uzunrog'i (≈20s+) esa ~80
 * tagacha bar bilan chiziladi — natijada wave zich va aniq ko'rinadi. */
function _voiceBarCount(duration) {
  const d = Number(duration) || 0;
  if (d <= 0) return CVM_MIN_BARS;
  const count = Math.round(d * 4); // ≈4 bar/soniya
  return Math.max(CVM_MIN_BARS, Math.min(CVM_MAX_BARS, count));
}

function renderVoiceWave(seed = 0, count = CVM_BAR_COUNT) {
  let bars = '';
  for (let i = 0; i < count; i++) {
    bars += `<span class="cvm-bar" style="height:${CVM_MIN_H}px"></span>`;
  }
  return bars;
}

/* url → Promise<number[] | null> (har bir qiymat 0..1, normalizatsiya
 * qilingan RMS amplituda). Bir xil xabar ikki marta decode qilinmasin
 * deb keshlaymiz. */
const _waveformCache = new Map();

function _getWaveformData(url, count = CVM_BAR_COUNT) {
  if (!url) return Promise.resolve(null);
  const cacheKey = `${url}::${count}`;
  if (_waveformCache.has(cacheKey)) return _waveformCache.get(cacheKey);

  const promise = (async () => {
    try {
      // cache: 'no-store' — brauzer HTTP keshida (yoki avval boshqa joyda
      // <audio> orqali Range so'rov bilan olingan qisman/206 javobda)
      // qolib ketgan noto'liq baytlarni QAYTA ISHLATMASLIK uchun. Har
      // safar to'liq, yangi oqim so'raladi — shu orqali "Unable to
      // decode audio data" xatosining eng keng tarqalgan sababi
      // (keshdagi buzuq/qisman fayl) bartaraf etiladi.
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrBuf = await res.arrayBuffer();
      if (!arrBuf || arrBuf.byteLength === 0) throw new Error('Bo\'sh audio bufer');
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const audioBuf = await ctx.decodeAudioData(arrBuf.slice(0));
      const raw = audioBuf.getChannelData(0); // 1-kanal yetarli
      const blockSize = Math.max(1, Math.floor(raw.length / count));
      const peaks = [];
      for (let i = 0; i < count; i++) {
        const start = i * blockSize;
        const end = Math.min(raw.length, start + blockSize);
        let sumSq = 0, n = 0;
        for (let j = start; j < end; j++) { sumSq += raw[j] * raw[j]; n++; }
        // RMS — segmentning haqiqiy energiya/chastota darajasi
        peaks.push(n ? Math.sqrt(sumSq / n) : 0);
      }
      try { ctx.close(); } catch (_) {}
      const max = Math.max(...peaks, 0.0001);
      return peaks.map(v => Math.min(1, v / max));
    } catch (e) {
      // e?.message || e — Error obyektining o'z xususiyatlari (message,
      // stack) enumerable emas, shuning uchun ba'zi konsollarda to'g'ridan
      // to'g'ri Error obyektini chop etsak "Error {}" (bo'sh) ko'rinadi va
      // haqiqiy sabab (masalan "Failed to fetch" — odatda CORS yoki
      // noto'g'ri/eskirgan Supabase Storage URL) yashirinib qoladi.
      console.warn('Waveform ajratib olishda xato:', e?.message || e?.name || e, '| url:', url);
      // MUHIM (flat-forever fix): agar shu (muvaffaqiyatsiz) natijani
      // keshda saqlab qo'ysak, chat ro'yxati Firestore yangilanishi bilan
      // qayta chizilganda (bu tez-tez sodir bo'ladi) HAR SAFAR shu keshdagi
      // "null"ni qaytarib, xabar ABADIY tekis (flat) ko'rinib qolardi —
      // hatto vaqtinchalik tarmoq xatosi tuzalgan bo'lsa ham. Xato holatini
      // keshdan o'chiramiz — shunda keyingi qayta chizilishda (re-render)
      // qaytadan haqiqiy urinish (retry) qilinadi.
      _waveformCache.delete(cacheKey);
      return null; // xato bo'lsa — tekis holat saqlanib qoladi
    }
  })();

  _waveformCache.set(cacheKey, promise);
  return promise;
}

/* Bir vaqtning o'zida ko'p ovozli xabar fon fonida dekod qilinsa,
 * server/tarmoqqa haddan tashqari ko'p parallel so'rov ketib, hatto
 * <audio> elementining o'zi ham yuklanishida muammo tug'dirishi mumkin
 * (masalan "no supported source" xatosi). Shu sabab — navbat orqali
 * bir vaqtda faqat 2 tasi dekod qilinadi, qolganlari navbatda kutadi. */
const CVM_MAX_CONCURRENT = 2;
let _cvmActiveDecodes = 0;
const _cvmQueue = [];

function _cvmRunQueue() {
  while (_cvmActiveDecodes < CVM_MAX_CONCURRENT && _cvmQueue.length) {
    const job = _cvmQueue.shift();
    _cvmActiveDecodes++;
    job().finally(() => {
      _cvmActiveDecodes--;
      _cvmRunQueue();
    });
  }
}

function _cvmEnqueue(job) {
  _cvmQueue.push(job);
  _cvmRunQueue();
}

/* Faqat foydalanuvchi haqiqatan ko'rayotgan (viewportga yaqin) ovozli
 * xabarlar uchun waveform yuklaymiz — chat ochilishi bilanoq o'nlab
 * xabarning to'liq audio faylini fon fonida yuklab yubormaymiz. */
let _cvmObserver = null;
function _cvmGetObserver() {
  if (_cvmObserver) return _cvmObserver;
  _cvmObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const waveEl = entry.target;
      _cvmObserver.unobserve(waveEl);
      _cvmStartHydrate(waveEl);
    });
  }, { root: null, rootMargin: '200px', threshold: 0.01 });
  return _cvmObserver;
}

function _cvmStartHydrate(waveEl) {
  const wrap = waveEl.closest('.chat-voice-msg');
  const url = wrap?.dataset.url;
  // Bar soni renderVoiceWave() chizganidagi son bilan bir xil bo'lishi kerak
  // (aks holda haqiqiy amplituda qiymatlari bar'lar bilan mos kelmay qoladi).
  const count = parseInt(wrap?.dataset.barCount, 10) || CVM_BAR_COUNT;
  if (!url || waveEl.dataset.hydrated === '1' || waveEl.dataset.hydrated === 'pending') return;
  waveEl.dataset.hydrated = 'pending';
  _cvmEnqueue(() => _getWaveformData(url, count).then(data => {
    if (!waveEl.isConnected) return;
    if (!data) { waveEl.dataset.hydrated = ''; return; }
    waveEl.dataset.hydrated = '1';
    const bars = waveEl.querySelectorAll('.cvm-bar');
    bars.forEach((b, i) => {
      const v = data[i] ?? 0;
      const h = CVM_MIN_H + v * (CVM_MAX_H - CVM_MIN_H);
      b.style.height = `${h.toFixed(1)}px`;
    });
  }));
}

/* Berilgan konteyner ichidagi hali "hydrate" qilinmagan barcha voice
 * xabarlarni kuzatuvga (IntersectionObserver) qo'shadi — har biri
 * faqat ekranga yaqinlashganda navbat orqali dekod qilinadi. */
function _hydrateVoiceWaveforms(container) {
  if (!container) return;
  const observer = _cvmGetObserver();
  const wraps = container.querySelectorAll('.chat-voice-msg[data-url]');
  wraps.forEach(wrap => {
    const waveEl = wrap.querySelector('.cvm-waveform');
    if (!waveEl || waveEl.dataset.hydrated === '1' || waveEl.dataset.hydrated === 'pending') return;
    observer.observe(waveEl);
  });
}

/* ── Xabar pufakchalari uchun "bounce" (pop-in) animatsiyasi qaysi
 * xabarlarga tegishli ekanini ANIQ, ID asosida kuzatamiz.
 *
 * ESKI USUL MUAMMOSI: oldin `idx >= prevCount` (ya'ni "avvalgi chizishda
 * nechta .chat-msg bor edi") solishtirilardi. Lekin "...yozmoqda"
 * pufakchasi HAM `.chat-msg` klassiga ega va u paintMessages()
 * dan TASHQARIDA, to'g'ridan-to'g'ri box.appendChild() bilan qo'shiladi/
 * o'chiriladi. Natijada `box.querySelectorAll('.chat-msg').length` real
 * Firestore xabarlar soniga har doim mos kelmasdi (goh ortiq, goh kam) —
 * xabar yuborilganda yoki xabar yangilanganda (bularning har biri messages'ga alohida
 * onSnapshot signalini qo'zg'atadi) `prevCount` noto'g'ri chiqib, ko'p
 * hollarda BARCHA xabarlar "yangi" deb hisoblanib, hammasi bir vaqtda
 * "bounce" bo'lib qolardi.
 *
 * YECHIM: har bir xabarning barqaror Firestore ID'si orqali — "shu ID
 * avval chizilganmi?" — tekshiramiz. Faqat HAQIQIY yangi (hali hech
 * qachon chizilmagan) xabar bounce bo'ladi; status/audioUrl kabi
 * maydonlar yangilanib qayta chizilganda eski xabarlar tegilmaydi. */
let _seenMsgIds = new Set();
let _seenMsgIdsChatId = null;

/* ── Sana ajratuvchi (Telegram uslubida "Bugun" / "Kecha" / "12-iyul") ── */
export function _toDateSafe(ts) {
  if (!ts) return null;
  return new Date(ts);
}
export function _isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
const _UZ_MONTHS = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
export function _dateSepLabel(ts) {
  const d = _toDateSafe(ts);
  if (!d) return '';
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (_isSameDay(d, now)) return 'Bugun';
  if (_isSameDay(d, yesterday)) return 'Kecha';
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? `${d.getDate()}-${_UZ_MONTHS[d.getMonth()]}`
    : `${d.getDate()}-${_UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function paintMessages(msgs) {
  const box = $('chatThreadMessages');
  if (!box) return;

  if (!msgs.length) {
    box.innerHTML = `<div class="empty pt-30vh tac">
      <div class="fs-14px fw-600 c-text mb-6px">Hozircha xabarlar yo'q</div>
      <div class="fs-13px c-text2">Salom bering</div>
    </div>`;
    return;
  }

  const prevCount = box.querySelectorAll('.chat-msg').length;
  // Foydalanuvchi pastda (eng oxirgi xabarlarda) turganini tekshiramiz
  // threshold: pastdan 120px uzoqda bo'lsa "pastda" hisoblanadi
  const isAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const isInitialLoad = prevCount === 0;

  box.innerHTML = msgs.map((m, idx) => {
    const mine = m.senderId === state.me?.uid;
    const time = fmtTime(m.createdAt);
    let bubbleContent = '';

    if (m.type === 'voice') {
      /* ── Voice message ── */
      const voiceMedia = { url: m.mediaUrl || '', duration: m.duration || 0 };
      const dur = voiceMedia.duration ? fmtVoiceDur(voiceMedia.duration) : '0:00';
      const barCount = _voiceBarCount(voiceMedia.duration);
      // URL ni esc() orqali o'tkazmaymiz — & belgisi buziladi!
      // data-* attributga to'g'ridan-to'g'ri qo'yamiz
      const safeUrl = (voiceMedia.url || '').replace(/"/g, '&quot;');
      const _mpName = (mine ? 'Siz' : ($('chatThreadName')?.textContent || 'Ovozli xabar')).replace(/"/g, '&quot;');
      bubbleContent = `<div class="chat-voice-msg" data-url="${safeUrl}" data-dur="${voiceMedia.duration||0}" data-bar-count="${barCount}" data-chat-id="${state.currentChatId||''}" data-chat-uid="${state.currentChatUid||''}" data-name="${_mpName}">
        <button class="cvm-play" onclick="window._chatPlayVoice(this)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <div class="cvm-waveform">${renderVoiceWave(idx, barCount)}</div>
        <span class="cvm-dur">${dur}</span>
      </div>`;
    } else if (m.type === 'file') {
      /* ── File message ── */
      const fname = esc(m.fileName || 'file');
      const fsz = m.fileSize ? fmtSz(m.fileSize) : '';
      const safeUrl = (m.mediaUrl || '').replace(/"/g, '&quot;');
      const _ext = (m.fileName || '').toLowerCase().split('.').pop() || '';
      const _mime = (m.mediaType || '').toLowerCase();
      const _isImage = _mime.startsWith('image') || ['jpg','jpeg','png','gif','webp','svg','avif'].includes(_ext);
      const _isVideo = _mime.startsWith('video') || ['mp4','mov','avi','mkv','webm'].includes(_ext);

      if (_isImage) {
        /* ── Image preview inline ── */
        bubbleContent = `<div class="cfm-media-wrap">
          <a href="${safeUrl}" target="_blank" rel="noopener" class="cfm-img-link">
            <img class="cfm-img-preview" src="${safeUrl}" alt="${fname}" loading="lazy" onload="this.classList.add('loaded')">
          </a>
          ${fsz ? `<div class="cfm-media-meta">${fname} · ${fsz}</div>` : ''}
        </div>`;
      } else if (_isVideo) {
        /* ── Video preview inline ── */
        bubbleContent = `<div class="cfm-media-wrap">
          <video class="cfm-video-preview" src="${safeUrl}" controls playsinline preload="metadata">
            <a href="${safeUrl}" target="_blank" rel="noopener">${fname}</a>
          </video>
          ${fsz ? `<div class="cfm-media-meta">${fname} · ${fsz}</div>` : ''}
        </div>`;
      } else {
        /* ── Other files — name is clickable link ── */
        bubbleContent = `<div class="chat-file-msg">
          <div class="cfm-icon">${getChatFileIcon(m.fileName, m.mediaType)}</div>
          <div class="cfm-info">
            <a class="cfm-name cfm-name--link" href="${safeUrl}" target="_blank" rel="noopener" title="Ochish">${fname}</a>
            ${fsz ? `<div class="cfm-size">${fsz}</div>` : ''}
          </div>
          <a class="cfm-dl" href="${safeUrl}" download="${fname}" target="_blank" title="Yuklab olish">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          </a>
        </div>`;
      }
    } else {
      /* ── Text message ── */
      bubbleContent = `<div class="chat-bubble-text">${renderMarkdown(m.text || '')}</div>`;
    }

    // ID asosida "yangi"lik: shu xabar ID'si ilgari chizilmagan bo'lsagina
    // bounce animatsiyasi beriladi (status/audioUrl kabi maydon
    // yangilanishlari eski xabarlarni qayta "bounce" qilib yubormaydi).
    const isNew = !!m.id && !_seenMsgIds.has(m.id);
    if (m.id) _seenMsgIds.add(m.id);

    // Kun almashgan bo'lsa — Telegram uslubidagi "Bugun"/"Kecha"/sana pill'i
    let dateSep = '';
    const prevMsg = msgs[idx - 1];
    const curDate  = _toDateSafe(m.createdAt);
    const prevDate = prevMsg ? _toDateSafe(prevMsg.createdAt) : null;
    if (curDate && (!prevDate || !_isSameDay(curDate, prevDate))) {
      dateSep = `<div class="chat-date-sep"><span>${_dateSepLabel(m.createdAt)}</span></div>`;
    }

    return `${dateSep}<div class="chat-msg ${mine ? 'mine' : 'theirs'}${isNew ? ' anim-in' : ''}" data-msg-id="${m.id || ''}" style="${isNew ? `animation-delay:${Math.min(idx * 0.04, 0.3)}s` : ''}">
      
      <div class="chat-bubble">
        <div class="chat-bubble-wrap">
          ${bubbleContent}
          <span class="chat-msg-meta">
            <span class="chat-msg-time">${time}</span>
            ${mine ? renderTicks(m.status) : ''}
          </span>
        </div>
      </div>
    </div>`;
  }).join('');

  // Faqat pastda turgan bo'lsak yoki chat yangi ochilgan bo'lsa scroll qilamiz
  if (isAtBottom || isInitialLoad) {
    setTimeout(() => { box.scrollTop = box.scrollHeight; }, 60);
  }

  // "theirs" xabarlaridagi avatar bosilganda profil ochamiz
  box.querySelectorAll('.msg-avi-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      if (!uid || uid === state.me?.uid) return;
      const { openUserProfileModal } = await import('./profile.js');
      openUserProfileModal(uid);
    });
  });

  // Voice xabarlar uchun — haqiqiy waveform balandliklarini fonda yuklaymiz
  _hydrateVoiceWaveforms(box);

  // BUG FIX: paintMessages() har qanday Firestore yozuvida (masalan
  // _attachSecondaryVoice orqali fon rejimida ikkinchi jins ovozi
  // qo'shilganda) butun DOM'ni qayta chizadi. Agar shu paytda audio
  // fonda ijro etilayotgan bo'lsa (_activeAudio), eski <button> DOM
  // elementi yo'q qilinadi va _activeBtn "orfan" obyektga aylanadi —
  // natijada yangi tugma har doim "Play" holatida chiqadi, garchi
  // audio haqiqatan hali ham ijro etilayotgan bo'lsa ham. Shu yerda
  // faol ijro holatini yangi chizilgan DOM ichidan data-url bo'yicha
  // qidirib topilgan tugma/waveform'ga qayta bog'laymiz.
  _reattachActiveVoiceUI(box);
}

/**
 * Agar hozir biror ovozli xabar ijro etilayotgan/pauza holatida bo'lsa
 * (_activeAudio hali mavjud), paintMessages() repaint qilganidan keyin
 * uning UI holatini (tugma ikonkasi, waveform progress, davomiylik) yangi
 * DOM elementlariga qayta bog'laydi. _activeBtn eski (endi DOM'dan
 * o'chirilgan) tugmaga ishora qilib qolmasligi uchun uni ham yangilaymiz.
 */
function _reattachActiveVoiceUI(box) {
  if (!_activeAudio || !_activeBtn) return;

  // Eski tugma hali DOM ichida turibdimi (masalan repaint umuman shu
  // xabarga tegmagan bo'lsa) — bo'lsa hech narsa qilish shart emas.
  if (box.contains(_activeBtn)) return;

  const url = _activeBtn?.closest?.('.chat-voice-msg')?.dataset?.url
    || (_activeAudio.src || '');
  if (!url) return;

  // Xuddi shu audio URL'iga mos yangi chizilgan wrapper'ni topamiz.
  const newWrap = Array.from(box.querySelectorAll('.chat-voice-msg'))
    .find(w => w.dataset.url === url || (w.dataset.url && _activeAudio.src && _activeAudio.src.endsWith(w.dataset.url)));
  if (!newWrap) return;

  const newBtn = newWrap.querySelector('.cvm-play');
  if (!newBtn) return;

  // Holatni (play/pause ikonka) qayta tiklaymiz
  newBtn.innerHTML = _activeAudio.paused ? PLAY_ICON : PAUSE_ICON;

  const bars   = newWrap.querySelectorAll('.cvm-bar');
  const durEl  = newWrap.querySelector('.cvm-dur');
  const waveEl = newWrap.querySelector('.cvm-waveform');
  const total  = parseFloat(newWrap.dataset.dur || '0') || _activeAudio.duration || 0;

  if (!_activeAudio.paused && waveEl) waveEl.classList.add('playing');

  // Progressni joriy audio.currentTime asosida darhol tiklaymiz
  const duration = _activeAudio.duration || total || 1;
  const pct = duration ? (_activeAudio.currentTime / duration) : 0;
  const filled = Math.floor(pct * bars.length);
  bars.forEach((b, i) => b.classList.toggle('played', i < filled));
  if (durEl) durEl.textContent = fmtVoiceDur(_activeAudio.currentTime);

  // Audio event handlerlarini yangi elementlarga qayta ulaymiz, aks holda
  // ular hamon eski (DOM'dan o'chirilgan) tugmani yangilashda davom etadi.
  _activeAudio.onwaiting = () => {
    newBtn.innerHTML = LOADING_ICON;
    newBtn.classList.add('cvm-play--loading');
  };
  _activeAudio.onplaying = () => {
    newBtn.innerHTML = PAUSE_ICON;
    newBtn.classList.remove('cvm-play--loading');
    _syncMiniPlayer();
  };
  _activeAudio.ontimeupdate = () => {
    const dur2 = _activeAudio.duration || total || 1;
    const pct2 = _activeAudio.currentTime / dur2;
    const filled2 = Math.floor(pct2 * bars.length);
    bars.forEach((b, i) => b.classList.toggle('played', i < filled2));
    if (durEl) durEl.textContent = fmtVoiceDur(_activeAudio.currentTime);
    _updateMiniPlayerProgress(pct2);
  };
  _activeAudio.onended = () => {
    if (waveEl) waveEl.classList.remove('playing');
    newBtn.innerHTML = PLAY_ICON;
    bars.forEach(b => b.classList.remove('played'));
    if (durEl) durEl.textContent = fmtVoiceDur(total);
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  };
  const _thisAudio = _activeAudio;
  _activeAudio.onerror = (e) => {
    if (_activeAudio !== _thisAudio) return;
    console.error('Audio xatosi (repaint keyin):', e, 'URL:', url);
    toast('Audio yuklanmadi', 'error');
    newBtn.innerHTML = PLAY_ICON;
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  };

  _activeBtn = newBtn;
}

/* ── Yopish chat thread ───────────────────────────────────────────────── */
export function closeChatThread() {
  if (_threadUnsub) { _threadUnsub(); _threadUnsub = null; }
  if (_peerUserUnsub) { _peerUserUnsub(); _peerUserUnsub = null; }
  if (_peerStatusTick) { clearInterval(_peerStatusTick); _peerStatusTick = null; }
  clearTimeout(_typingTimeout);
  _setTyping(false);
  if (_chatDocUnsub) { _chatDocUnsub(); _chatDocUnsub = null; }
  _iAmTyping = false;
  _peerTyping = false;
  // If in group/channel mode, cleanup group state too
  if (state.currentChatKind && state.currentChatKind !== 'dm') {
    closeGroupThread();
  }
  state.currentChatUid = null;
  state.currentChatId  = null;
  $('chatThreadModal').classList.remove('show');
  // Chat ro'yxatini yangilash — oxirgi xabar/preview yangi bo'lishi uchun
  if (state.view === 'chats') renderChatsList();
  // Ovoz hali ijro etilayotgan bo'lsa — endi bu chat yopilgani uchun
  // mini-pleer bar ko'rinishi kerak (ovozning o'zi to'xtamaydi).
  try { _syncMiniPlayer(); } catch (_) {}
}

/* ── Send message ────────────────────────────────────────────────────── */
export async function sendChatMessage() {
  // Route to group/channel send if in that mode
  if (state.currentChatKind && state.currentChatKind !== 'dm') {
    return sendGroupMessage();
  }
  const inp  = $('chatThreadInput');
  const text = inp?.value?.trim();
  if (!text || !state.currentChatId || !state.me) return;

  const chatId   = state.currentChatId;
  const otherUid = state.currentChatUid;

  inp.value = '';
  updateVoiceSendBtn();
  clearTimeout(_typingTimeout);
  _setTyping(false);

  try {
    const { error } = await sb.from('messages')
      .insert({ chat_id: chatId, sender_id: state.me.uid, type: 'text', text });
    if (error) throw error;
    _reloadThread && _reloadThread();
    // Push bildirishnoma push.js bosqichida ulanadi (Edge Function / DB webhook)
  } catch (err) {
    console.error('❌ sendChatMessage failed:', err.message);
    toast('Xabar yuborilmadi', 'error');
    inp.value = text; // qaytarib qo'yamiz, user qayta yuborishi uchun
    updateVoiceSendBtn();
  }
}

/* ── Helpers for new features ───────────────────────────────────────── */
function fmtVoiceDur(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

function getChatFileIcon(name = '', mime = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const m   = (mime || '').toLowerCase();

  if (m.startsWith('image') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(34,197,94,0.12)"/><rect x="8" y="12" width="32" height="24" rx="4" stroke="#22c55e" stroke-width="2"/><circle cx="17" cy="20" r="3" stroke="#22c55e" stroke-width="1.8"/><path d="M8 30l8-7 7 6 5-4 12 9" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  if (m.startsWith('audio') || ['mp3','wav','ogg','aac','opus','m4a'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(255, 255, 255,0.12)"/><path d="M18 34V18l16-4v16" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="34" r="3" fill="#ffffff"/><circle cx="31" cy="30" r="3" fill="#ffffff"/></svg>`;

  if (m.startsWith('video') || ['mp4','mov','avi','mkv','webm'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(239,68,68,0.12)"/><rect x="6" y="12" width="28" height="24" rx="4" stroke="#ef4444" stroke-width="2"/><path d="M34 18l8-4v20l-8-4V18z" stroke="#ef4444" stroke-width="2" stroke-linejoin="round"/><polygon points="18 19 18 29 26 24" fill="#ef4444"/></svg>`;

  if (ext === 'pdf' || m === 'application/pdf')
    return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(239,68,68,0.12)"/><path d="M13 8h16l8 8v24a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" stroke="#ef4444" stroke-width="2"/><path d="M29 8v8h8" stroke="#ef4444" stroke-width="2"/><text x="24" y="34" text-anchor="middle" font-family="monospace" font-weight="700" font-size="9" fill="#ef4444">PDF</text></svg>`;

  return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(118, 118, 118,0.12)"/><path d="M13 8h16l8 8v24a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" stroke="#a6a6a6" stroke-width="2"/><path d="M29 8v8h8" stroke="#a6a6a6" stroke-width="2"/><line x1="16" y1="24" x2="32" y2="24" stroke="#a6a6a6" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="30" x2="26" y2="30" stroke="#a6a6a6" stroke-width="2" stroke-linecap="round"/></svg>`;
}

/* ── Voice player (global handler for onclick in innerHTML) ─────────── */
let _activeAudio   = null;
let _activeBtn     = null;
let _activeChatId  = null;
let _activeChatUid = null;
let _activeName    = '';

window._chatPlayVoice = function(btn) {
  const wrap = btn.closest('.chat-voice-msg');
  const url  = wrap?.dataset?.url;

  if (!url) {
    console.warn('Voice: URL topilmadi', wrap?.dataset);
    toast('Audio URL topilmadi', 'error');
    return;
  }

  // Bir xil xabar — pause/resume
  if (_activeAudio && _activeBtn === btn) {
    if (_activeAudio.paused) {
      _activeAudio.play().catch(e => { console.error('Resume xatosi:', e); toast('Ijro etilmadi', 'error'); });
      btn.innerHTML = PAUSE_ICON;
    } else {
      _activeAudio.pause();
      btn.innerHTML = PLAY_ICON;
    }
    _syncMiniPlayer();
    return;
  }

  // Boshqa xabar o'ynayotgan bo'lsa — to'xtat
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.onended = null;
    _activeAudio.ontimeupdate = null;
    if (_activeBtn) _activeBtn.innerHTML = PLAY_ICON;
    // Oldingi xabar barlarini reset
    const oldWrap = _activeBtn?.closest('.chat-voice-msg');
    oldWrap?.querySelectorAll('.cvm-bar').forEach(b => b.classList.remove('played'));
  }

  _activeBtn    = btn;
  _activeChatId  = wrap.dataset.chatId || state.currentChatId || null;
  _activeChatUid = wrap.dataset.chatUid || state.currentChatUid || null;
  _activeName   = wrap.dataset.name || 'Ovozli xabar';
  const audio = new Audio(url);
  audio.preload = 'auto';
  _activeAudio = audio;

  const bars      = wrap.querySelectorAll('.cvm-bar');
  const durEl     = wrap.querySelector('.cvm-dur');
  const waveEl    = wrap.querySelector('.cvm-waveform');
  const total     = parseFloat(wrap.dataset.dur || '0') || 0;

  // Fayl hali (masalan sekin tarmoqda) yuklanayotgan bo'lsa — tugmani
  // darhol pauza belgisiga o'tkazmasdan, kichik spinner ko'rsatamiz. Aks
  // holda foydalanuvchi uchun "bosdim-yu hech narsa bo'lmadi, qotib qoldi"
  // taassuroti qoladi, garchi audio aslida orqa fonda yuklanayotgan bo'lsa
  // ham. `waiting` — buferlash paytida, `playing` — ijro haqiqatan
  // boshlanganda chaqiriladi (brauzer standart Audio eventlari).
  btn.innerHTML = LOADING_ICON;
  btn.classList.add('cvm-play--loading');

  audio.onwaiting = () => {
    btn.innerHTML = LOADING_ICON;
    btn.classList.add('cvm-play--loading');
  };
  audio.onplaying = () => {
    btn.innerHTML = PAUSE_ICON;
    btn.classList.remove('cvm-play--loading');
    _syncMiniPlayer();
  };

  if (waveEl) waveEl.classList.add('playing');

  audio.ontimeupdate = () => {
    const duration = audio.duration || total || 1;
    const pct = audio.currentTime / duration;
    const filled = Math.floor(pct * bars.length);
    bars.forEach((b, i) => b.classList.toggle('played', i < filled));
    if (durEl) durEl.textContent = fmtVoiceDur(audio.currentTime);
    _updateMiniPlayerProgress(pct);
  };

  audio.onended = () => {
    if (waveEl) waveEl.classList.remove('playing');
    btn.innerHTML = PLAY_ICON;
    bars.forEach(b => b.classList.remove('played'));
    if (durEl) durEl.textContent = fmtVoiceDur(total);
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  };

  audio.onerror = (e) => {
    // Agar bu audio allaqachon boshqasi bilan almashtirilgan bo'lsa (masalan
    // foydalanuvchi tez orada boshqa xabarni bosgan) — bu "eski" audio
    // xatosi endi hech narsaga ta'sir qilmasligi kerak.
    if (_activeAudio !== audio) return;
    console.error('Audio xatosi:', e, 'URL:', url);
    toast('Audio yuklanmadi', 'error');
    btn.innerHTML = PLAY_ICON;
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  };

  audio.play().catch(e => {
    // AbortError — play() so'rovi darhol keyingi pause()/boshqa xabar
    // bosilishi bilan bekor qilinganda tashlanadi. Bu KUTILGAN holat
    // (foydalanuvchi tez-tez xabarlar orasida almashganda) — xato emas,
    // shuning uchun toast ko'rsatmaymiz.
    if (e?.name === 'AbortError') return;
    if (_activeAudio !== audio) return;
    console.error('Audio play xatosi:', e, 'URL:', url);
    toast('Audio ijro etilmadi', 'error');
    btn.innerHTML = PLAY_ICON;
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  });

  _syncMiniPlayer();
};

/* ── Voice mini-player — foydalanuvchi shu xabarning chatidan chiqib
 * ketsa (boshqa chatga o'tsa yoki thread'ni yopsa) ham, ovoz ijrosi
 * davom etadi (browser Audio elementi DOM'ga bog'liq emas — allaqachon
 * shunday ishlaydi). Bu funksiya faqat KO'RINADIGAN bar'ni — hozir
 * qaysi chat ochiqligiga qarab — ko'rsatish/yashirishni boshqaradi.
 * Telegram/WhatsApp'dagi "ovoz almashtirilgan chatda ham davom etadi"
 * funksiyasiga mos. */
function _isVoiceOwnerChatOpen() {
  const threadOpen = $('chatThreadModal')?.classList.contains('show');
  return !!(threadOpen && state.currentChatId && state.currentChatId === _activeChatId);
}

function _syncMiniPlayer() {
  const bar = $('voiceMiniPlayer');
  if (!bar) return;
  const shouldShow = !!_activeAudio && !_isVoiceOwnerChatOpen();
  if (!shouldShow) { bar.classList.remove('show'); return; }

  bar.classList.add('show');
  const titleEl = $('vmpTitle');
  if (titleEl) titleEl.textContent = _activeName || 'Ovozli xabar';
  const playBtn = $('vmpPlay');
  if (playBtn) playBtn.innerHTML = (_activeAudio && !_activeAudio.paused) ? PAUSE_ICON : PLAY_ICON;
}

function _updateMiniPlayerProgress(pct) {
  const fill = $('vmpFill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
}

$('vmpPlay')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!_activeAudio) return;
  if (_activeAudio.paused) _activeAudio.play().catch(() => {});
  else _activeAudio.pause();
  if (_activeBtn) _activeBtn.innerHTML = _activeAudio.paused ? PLAY_ICON : PAUSE_ICON;
  _syncMiniPlayer();
});

$('vmpClose')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.onended = null;
    _activeAudio.ontimeupdate = null;
    _activeAudio = null;
  }
  if (_activeBtn) { _activeBtn.innerHTML = PLAY_ICON; _activeBtn = null; }
  _activeChatId  = null;
  _activeChatUid = null;
  _syncMiniPlayer();
});

// Bar bosilganda — ovoz chiqayotgan chatga qaytamiz
$('voiceMiniPlayer')?.addEventListener('click', () => {
  if (_activeChatUid) openChatThread(_activeChatUid);
});

const PLAY_ICON  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const PAUSE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
// Fayl hali yuklanayotganda (buferlanmoqda) ko'rsatiladigan aylanuvchi spinner —
// CSS animatsiyasi uchun .cvm-play--loading klassi (CSS/chat.css) bilan birga ishlaydi.
const LOADING_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="cvm-spin"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="42 14"/></svg>`;

/* ── Voice recording (tap-to-toggle) ──────────────────────────────────────
 * Mikrofon tugmasiga BITTA tap = yozish boshlanadi (ushlab turish shart
 * emas). Yozish paytida yana bitta tap = to'xtatadi va darhol yuboradi
 * (bkz. pastdagi 'click' listener). Gapirilayotganda tugma atrofida ovoz
 * balandligiga sezgir, silliq kengayadigan "pulse ring" ko'rinadi
 * (#cvPulse) — AnalyserNode + requestAnimationFrame + lerp. */
let _mediaRec    = null;
let _recChunks   = [];
let _recStartTs  = 0;
let _pulseCtx    = null;
let _pulseAnalyser = null;
let _pulseRaf    = null;
let _pulseLevel  = 0; // joriy (silliqlashtirilgan) ovoz darajasi, 0..1

function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      _recChunks = [];
      _recStartTs = performance.now();

      const MIME_CANDIDATES = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/webm',
      ];
      const chosenMime = MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported?.(m));
      const opts = chosenMime ? { mimeType: chosenMime } : {};

      _mediaRec = new MediaRecorder(stream, opts);
      _mediaRec.ondataavailable = e => {
        if (e.data && e.data.size > 0) _recChunks.push(e.data);
      };
      _mediaRec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const duration = Math.round((performance.now() - _recStartTs) / 1000);
        if (!_recChunks.length) {
          toast('Ovoz yozilmadi, qayta urinib ko\'ring', 'error');
          return;
        }
        const mimeType = _mediaRec.mimeType || chosenMime || 'audio/webm';
        const blob = new Blob(_recChunks, { type: mimeType });
        sendVoiceMessage(blob, duration);
      };
      _mediaRec.start();

      _startPulse(stream);
    })
    .catch(err => {
      console.error('Mikrofon xatosi:', err);
      toast('Mikrofonga ruxsat berilmadi', 'error');
      $('chatVoiceBtn').classList.remove('active');
    });
}

function stopRecording() {
  if (_mediaRec && _mediaRec.state !== 'inactive') _mediaRec.stop();
  _stopPulse();
}

function cancelRecording() {
  if (_mediaRec) {
    _mediaRec.ondataavailable = null;
    _mediaRec.onstop = null;
    if (_mediaRec.state !== 'inactive') {
      _mediaRec.stream?.getTracks().forEach(t => t.stop());
      try { _mediaRec.stop(); } catch(_) {}
    }
    _mediaRec = null;
  }
  _recChunks = [];
  _stopPulse();
}

/* ── Pulse ring: mikrofon tugmasi atrofida, ovoz balandligiga juda
 * sezgir, lerp bilan silliq kengayadigan/torayadigan doira. ── */
function _startPulse(stream) {
  const ring = $('cvPulse');
  if (!ring) return;
  try {
    _pulseCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = _pulseCtx.createMediaStreamSource(stream);
    const analyser = _pulseCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.25; // past — o'ta sezgir
    src.connect(analyser);
    _pulseAnalyser = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const MIN_SCALE = 1, MAX_SCALE = 3.4;
    const MIN_OPAC  = 0.14, MAX_OPAC = 0.55;
    const LERP = 0.5; // kattaroq = tezroq/sezgirroq reaksiya

    const tick = () => {
      if (!_pulseAnalyser) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255; // 0..1
      const target = Math.pow(avg, 0.5); // sqrt — past ovozlarni ham ko'taradi
      _pulseLevel += (target - _pulseLevel) * LERP;

      const scale = MIN_SCALE + _pulseLevel * (MAX_SCALE - MIN_SCALE);
      const opac  = MIN_OPAC + _pulseLevel * (MAX_OPAC - MIN_OPAC);
      ring.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      ring.style.opacity   = opac.toFixed(3);

      _pulseRaf = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) {
    console.warn('Pulse ring ishga tushmadi:', e?.message || e);
  }
}

function _stopPulse() {
  if (_pulseRaf) { cancelAnimationFrame(_pulseRaf); _pulseRaf = null; }
  if (_pulseCtx) { try { _pulseCtx.close(); } catch(_) {} _pulseCtx = null; }
  _pulseAnalyser = null;
  _pulseLevel = 0;
  const ring = $('cvPulse');
  if (ring) {
    ring.style.transform = 'translate(-50%, -50%) scale(1)';
    ring.style.opacity = '0';
  }
}

async function sendVoiceMessage(blob, duration) {
  if (!state.currentChatId || !state.me) return;
  const chatId   = state.currentChatId;
  const otherUid = state.currentChatUid;

  // Pending message — loading bubble ko'rsatish
  const pendingId = 'pending_voice_' + Date.now();
  _showPendingBubble(pendingId, 'voice', blob.size);

  try {
    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type });

    const result = await uploadViaControllerProgress(file, 'chat-voice', pct => {
      _updatePendingProgress(pendingId, pct);
    });

    _removePendingBubble(pendingId);

    const { error } = await sb.from('messages').insert({
      chat_id: chatId, sender_id: state.me.uid, type: 'voice',
      media_path: result.path, media_type: blob.type || null,
      duration: Math.round(duration || 0),
    });
    if (error) throw error;
    _reloadThread && _reloadThread();

  } catch (err) {
    console.error('Voice send failed:', err);
    _removePendingBubble(pendingId);
    toast('Ovozli xabar yuborilmadi', 'error');
  }
}

/* ── Chat file attach ──────────────────────────────────────────────────── */
function setChatFile(file) {
  _chatSelFile = file;
  $('cfpIcon').innerHTML = getChatFileIcon(file.name, file.type);
  $('cfpName').textContent = file.name.length > 36 ? file.name.slice(0, 34) + '…' : file.name;
  $('cfpSize').textContent = fmtSz(file.size);
  $('chatFilePreview').classList.add('active');
  updateVoiceSendBtn();
}

function clearChatFile() {
  _chatSelFile = null;
  $('chatFilePreview').classList.remove('active');
  $('chatFileInput').value = '';
  updateVoiceSendBtn();
}

export function updateVoiceSendBtn() {
  const inp  = $('chatThreadInput');
  const hasText = inp?.value?.trim().length > 0;
  const hasFile = !!_chatSelFile;
  const showSend = hasText || hasFile;
  const mic  = $('chatVoiceBtn').querySelector('.icon-mic');
  const send = $('chatVoiceBtn').querySelector('.icon-send');
  if (mic)  mic.style.display  = showSend ? 'none'  : '';
  if (send) send.style.display = showSend ? ''      : 'none';
}

async function sendChatFile() {
  if (!_chatSelFile || !state.me) return;
  // Route to group file send if in group mode
  if (state.currentChatKind && state.currentChatKind !== 'dm') {
    const file = _chatSelFile;
    clearChatFile();
    return sendGroupFile(file);
  }
  if (!state.currentChatId) return;
  const chatId   = state.currentChatId;
  const otherUid = state.currentChatUid;
  const file = _chatSelFile;

  clearChatFile();

  const pendingId = 'pending_file_' + Date.now();
  _showPendingBubble(pendingId, 'file', file.size, file.name, file.type);

  try {
    const result = await uploadViaControllerProgress(file, 'chat-files', pct => {
      _updatePendingProgress(pendingId, pct);
    });

    _removePendingBubble(pendingId);

    const { error } = await sb.from('messages').insert({
      chat_id: chatId, sender_id: state.me.uid, type: 'file',
      media_path: result.path, media_type: file.type || null,
      file_name: file.name, file_size: file.size,
    });
    if (error) throw error;
    _reloadThread && _reloadThread();

  } catch (err) {
    console.error('File send failed:', err);
    _removePendingBubble(pendingId);
    toast('Fayl yuborilmadi', 'error');
  }
}


/* ── Pending bubble (upload progress) ───────────────────────────────── */
function _showPendingBubble(id, type, size, name = '', mime = '') {
  const box = $('chatThreadMessages');
  if (!box) return;
  const szTxt = size ? fmtSz(size) : '';
  const isVoice = type === 'voice';
  const inner = isVoice
    ? `<div class="cpb-voice">
        <div class="cpb-mic-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" fill="none" stroke-width="2"/></svg>
        </div>
        <div class="cpb-info">
          <div class="cpb-label">Ovoz yuborilmoqda...</div>
          ${szTxt ? `<div class="cpb-size">${szTxt}</div>` : ''}
        </div>
      </div>`
    : `<div class="cpb-file">
        <div class="cpb-file-icon">${getChatFileIcon(name, mime)}</div>
        <div class="cpb-info">
          <div class="cpb-label">${esc(name || 'Fayl')}</div>
          ${szTxt ? `<div class="cpb-size">${szTxt}</div>` : ''}
        </div>
      </div>`;

  const el = document.createElement('div');
  el.className = 'chat-msg mine cpb-wrap';
  el.id = id;
  el.innerHTML = `<div class="chat-bubble cpb-bubble">
    <div class="chat-bubble-wrap">
      ${inner}
      <div class="cpb-progress-bar"><div class="cpb-progress-fill" id="${id}_fill"></div></div>
      <div class="cpb-pct" id="${id}_pct">0%</div>
    </div>
  </div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function _updatePendingProgress(id, pct) {
  const fill = document.getElementById(id + '_fill');
  const lbl  = document.getElementById(id + '_pct');
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent  = Math.round(pct) + '%';
}

function _removePendingBubble(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/* ── XHR upload with progress (Supabase direct upload) ─────────────── */
async function uploadViaControllerProgress(file, folder, onProgress) {
  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token || !state.me) throw new Error('Tizimga kirilmagan');

  const safeName = file.name.replace(/[^\w.\-]/g, '_').replace(/_+/g, '_');
  const path = `${state.me.uid}/${folder}/${Date.now()}_${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))}_${safeName}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
    };
    // Progress ishlamasa/xato bo'lsa — oddiy yuklashga o'tamiz (haqiqiy xato shu yerda chiqadi)
    const fallback = () => uploadViaController(file, folder)
      .then(res => { if (onProgress) onProgress(100); resolve(res); })
      .catch(reject);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve({ path, url: mediaPublicUrl(path) });
      } else fallback();
    };
    xhr.onerror = fallback;
    xhr.send(file);
  });
}

/* ── Wire static DOM (modal already exists in index.html on page load) ── */
$('chatThreadBack').onclick = closeChatThread;
$('chatThreadModal').addEventListener('click', e => {
  if (e.target === $('chatThreadModal')) closeChatThread();
});

// Groups DOM injection + "+" button
injectGroupsDOM();
state.currentChatKind = state.currentChatKind || 'dm';

const _chatsAddBtn = $('chatsAddBtn');
if (_chatsAddBtn) _chatsAddBtn.addEventListener('click', openCreateChoice);

// Input text changes — toggle mic/send icon + "yozmoqda..." holatini yuborish
$('chatThreadInput').addEventListener('input', updateVoiceSendBtn);
$('chatThreadInput').addEventListener('input', _onChatInputTyping);
$('chatThreadInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAction(); }
});

/* ── Composer emoji tugmasi — matn maydoni ichida chapda (Telegram
 * uslubi). Kompakt quick-picker: keng tarqalgan emojilardan iborat
 * ro'yxat, bosilganda kursor turgan joyga qo'shiladi. ── */
const CHAT_QUICK_EMOJIS = [
  '😀','😂','🥰','😍','😊','🙂','😉','😎','🤔','😴',
  '😭','😢','😡','🥳','😱','🤗','🙄','😅','🤝','👍',
  '👎','👏','🙏','💪','🔥','✨','🎉','❤️','💔','💯',
  '👌','✅','❌','⭐','☺️','😇','🤣','😘','😜','🤷',
];
(function _initChatEmojiQuickpick() {
  const btn  = $('chatEmojiBtn');
  const pop  = $('chatEmojiQuickpick');
  const inp  = $('chatThreadInput');
  if (!btn || !pop || !inp) return;

  if (!pop.childElementCount) {
    pop.innerHTML = CHAT_QUICK_EMOJIS
      .map(em => `<button type="button">${em}</button>`)
      .join('');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.classList.toggle('show');
  });

  pop.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const emoji = b.textContent;
    const start = inp.selectionStart ?? inp.value.length;
    const end   = inp.selectionEnd ?? inp.value.length;
    inp.value = inp.value.slice(0, start) + emoji + inp.value.slice(end);
    const caret = start + emoji.length;
    inp.focus();
    inp.setSelectionRange(caret, caret);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });

  document.addEventListener('click', (e) => {
    if (!pop.classList.contains('show')) return;
    if (e.target === btn || pop.contains(e.target)) return;
    pop.classList.remove('show');
  });
})();

// Mikrofon/yuborish tugmasi — bitta tugma, uch xil holat:
//  1) Matn/fayl bor bo'lsa — tap = yuborish.
//  2) Matn/fayl yo'q va hozir yozilmayotgan bo'lsa — tap = yozishni boshlash
//     (ushlab turish SHART EMAS).
//  3) Yozish paytida yana bir tap = to'xtatish va darhol yuborish.
$('chatVoiceBtn').addEventListener('click', () => {
  const btn = $('chatVoiceBtn');
  const hasText = $('chatThreadInput').value.trim().length > 0;
  const hasFile = !!_chatSelFile;

  if (hasText || hasFile) { handleSendAction(); return; }

  if (btn.classList.contains('active')) {
    // Ikkinchi tap — yozishni to'xtatish va yuborish
    btn.classList.remove('active');
    stopRecording();
  } else {
    // Birinchi tap — yozishni boshlash
    btn.classList.add('active');
    startRecording();
  }
});


// File attach
$('chatAttachBtn')?.addEventListener('click', () => $('chatFileInput')?.click());
$('chatFileInput')?.addEventListener('change', e => {
  const f = e.target.files?.[0];
  if (f) setChatFile(f);
});
$('cfpRemove')?.addEventListener('click', clearChatFile);

async function handleSendAction() {
  if (_chatSelFile) {
    await sendChatFile();
    // If there's also text, send it after
    const text = $('chatThreadInput').value.trim();
    if (text) await sendChatMessage();
  } else {
    await sendChatMessage();
  }
}

/* ── destroyChatsView: chat viewdan chiqqanda cleanup ─────────────────── */
export function destroyChatsView() {
  // Thread listener'ni to'xtatish
  if (_threadUnsub) { _threadUnsub(); _threadUnsub = null; }
  // Thread modal'ni yopish
  try { closeChatThread(); } catch (_) {}
  // chatsWatcher'ni to'xtatmaymiz — u background notification uchun kerak
  // (auth.js stopChatsWatcher logout paytida chaqiradi)
}

/* ── Chat thread header: avi/nom bosilganda profil ochish ────────────── */
// DM uchun: user profil modali
// Guruh/Kanal uchun: guruh info overlay
(function() {
  const aviEl  = document.getElementById('chatThreadAvi');
  const nameEl = document.getElementById('chatThreadName');

  async function openCurrentProfile() {
    const kind = state.currentChatKind || 'dm';
    if (kind === 'dm') {
      const uid = state.currentChatUid;
      if (!uid) return;
      const { openUserProfileModal } = await import('./profile.js');
      openUserProfileModal(uid);
    } else {
      // guruh yoki kanal — group info overlay
      const { openGroupInfo } = await import('./groups.js');
      if (state.currentChatId || window._currentGroupId) {
        // currentGroupId groups.js ichida — openGroupThread da o'rnatiladi
        const gid = document.getElementById('chatThreadModal')?.dataset?.gid
          || window._currentGroupId;
        if (gid) openGroupInfo(gid);
      }
    }
  }

  if (aviEl)  aviEl.style.cursor  = 'pointer';
  if (nameEl) nameEl.style.cursor = 'pointer';
  if (aviEl)  aviEl.addEventListener('click',  openCurrentProfile);
  if (nameEl) nameEl.addEventListener('click', openCurrentProfile);
})();
