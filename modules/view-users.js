/**
 * MRgram — Admin Foydalanuvchilar Panel
 * Faqat admin (profiles.is_admin) uchun
 */

import { sb, state, isAdmin, fetchAllRows, mapProfile, purgeUserMedia } from './config.js';
import { $, esc as _esc } from './utils.js';
import { toast } from './toast.js';
import { adminResetPassword } from './admin-reset-password.js';

async function _updateProfile(uid, patch) {
  const { error } = await sb.from('profiles').update(patch).eq('id', uid);
  if (error) throw error;
}

// Cache invalidation + feed refresh helper
async function _invalidateAndRefreshFeed(uid) {
  try {
    // User cache ni tozalaymiz
    if (state._userCache && uid) delete state._userCache[uid];
    // Feed ni qayta render qilamiz (agar home view da bo'lsa)
    if (state.view === 'home') {
      const { renderFeed } = await import('./feed.js');
      renderFeed();
    }
    // Suhbatlar (kontaktlar) ro'yxati keshini ham bekor qilamiz — aks holda
    // o'chirilgan/bloklangan user "Yangi suhbat boshlash" ro'yxatida hali
    // ham ko'rinib turadi (5 daqiqagacha eski keshdan o'qilardi).
    const { invalidateChatsUsersCache } = await import('./chat.js');
    await invalidateChatsUsersCache();
  } catch (e) { console.warn('[view-users]', e?.message || e); }
}

let _unsubUsers = null;
let _initialized = false;

let _lastUsers = [];
let _searchQuery = '';
let _statusFilter = 'all';

/* ── Modal state ────────────────────────────────────────────────────── */
let _pendingAction = null; // { type: 'delete'|'block'|'unblock', uid, name }
let _blockDurH = null;   // tanlangan blok muddati (soat; 0 = doimiy)

/* ── initView ───────────────────────────────────────────────────────── */
export function initView() {
  if (!isAdmin()) {
    const wrap = $('usersAdminList');
    if (wrap) wrap.innerHTML = '<p style="padding:24px;color:var(--text2)">Ruxsat yo\'q.</p>';
    return;
  }
  _ensureModal();
  _ensureSearchFilter();
  // Har doim yangi onSnapshot ulaymiz — destroyView() uni to'xtatgan bo'lishi mumkin
  _initialized = true;
  _loadUsers();
}

/* ── Qidiruv va status filtri ──────────────────────────────────────── */
function _ensureSearchFilter() {
  const searchEl = $('uaSearchInput');
  const filterEl = $('uaStatusFilter');
  if (!searchEl || !filterEl) return;

  // Panelga har safar kirishda qidiruv/filtr tozalanadi
  searchEl.value = '';
  filterEl.value = 'all';
  _searchQuery = '';
  _statusFilter = 'all';

  if (!searchEl.dataset.wired) {
    searchEl.dataset.wired = '1';
    let debounceT = null;
    searchEl.addEventListener('input', () => {
      clearTimeout(debounceT);
      debounceT = setTimeout(() => {
        _searchQuery = searchEl.value;
        _renderList();
      }, 150);
    });
  }
  if (!filterEl.dataset.wired) {
    filterEl.dataset.wired = '1';
    filterEl.addEventListener('change', () => {
      _statusFilter = filterEl.value;
      _renderList();
    });
  }
}

/* ── Filtrlangan ro'yxatni hisoblash ──────────────────────────────── */
function _applyFilters(users) {
  let out = users;

  if (_statusFilter === 'pending') {
    out = out.filter(u => u.approved === false && !u.blocked);
  } else if (_statusFilter === 'approved') {
    out = out.filter(u => u.approved === true && !u.blocked);
  } else if (_statusFilter === 'blocked') {
    out = out.filter(u => u.blocked === true);
  } else if (_statusFilter === 'rejected') {
    out = out.filter(u => u.approved === 'rejected');
  }

  const q = _searchQuery.trim().toLowerCase();
  if (q) {
    out = out.filter(u => {
      const name  = (u.fullName  || '').toLowerCase();
      const uname = (u.username  || '').toLowerCase();
      const email = (u.email     || '').toLowerCase();
      const uid   = (u.uid || u.id || '').toLowerCase();
      return name.includes(q) || uname.includes(q) || email.includes(q) || uid.includes(q);
    });
  }

  return out;
}

