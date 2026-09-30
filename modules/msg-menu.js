/* msg-menu.js — xabar kontekst menyusi (Telegram uslubida).
   Desktop: xabar ustida sichqonchaning O'NG tugmasi. Mobil: xabar ustida bosib turish (long-press).
   Amallar: Nusxalash, Tahrirlash, Uzatish, O'chirish, Tanlash (ko'p tanlash paneli bilan).
   DM chat (#chatThreadMessages) uchun. Xabarlar har realtime o'zgarishda qayta chizilgani uchun
   holat (tanlov, ochiq menyu) xabar ID'lari bo'yicha saqlanadi va msgMenuAfterPaint() bilan tiklanadi. */
import { sb, state } from './config.js';
import { toast } from './toast.js';
import { $, esc, defAvi, showConfirm } from './utils.js';

const LONG_MS = 420;
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const SVG = d => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  copy: SVG('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>'),
  edit: SVG('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  fwd: SVG('<polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h11"/>'),
  del: SVG('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
  sel: SVG('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'),
  x: SVG('<path d="M6 6l12 12M18 6L6 18"/>'),
  seen: '<svg width="18" height="11" viewBox="0 0 18 11" fill="none" aria-hidden="true"><path d="M1 5.5L4.5 9L10 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 5.5L9.5 9L16 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sent: '<svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true"><path d="M1 5.2L4.5 8.5L11 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

let api = null, box = null, menu = null, selBar = null, fwdEl = null;
let openId = null, selMode = false, editing = null;
let lp = null, lpTimer = null, lpOpened = false, suppressUntil = 0;
const sel = new Set();

const isDM = () => !state.currentChatKind || state.currentChatKind === 'dm';
const msgOf = id => (api?.getMsgs() || []).find(m => m.id === id);
const isMine = m => m && m.senderId === state.me?.uid;
const rowOf = el => el?.closest?.('.chat-msg[data-msg-id]:not([data-msg-id=""])') || null;
const coarse = () => window.matchMedia('(pointer: coarse)').matches;
const pad = n => String(n).padStart(2, '0');

function when(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return '';
  const now = new Date(), t = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return `bugun ${t}`;
  if (diff === 1) return `kecha ${t}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${t}`;
}

/* ── Menyu ─────────────────────────────────────────────────────────── */
function ensureMenu() {
  if (menu) return;
  menu = document.createElement('div');
  menu.id = 'msgCtx';
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-mc]');
    if (!b) return;
    const id = openId;
    closeMenu();
    run(b.dataset.mc, id);
  });
  menu.addEventListener('contextmenu', e => e.preventDefault());
  document.body.appendChild(menu);
}

function menuHtml(m) {
  const mine = isMine(m);
  const hasText = !!(m.text || '').trim();
  const it = (k, ico, label, cls = '') => `<button type="button" class="mc-item ${cls}" data-mc="${k}">${ico}<span>${label}</span></button>`;
  let h = '';
  if (hasText) h += it('copy', IC.copy, 'Nusxalash');
  if (mine && m.type === 'text') h += it('edit', IC.edit, 'Tahrirlash');
  h += it('fwd', IC.fwd, 'Uzatish');
  if (mine) h += it('del', IC.del, 'O‘chirish', 'danger');
  h += it('sel', IC.sel, 'Tanlash');
  if (mine) {
    const read = m.status === 'read' && m.readAt;
    h += `<div class="mc-sep"></div><div class="mc-seen">${read ? IC.seen : IC.sent}<span>${read ? 'O‘qildi · ' + when(m.readAt) : 'Yuborildi · ' + when(m.createdAt)}</span></div>`;
  }
  return h;
}

function openMenu(row, x, y) {
  const id = row.dataset.msgId, m = msgOf(id);
  if (!m) return;
  closeMenu();
  ensureMenu();
  openId = id;
  row.classList.add('mc-active');
  menu.innerHTML = menuHtml(m);
  menu.style.visibility = 'hidden';
  menu.classList.add('show');
  const w = menu.offsetWidth, h = menu.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
  let left, top;
  if (x != null) { // desktop: kursor yonida
    left = x + w > vw - 8 ? x - w : x;
    top = y + h > vh - 8 ? y - h : y;
  } else { // mobil: pufakcha tagida (sig'masa tepasida)
    const r = (row.querySelector('.chat-bubble') || row).getBoundingClientRect();
    left = isMine(m) ? r.right - w : r.left;
    top = r.bottom + 8;
    if (top + h > vh - 8) top = r.top - h - 8;
  }
  left = Math.max(8, Math.min(vw - w - 8, left));
  top = Math.max(8, Math.min(vh - h - 8, top));
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.style.transformOrigin = `${x != null ? '0' : (isMine(m) ? '100%' : '0')} 0`;
  menu.style.visibility = '';
}

function closeMenu() {
  if (menu) menu.classList.remove('show');
  box?.querySelectorAll('.mc-active').forEach(r => r.classList.remove('mc-active'));
  openId = null;
}

/* ── Amallar ───────────────────────────────────────────────────────── */
function run(act, id) {
  const m = msgOf(id);
  if (!m) return;
  if (act === 'copy') return copyText((m.text || '').trim());
  if (act === 'edit') return startEdit(m);
  if (act === 'fwd') return forward([id]);
  if (act === 'del') return remove([id]);
  if (act === 'sel') return enterSelect(id);
}

async function copyText(text) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    ta.remove();
  }
  toast('Nusxalandi');
}

function remove(ids) {
  const own = ids.filter(id => isMine(msgOf(id)));
  if (!own.length) return;
  showConfirm(own.length > 1 ? `${own.length} ta xabar o‘chirilsinmi?` : 'Xabar o‘chirilsinmi?', async () => {
    const { error } = await sb.from('messages').delete().in('id', own);
    if (error) { console.warn('[MsgMenu] delete:', error.message); toast('O‘chirilmadi', 'error'); return; }
    if (editing && own.includes(editing.id)) cancelEdit(true);
    exitSelect();
    api.reload();
  }, 'O‘chirish');
}

/* ── Tahrirlash (input ustida "Tahrirlash" paneli, reply-bar qayta ishlatiladi) ── */
function startEdit(m) {
  exitSelect();
  editing = { id: m.id, text: m.text || '' };
  const inp = $('chatThreadInput');
  inp.value = editing.text;
  api.syncInput();
  inp.focus();
  try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {}
  $('chatReplyName').textContent = 'Tahrirlash';
  $('chatReplyText').textContent = editing.text.slice(0, 140);
  $('chatReplyBar').classList.add('active');
}

export function isEditing() { return !!editing; }

export function cancelEdit(clearInput = true) {
  if (!editing) return;
  editing = null;
  $('chatReplyBar')?.classList.remove('active');
  if (clearInput) { const inp = $('chatThreadInput'); if (inp) inp.value = ''; api?.syncInput(); }
}

/** sendChatMessage() tahrirlash rejimida shuni chaqiradi */
export async function commitEdit(rawText) {
  const ed = editing;
  if (!ed) return false;
  const text = (rawText || '').trim();
  if (!text) return true;
  if (text === (ed.text || '').trim()) { cancelEdit(true); return true; }
  const { error } = await sb.from('messages')
    .update({ text, edited_at: new Date().toISOString() }).eq('id', ed.id);
  if (error) { console.warn('[MsgMenu] edit:', error.message); toast('Tahrirlanmadi', 'error'); return true; }
  cancelEdit(true);
  api.reload();
  return true;
}

/* ── Tanlash rejimi ────────────────────────────────────────────────── */
function ensureSelBar() {
  if (selBar) return;
  selBar = document.createElement('div');
  selBar.id = 'msgSelBar';
  selBar.innerHTML = `
    <button type="button" class="msb-x" data-sb="x" title="Bekor qilish">${IC.x}</button>
    <div class="msb-count" id="msbCount"></div>
    <button type="button" class="msb-btn" data-sb="copy">${IC.copy}<span>Nusxalash</span></button>
    <button type="button" class="msb-btn" data-sb="fwd">${IC.fwd}<span>Uzatish</span></button>
    <button type="button" class="msb-btn danger" data-sb="del">${IC.del}<span>O‘chirish</span></button>`;
  selBar.addEventListener('click', e => {
    const b = e.target.closest('[data-sb]');
    if (!b) return;
    const ids = [...sel];
    if (b.dataset.sb === 'x') exitSelect();
    else if (b.dataset.sb === 'copy') {
      const t = (api.getMsgs() || []).filter(m => sel.has(m.id)).map(m => (m.text || '').trim()).filter(Boolean).join('\n');
      if (t) copyText(t); else toast('Nusxalanadigan matn yo‘q');
    }
    else if (b.dataset.sb === 'fwd') forward(ids, true);
    else if (b.dataset.sb === 'del') remove(ids);
  });
  $('chatThreadModal').appendChild(selBar);
}