/* ── Ro'yxatni (mini-pending + asosiy) qayta chizish ──────────────── */
function _renderList() {
  const wrap = $('usersAdminList');
  if (!wrap) return;
  _renderPendingMini(_lastUsers);
  const filtered = _applyFilters(_lastUsers);
  if ((_searchQuery.trim() || _statusFilter !== 'all') && !filtered.length) {
    wrap.innerHTML = '<p style="padding:24px;color:var(--text2)">Mos foydalanuvchi topilmadi.</p>';
    return;
  }
  _render(wrap, filtered);
}

/* ── Yagona modal (delete + block uchun) ────────────────────────────── */
function _ensureModal() {
  if ($('uaActionModal')) return;

  const modal = document.createElement('div');
  modal.id = 'uaActionModal';
  modal.className = 'ua-modal-overlay';
  modal.innerHTML = `
    <div class="ua-modal">
      <div class="ua-modal-icon" id="uaModalIcon"></div>
      <div class="ua-modal-title" id="uaModalTitle"></div>
      <div class="ua-modal-body" id="uaModalBody"></div>
      <div class="ua-modal-btns">
        <button class="ua-modal-cancel" id="uaModalCancel">Bekor qilish</button>
        <button class="ua-modal-confirm" id="uaModalConfirm">
          <span id="uaModalConfirmTxt"></span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  $('uaModalCancel').addEventListener('click', _closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) _closeModal(); });
  $('uaModalConfirm').addEventListener('click', _confirmAction);
}

function _openDeleteModal(uid, name) {
  _pendingAction = { type: 'delete', uid, name };
  $('uaModalIcon').innerHTML     = _svgTrash();
  $('uaModalTitle').textContent  = "O'chiramizmi?";
  $('uaModalBody').innerHTML     = `<strong>${_esc(name)}</strong> ni ro'yxatdan butunlay o'chirasizmi?<br>
    <span class="ua-modal-warn">Diqqat, buni qaytarib bo'lmaydi!</span>`;
  $('uaModalConfirmTxt').textContent = "O'chirish";
  $('uaModalConfirm').className  = 'ua-modal-confirm ua-modal-confirm--danger';
  $('uaModalConfirm').disabled   = false;
  $('uaActionModal').classList.add('show');
}

function _openBlockModal(uid, name, isBlocked) {
  _pendingAction = { type: isBlocked ? 'unblock' : 'block', uid, name };
  if (isBlocked) {
    $('uaModalIcon').innerHTML    = _svgUnlock();
    $('uaModalTitle').textContent  = "Blokdan chiqaramizmi?";
    $('uaModalBody').innerHTML     = `<strong>${_esc(name)}</strong> ga qayta kirish ruxsati berilsinmi?`;
    $('uaModalConfirmTxt').textContent = "Blokdan chiqarish";
    $('uaModalConfirm').className  = 'ua-modal-confirm ua-modal-confirm--safe';
    // Vaqt inputini yashiramiz
    const tw = document.getElementById('uaBlockUntilWrap');
    if (tw) tw.style.display = 'none';
  } else {
    $('uaModalIcon').innerHTML    = _svgLock();
    $('uaModalTitle').textContent  = "Bloklaymizmi?";

    $('uaModalBody').innerHTML = `<strong>${_esc(name)}</strong> ni qanchalik bloklaysizmi?` +
      `<div id="uaBlockUntilWrap" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
         <button class="ua-dur-btn" data-h="1"   style="flex:1">1 soat</button>
         <button class="ua-dur-btn" data-h="24"  style="flex:1">1 kun</button>
         <button class="ua-dur-btn" data-h="168" style="flex:1">7 kun</button>
         <button class="ua-dur-btn ua-dur-btn--perm" data-h="0" style="flex:1">Doimiy</button>
       </div>`;
    _blockDurH = null;
    document.querySelectorAll('.ua-dur-btn').forEach(b => {
      b.addEventListener('click', () => {
        _blockDurH = Number(b.dataset.h);
        document.querySelectorAll('.ua-dur-btn').forEach(x => x.classList.remove('ua-dur-btn--on'));
        b.classList.add('ua-dur-btn--on');
      });
    });
    $('uaModalConfirmTxt').textContent = "Bloklash";
    $('uaModalConfirm').className  = 'ua-modal-confirm ua-modal-confirm--warn';
  }
  $('uaModalConfirm').disabled = false;
  $('uaActionModal').classList.add('show');
}