function enterSelect(id) {
  closeMenu();
  cancelEdit(true);
  ensureSelBar();
  selMode = true;
  sel.clear();
  if (id) sel.add(id);
  box.classList.add('msg-selecting');
  $('chatThreadModal').classList.add('msg-sel-on');
  paintSel();
}

function exitSelect() {
  if (!selMode) return;
  selMode = false;
  sel.clear();
  box?.classList.remove('msg-selecting');
  box?.querySelectorAll('.mc-selected').forEach(r => r.classList.remove('mc-selected'));
  $('chatThreadModal')?.classList.remove('msg-sel-on');
}

function toggleSel(id) {
  if (sel.has(id)) sel.delete(id); else sel.add(id);
  paintSel();
}

function paintSel() {
  if (!selMode) return;
  if (!sel.size) { exitSelect(); return; }
  box.querySelectorAll('.chat-msg[data-msg-id]').forEach(r => r.classList.toggle('mc-selected', sel.has(r.dataset.msgId)));
  $('msbCount').textContent = `${sel.size} ta tanlandi`;
  const allMine = [...sel].every(id => isMine(msgOf(id)));
  selBar.querySelector('[data-sb="del"]').hidden = !allMine;
}

/* ── Uzatish (foydalanuvchi tanlash oynasi) ────────────────────────── */
async function forward(ids, fromSel = false) {
  const list = (api.getMsgs() || []).filter(m => ids.includes(m.id));
  if (!list.length) return;
  const users = await api.getUsers().catch(() => []) || [];
  if (!fwdEl) {
    fwdEl = document.createElement('div');
    fwdEl.id = 'msgFwd';
    fwdEl.innerHTML = `<div class="mf-card" role="dialog" aria-label="Uzatish">
      <div class="mf-head"><span>Uzatish</span><button type="button" class="mf-close" data-mf="x" title="Yopish">${IC.x}</button></div>
      <input type="text" class="mf-search" placeholder="Qidirish..." autocomplete="off" spellcheck="false">
      <div class="mf-list"></div></div>`;
    fwdEl.addEventListener('click', e => { if (e.target === fwdEl || e.target.closest('[data-mf="x"]')) fwdEl.classList.remove('show'); });
    document.body.appendChild(fwdEl);
  }
  const listEl = fwdEl.querySelector('.mf-list'), search = fwdEl.querySelector('.mf-search');
  const paint = q => {
    q = (q || '').trim().toLowerCase();
    const res = users.filter(u => !q || (u.fullName || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q));
    listEl.innerHTML = res.length
      ? res.map(u => `<div class="mf-row" data-uid="${esc(u.uid)}"><img src="${esc(u.avatar || defAvi(u.fullName || 'U'))}" alt="" onerror="this.src='${defAvi(u.fullName || 'U')}'"><span>${esc(u.fullName || u.username || 'Foydalanuvchi')}</span></div>`).join('')
      : '<div class="mf-empty">Topilmadi</div>';
  };
  search.value = '';
  search.oninput = () => paint(search.value);
  paint('');
  listEl.onclick = async e => {
    const row = e.target.closest('.mf-row');
    if (!row) return;
    fwdEl.classList.remove('show');
    const chatId = await api.chatIdFor(row.dataset.uid);
    if (!chatId) { toast('Suhbat ochilmadi', 'error'); return; }
    for (const m of list) { // tartib saqlansin — ketma-ket
      const { error } = await sb.from('messages').insert({
        chat_id: chatId, sender_id: state.me.uid, type: m.type,
        text: m.text || null, media_path: m.mediaPath || null, media_type: m.mediaType || null,
        file_name: m.fileName || null, file_size: m.fileSize || null, duration: m.duration || null,
      });
      if (error) { console.warn('[MsgMenu] forward:', error.message); toast('Uzatilmadi', 'error'); return; }
    }
    toast('Uzatildi');
    if (fromSel) exitSelect();
  };
  fwdEl.classList.add('show');
  setTimeout(() => { if (!coarse()) search.focus(); }, 30);
}

/* ── Hodisalar ─────────────────────────────────────────────────────── */
function cancelLp() { clearTimeout(lpTimer); lpTimer = null; lp = null; }

export function initMsgMenu(opts) {
  api = opts;
  box = opts.box;
  if (!box || box.dataset.msgMenu) return;
  box.dataset.msgMenu = '1';

  // Desktop: o'ng tugma. Sensorli qurilmada brauzerning o'z menyusini bostiramiz (long-press o'zimiz ushlaymiz).
  box.addEventListener('contextmenu', e => {
    const row = rowOf(e.target);
    if (!row || !isDM()) return;
    e.preventDefault();
    if (coarse() || selMode) return;
    openMenu(row, e.clientX, e.clientY);
  });

  // Mobil: bosib turish
  box.addEventListener('touchstart', e => {
    if (!isDM() || selMode || e.touches.length !== 1) return;
    const row = rowOf(e.target);
    if (!row) return;
    const t = e.touches[0];
    cancelLp();
    lp = { row, x: t.clientX, y: t.clientY };
    lpTimer = setTimeout(() => {
      const r = lp?.row;
      cancelLp();
      if (!r || !r.isConnected) return;
      navigator.vibrate?.(12);
      suppressUntil = Date.now() + 700;
      lpOpened = true;
      openMenu(r, null, null);
    }, LONG_MS);
  }, { passive: true });
  box.addEventListener('touchmove', e => {
    if (!lp) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - lp.x) > 10 || Math.abs(t.clientY - lp.y) > 10) cancelLp();
  }, { passive: true });
  // Bosib turib qo'yib yuborilganda brauzer "click" yuborishi mumkin (play tugmasi, havola...) — uni yutamiz
  const endTouch = () => { cancelLp(); if (lpOpened) { lpOpened = false; suppressUntil = Date.now() + 400; } };
  box.addEventListener('touchend', endTouch, { passive: true });
  box.addEventListener('touchcancel', endTouch, { passive: true });

  // Bosib turgandan keyingi "click" (masalan play tugmasi) va tanlash rejimidagi bosishlar
  box.addEventListener('click', e => {
    if (Date.now() < suppressUntil) { e.stopPropagation(); e.preventDefault(); return; }
    if (!selMode) return;
    const row = rowOf(e.target);
    if (!row) return;
    e.stopPropagation(); e.preventDefault();
    toggleSel(row.dataset.msgId);
  }, true);

  box.addEventListener('scroll', () => { if (openId) closeMenu(); }, { passive: true });

  // Menyudan tashqariga bosilsa yopiladi
  document.addEventListener('pointerdown', e => {
    if (!openId || menu?.contains(e.target)) return;
    if (e.pointerType === 'touch') suppressUntil = Date.now() + 350;
    closeMenu();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (fwdEl?.classList.contains('show')) fwdEl.classList.remove('show');
    else if (openId) closeMenu();
    else if (selMode) exitSelect();
    else if (editing) cancelEdit(true);
  });
  window.addEventListener('resize', closeMenu);
  $('chatReplyClose')?.addEventListener('click', () => cancelEdit(true));
}

/** paintMessages() dan keyin chaqiriladi — tanlov/ochiq menyu holatini yangi DOM'ga qaytaradi */
export function msgMenuAfterPaint() {
  if (!api) return;
  if (selMode) {
    const ids = new Set((api.getMsgs() || []).map(m => m.id));
    for (const id of [...sel]) if (!ids.has(id)) sel.delete(id);
    paintSel();
  }
  if (openId) {
    const row = box.querySelector(`.chat-msg[data-msg-id="${openId}"]`);
    if (row) row.classList.add('mc-active'); else closeMenu();
  }
}

/** Chat yopilganda / almashtirilganda */
export function msgMenuReset() {
  cancelLp();
  closeMenu();
  exitSelect();
  cancelEdit(true);
  fwdEl?.classList.remove('show');
}