function _closeModal() {
  _pendingAction = null;
  const modal = $('uaActionModal');
  if (modal) modal.classList.remove('show');
}

async function _confirmAction() {
  if (!_pendingAction) return;
  const { type, uid, name } = _pendingAction;

  const confirmBtn = $('uaModalConfirm');
  const confirmTxt = $('uaModalConfirmTxt');
  confirmBtn.disabled = true;
  confirmTxt.textContent = '...';

  try {
    if (type === 'delete') {
      await purgeUserMedia(uid);
      const { error: delErr } = await sb.rpc('admin_delete_user', { p_uid: uid });
      if (delErr) throw delErr;
      toast(`${name} butunlay o'chirildi`, 'success');
      await _invalidateAndRefreshFeed(uid);

    } else if (type === 'block') {
      // DIET F2: ms-aniq picker o'rniga 4 tugma (1 soat / 1 kun / 7 kun / doimiy)
      let untilDate = null;
      if (_blockDurH !== null && _blockDurH > 0) untilDate = new Date(Date.now() + _blockDurH * 3600 * 1000);
      await _updateProfile(uid, {
        blocked: true,
        approval: 'pending',
        blocked_until: untilDate ? untilDate.toISOString() : null,
      });
      const untilMsg = untilDate ? ` (${untilDate.toLocaleString('uz-UZ')} gacha)` : ' (doimiy)';
      toast(`${name} bloklandi${untilMsg}`, 'info');
      await _invalidateAndRefreshFeed(uid);

    } else if (type === 'unblock') {
      await _updateProfile(uid, { blocked: false, blocked_until: null, approval: 'approved' });
      toast(`${name} blokdan chiqarildi `, 'success');
      await _invalidateAndRefreshFeed(uid);
    }
    _closeModal();
  } catch (err) {
    console.error('❌ Action error:', err);
    toast('Xatolik: ' + err.message, 'error');
    confirmBtn.disabled = false;
    confirmTxt.textContent = type === 'delete' ? "O'chirish" : type === 'block' ? 'Bloklash' : 'Blokdan chiqarish';
  }
}

/* ── Foydalanuvchilar ro'yxati (Supabase + realtime) ─────────────────── */
function _loadUsers() {
  const wrap = $('usersAdminList');
  if (!wrap) return;

  wrap.innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
  if (_unsubUsers) { _unsubUsers(); _unsubUsers = null; }

  let dead = false, timer = null;
  const load = async () => {
    try {
      const rows = await fetchAllRows('profiles', '*', 'created_at'); // yangi → eski
      if (dead) return;
      _lastUsers = rows.map(mapProfile).filter(u => u.id !== state.me?.uid);
      _renderList();
    } catch (err) {
      if (dead) return;
      wrap.innerHTML = `<p style="padding:24px;color:var(--red)">Xatolik: ${err.message}</p>`;
    }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(load, 300); };
  const ch = sb.channel('admin-users-list')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, schedule)
    .subscribe();
  _unsubUsers = () => { dead = true; clearTimeout(timer); sb.removeChannel(ch); };
  load();
}

/* ── Foydalanuvchi bo'yicha "USER MALUMOTLARI" panel (3 tab) ──────────
 * Tablar: Ochiq malumotlar / Statuslar va yopiq malumotlar / Tarixlar.
 * Suhbatlar bo'limida faqat metama'lumot (oxirgi xabar preview'i) —
 * to'liq yozishma tarixi emas. ────────────────────────────────────── */
let _detailUid = null;

function _ensureDetailModal() {
  if ($('uaDetailModal')) return;
  const modal = document.createElement('div');
  modal.id = 'uaDetailModal';
  modal.className = 'ua-modal-overlay';
  modal.innerHTML = `
    <div class="ua-modal ua-detail-modal">
      <div class="ua-detail-head">
        <div class="ua-modal-title" style="margin:0">User malumotlari</div>
        <div class="ua-detail-avi" id="uaDetailAvi"></div>
      </div>
      <div class="ua-detail-body" id="uaDetailBody"></div>
      <div class="ua-modal-btns">
        <button class="ua-modal-cancel" id="uaDetailClose">Yopish</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  $('uaDetailClose').addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });

}

function _openDetailModal(uid, name) {
  _detailUid = uid;
  const u = _lastUsers.find(x => (x.uid || x.id) === uid) || {};
  const initials = (name || 'U').trim()[0]?.toUpperCase() || 'U';
  $('uaDetailAvi').innerHTML = u.avatar
    ? `<img src="${u.avatar}" alt="">`
    : initials;
  $('uaDetailModal').classList.add('show');
  _renderDetailBody();
}

function _renderDetailBody() {
  const body = $('uaDetailBody');
  if (!body || !_detailUid) return;

  const u = _lastUsers.find(x => (x.uid || x.id) === _detailUid) || {};
  const row = (label, value) => `
    <div class="ua-field-row">
      <span class="ua-field-label">${_esc(label)}</span>
      <span class="ua-field-value">${value || '—'}</span>
    </div>`;
  const fmt = (v) => v?.toDate ? v.toDate().toLocaleString('uz-UZ') : '';

  /* DIET F2: 3 tab + post/chat tarixi o'rniga bitta kartochka */
  body.innerHTML =
    row('Ism', _esc(u.fullName || '')) +
    row('Foydalanuvchi nomi', u.username ? '@' + _esc(u.username) : '') +
    row('Elektron pochta', u.email ? _esc(u.email) : '') +
    row('Holat', _statusBadge(u)) +
    row('Bio', u.bio ? _esc(u.bio) : '') +
    row('Ro\'yxatdan', fmt(u.createdAt)) +
    row('Oxirgi faollik', fmt(u.lastSeenAt) || fmt(u.lastLoginAt));
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function _statusBadge(user) {
  if (user.blocked === true)
    return `<span class="ua-badge ua-badge--blocked">Bloklangan</span>`;
  const a = user.approved;
  if (a === true)       return `<span class="ua-badge ua-badge--approved">Ruxsat berilgan</span>`;
  if (a === false)      return `<span class="ua-badge ua-badge--pending">Kutilmoqda</span>`;
  if (a === 'rejected') return `<span class="ua-badge ua-badge--rejected">Rad etilgan</span>`;
  return `<span class="ua-badge ua-badge--legacy">Eski foydalanuvchi</span>`;
}

function _approveBtn(user) {
  if (user.blocked) return '';
  const a = user.approved;
  if (a === true || a === undefined) return '';
  return `<button class="ua-approve-btn" data-uid="${user.uid||user.id}">Ruxsat berish</button>`;
}

function _rejectBtn(user) {
  if (user.blocked) return '';
  const a = user.approved;
  if (a === 'rejected' || a === true || a === undefined) return '';
  return `<button class="ua-reject-btn" data-uid="${user.uid||user.id}">Rad etish</button>`;
}

/* ── Approve/Reject — asosiy ro'yxat va "Kutayotganlar" mini-bo'limi
 * ikkalasi tomonidan ham ishlatiladigan umumiy funksiyalar ── */
async function _doApprove(btn, uid, name) {
  btn.disabled = true; btn.textContent = '...';
  try {
    await _updateProfile(uid, { approval: 'approved' });
    toast('Ruxsat berildi ', 'success');
    await _invalidateAndRefreshFeed(uid);
  } catch (err) {
    toast('Xatolik: ' + err.message, 'error');
    btn.disabled = false; btn.textContent = 'Ruxsat berish';
  }
}

async function _doReject(btn, uid, name) {
  btn.disabled = true; btn.textContent = '...';
  try {
    await _updateProfile(uid, { approval: 'rejected' });
    toast('Rad etildi', 'info');
    await _invalidateAndRefreshFeed(uid);
  } catch (err) {
    toast('Xatolik: ' + err.message, 'error');
    btn.disabled = false; btn.textContent = 'Rad etish';
  }
}

/* ── "Kutayotgan foydalanuvchilar" tezkor mini-bo'lim ──
 * actionsView boshida — scroll qilmasdan tasdiqlash/rad etish uchun.
 ── */
function _ensurePendingMiniCSS() {
  if (document.getElementById('pending-mini-css')) return;
  const s = document.createElement('style');
  s.id = 'pending-mini-css';
  s.textContent = `
.pmini-wrap { margin: 0 16px 8px; display: flex; flex-direction: column; gap: 8px; }
.pmini-empty {
  background: var(--bg2); border: 1px solid var(--line); border-radius: 14px;
  padding: 16px; text-align: center; color: var(--text3); font-size: 13px;
}
.pmini-locked {
  background: var(--bg2); border: 1px solid var(--line); border-radius: 14px;
  padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;
  gap: 10px; cursor: pointer;
}
.pmini-locked-count { font-size: 13px; font-weight: 700; color: var(--text); }
.pmini-locked-hint { font-size: 12px; color: var(--blue,#ffffff); font-weight: 600; white-space: nowrap; }
.pmini-card {
  background: var(--bg2); border: 1px solid var(--line); border-radius: 12px;
  padding: 12px; display: flex; align-items: center; gap: 10px;
}
.pmini-avi { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: var(--bg3); }
.pmini-avi-placeholder {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  background: var(--bg3); color: var(--text2); display: flex; align-items: center;
  justify-content: center; font-weight: 700; font-size: 15px;
}
.pmini-info { flex: 1; min-width: 0; }
.pmini-name { font-size: 13px; font-weight: 700; color: var(--text); }
.pmini-sub { font-size: 11.5px; color: var(--text3); margin-top: 1px; }
.pmini-actions { display: flex; gap: 6px; flex-shrink: 0; }
.pmini-approve-btn, .pmini-reject-btn {
  border: none; border-radius: 8px; font-family: var(--font); font-size: 12px; font-weight: 600;
  padding: 7px 11px; cursor: pointer; transition: opacity 0.15s; white-space: nowrap;
}
.pmini-approve-btn { background: var(--green,#22c55e); color: #fff; }
.pmini-reject-btn { background: color-mix(in srgb, var(--red,#ef4444) 15%, transparent); color: var(--red,#ef4444); }
.pmini-approve-btn:disabled, .pmini-reject-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;
  document.head.appendChild(s);
}

function _renderPendingMini(users) {
  const section = document.getElementById('actionsPendingSection');
  if (!section) return;
  _ensurePendingMiniCSS();

  const pending = (users || []).filter(u => u.approved === false && !u.blocked);

  if (!pending.length) {
    section.innerHTML = `<div class="pmini-wrap"><div class="pmini-empty">Kutayotgan foydalanuvchilar yo'q</div></div>`;
    return;
  }

  section.innerHTML = `<div class="pmini-wrap">${pending.map(u => {
    const uid  = u.uid || u.id;
    const name = u.fullName || u.username || uid;
    const uname = u.username ? `@${u.username}` : (u.email || '');
    const created = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleString('uz-UZ') : '';
    return `
      <div class="pmini-card" data-uid="${uid}">
        <div class="pmini-info">
          <div class="pmini-name">${_esc(name)}</div>
          <div class="pmini-sub">${_esc(uname)}${created ? ' · ' + created : ''}</div>
        </div>
        <div class="pmini-actions">
          <button class="pmini-approve-btn" data-uid="${uid}" data-name="${_esc(name)}">Tasdiqlash</button>
          <button class="pmini-reject-btn" data-uid="${uid}" data-name="${_esc(name)}">Rad etish</button>
        </div>
      </div>`;
  }).join('')}</div>`;

  section.querySelectorAll('.pmini-approve-btn').forEach(btn => {
    btn.addEventListener('click', () => _doApprove(btn, btn.dataset.uid, btn.dataset.name));
  });
  section.querySelectorAll('.pmini-reject-btn').forEach(btn => {
    btn.addEventListener('click', () => _doReject(btn, btn.dataset.uid, btn.dataset.name));
  });
}

/* ── Render ─────────────────────────────────────────────────────────── */
function _render(wrap, users) {
  if (!users.length) {
    wrap.innerHTML = '<p style="padding:24px;color:var(--text2)">Foydalanuvchilar yo\'q.</p>';
    return;
  }

  wrap.innerHTML = users.map(u => {
    const name      = u.fullName || u.username || u.uid || u.id;
    const uname     = u.username ? `@${u.username}` : '';
    const uid       = u.uid || u.id;
    const isBlocked = u.blocked === true;
    const created   = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('uz-UZ') : '';
    const blockedUntil = u.blockedUntil?.toDate ? u.blockedUntil.toDate().toLocaleString('uz-UZ') : '';
    const blockBtnLabel = isBlocked ? 'Blokdan chiqarish' : 'Bloklash';
    const blockBtnClass = isBlocked ? 'ua-unblock-btn' : 'ua-block-btn';
    const blockedUntilMs = u.blockedUntil?.toMillis ? u.blockedUntil.toMillis() : (u.blockedUntil ? Number(u.blockedUntil) : 0);

    return `
    <div class="ua-row${isBlocked ? ' ua-row--blocked' : ''}" data-uid="${uid}">
      <div class="ua-info">
        <span class="ua-name">${_esc(name)}</span>
        ${uname ? `<span class="ua-uname">${_esc(uname)}</span>` : ''}
        <span class="ua-date">${created}${blockedUntil ? ' · blok tugashi: ' + blockedUntil : ''}</span>
      </div>
      <div class="ua-status">${_statusBadge(u)}</div>
      <div class="ua-actions">
        ${_approveBtn(u)}
        ${_rejectBtn(u)}
        <button class="ua-history-btn" data-uid="${uid}" data-name="${_esc(name)}">Ma'lumot</button>
        <button class="ua-resetpwd-btn" data-uid="${uid}" data-name="${_esc(name)}">Parolni almashtirish</button>
        <button class="${blockBtnClass}" data-uid="${uid}" data-name="${_esc(name)}" data-blocked="${isBlocked}" data-blocked-until-ms="${blockedUntilMs}">${blockBtnLabel}</button>
        <button class="ua-delete-btn" data-uid="${uid}" data-name="${_esc(name)}">O'chirish</button>
      </div>
    </div>`;
  }).join('');

  /* Approve */
  wrap.querySelectorAll('.ua-approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const u = users.find(x => (x.uid || x.id) === uid);
      await _doApprove(btn, uid, u?.fullName || u?.username || uid);
    });
  });

  /* Reject */
  wrap.querySelectorAll('.ua-reject-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      const u = users.find(x => (x.uid || x.id) === uid);
      await _doReject(btn, uid, u?.fullName || u?.username || uid);
    });
  });

  /* Block / Unblock */
  wrap.querySelectorAll('.ua-block-btn, .ua-unblock-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isBlocked = btn.dataset.blocked === 'true';
      _openBlockModal(btn.dataset.uid, btn.dataset.name, isBlocked);
    });
  });

  /* Parolni almashtirish (DIET F2 — admin parol reset) */
  wrap.querySelectorAll('.ua-resetpwd-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      adminResetPassword(btn.dataset.uid, btn.dataset.name);
    });
  });

  /* User kartochkasi */
  wrap.querySelectorAll('.ua-history-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _ensureDetailModal();
      _openDetailModal(btn.dataset.uid, btn.dataset.name);
    });
  });

  /* Delete */
  wrap.querySelectorAll('.ua-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _openDeleteModal(btn.dataset.uid, btn.dataset.name);
    });
  });
}

function _svgTrash() {
  return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--red)">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>`;
}
function _svgLock() {
  return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--amber)">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>`;
}
function _svgUnlock() {
  return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--green)">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>`;
}
function _svgKey() {
  return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--blue)">
    <circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3"/><path d="M19 4l1.5 1.5"/>
  </svg>`;
}


export function destroyView() {
  if (_unsubUsers) { _unsubUsers(); _unsubUsers = null; }
  _initialized = false;
}
