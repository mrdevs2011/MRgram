/**
 * Qidiruv sahifasi (diet F3.1: "Explore" → oddiy filtr).
 * Sidebar'dagi "Qidiruv" bosilganda (overlay .open) markaz ustunda ochiladi.
 * Tablar, trend/hashtag va media setkasi yo'q: bitta ro'yxat —
 *   Odamlar + Postlar. Maydon bo'sh bo'lsa hammasi, yozib Enter bosilsa
 *   (yoki typeahead'dan tanlansa — ui.js 'explore:commit') filtrlanadi.
 * Ma'lumot: state.allPosts (ochiq yoki o'zimniki) + profiles jadvali.
 */
import { sb, state, mapProfile } from './core/config.js';
import { $, esc, defAvi } from './core/utils.js';

const overlay = $('searchOverlay');
const input   = $('searchInput');
const body    = $('expBody');

let query = '';
let users = [];
let usersOk = false;

/* ── Ma'lumot ────────────────────────────────────────────────────────── */
const ms = p => p?.createdAt || 0;

function visiblePosts() {
  const me = state.me?.uid;
  return (state.allPosts || [])
    .filter(p => p.userId === me || p.isPublic === true)
    .sort((a, b) => ms(b) - ms(a));
}

function otherUsers() {
  const me = state.me?.uid;
  return users.filter(u => u.uid !== me);
}

async function loadUsers() {
  if (usersOk) return;
  try {
    const { data, error } = await sb.from('profiles').select('*')
      .eq('approval', 'approved').order('created_at', { ascending: false }).limit(60);
    if (error) throw error;
    users = (data || []).map(mapProfile).filter(u => u && !u.blocked);
    usersOk = true;
    if (overlay.classList.contains('open')) render();
  } catch (e) {
    console.warn('[Explore]', e.message);
  }
}

/* ── Formatlash ──────────────────────────────────────────────────────── */
function ago(p) {
  const s = Math.max(0, (Date.now() - ms(p)) / 1000);
  if (!ms(p) || s < 60) return 'hozirgina';
  if (s < 3600)  return Math.floor(s / 60) + ' daqiqa oldin';
  if (s < 86400) return Math.floor(s / 3600) + ' soat oldin';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' kun oldin';
  return Math.floor(s / 86400 / 30) + ' oy oldin';
}

function fmtN(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function avatarOf(uid, name) {
  const u = users.find(x => x.uid === uid);
  return u?.avatar || defAvi(name || u?.fullName || u?.username || '?');
}

/* ── Qatorlar ────────────────────────────────────────────────────────── */
function postTitle(p) {
  const t = (p.text || '').trim();
  if (t) return t;
  if (p.mediaType?.startsWith('image')) return 'Rasm post';
  return p.fileName || 'Post';
}

function postRow(p) {
  const name = p.userFullName || users.find(u => u.uid === p.userId)?.fullName || 'Foydalanuvchi';
  const likes = p.likes ? ` · ${fmtN(p.likes)} like` : '';
  return `<button type="button" class="exp-item" data-post="${esc(p.id)}">
    <span class="exp-item-main">
      <span class="exp-title">${esc(postTitle(p))}</span>
      <span class="exp-meta"><span class="exp-av"><img src="${esc(avatarOf(p.userId, name))}" alt="" onerror="this.style.display='none'"></span><span>${esc(name)} · ${esc(ago(p))}${likes}</span></span>
    </span>
  </button>`;
}

function personRow(u) {
  const name = u.fullName || u.username || 'Foydalanuvchi';
  return `<button type="button" class="exp-item exp-person" data-uid="${esc(u.uid)}">
    <span class="exp-pav"><img src="${esc(u.avatar || defAvi(name))}" alt="" onerror="this.style.display='none'"></span>
    <span class="exp-item-main">
      <span class="exp-title exp-one">${esc(name)}</span>
      ${u.username ? `<span class="exp-sub">@${esc(u.username)}</span>` : ''}
    </span>
  </button>`;
}

const empty = t => `<div class="exp-empty">${esc(t)}</div>`;
const section = (title, inner, last) =>
  `<section class="exp-sec${last ? ' exp-last' : ''}"><h2 class="exp-h">${esc(title)}</h2>${inner}</section>`;

/* ── Ro'yxat (filtr) ─────────────────────────────────────────────────── */
function listHtml() {
  const q = query.toLowerCase().replace(/^@/, '');
  const posts = visiblePosts().filter(p => !q ||
    (p.text || '').toLowerCase().includes(q) || (p.userFullName || '').toLowerCase().includes(q));
  const pe = otherUsers().filter(u => !q ||
    (u.username || '').toLowerCase().includes(q) || (u.fullName || '').toLowerCase().includes(q));

  let html = '';
  if (pe.length)    html += section('Odamlar', pe.slice(0, 40).map(personRow).join(''), !posts.length);
  else if (!q && !usersOk) html += section('Odamlar', empty('Yuklanmoqda…'));
  if (posts.length) html += section('Postlar', posts.slice(0, q ? 40 : 15).map(postRow).join(''), true);
  return html || empty(q ? `"${query}" bo'yicha natija topilmadi` : 'Hozircha ko\'rsatadigan narsa yo\'q');
}

function render() { body.innerHTML = listHtml(); }

/* ── Holat ───────────────────────────────────────────────────────────── */
function reset() {
  query = '';
  if (input) input.value = '';
  $('searchSuggestions')?.classList.remove('show');
  overlay.scrollTop = 0;
}

function commit(val) {
  const q = String(val || '').trim();
  if (!q) { reset(); render(); return; }
  query = q;
  if (input) input.value = q;
  $('searchSuggestions')?.classList.remove('show');
  overlay.scrollTop = 0;
  render();
}

function closeOverlay() { $('searchOverlayClose')?.click(); }

/* ── Init ────────────────────────────────────────────────────────────── */
if (overlay && input && body) {
  let wasOpen = false;
  new MutationObserver(() => {
    const open = overlay.classList.contains('open');
    if (open && !wasOpen) { reset(); render(); loadUsers(); }
    wasOpen = open;
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });

  // Maydon bo'shatilsa — to'liq ro'yxat qaytadi
  input.addEventListener('input', () => {
    if (!input.value.trim() && query) { reset(); render(); }
  });

  window.addEventListener('explore:commit', e => commit(e.detail));

  body.addEventListener('click', async e => {
    $('searchSuggestions')?.classList.remove('show');

    const post = e.target.closest('[data-post]');
    if (post) {
      const id = post.dataset.post;
      closeOverlay();
      const m = await import('./profile/profile.js');
      m.openDetail?.(id);
      return;
    }

    const u = e.target.closest('[data-uid]');
    if (u) {
      const uid = u.dataset.uid;
      closeOverlay();
      const m = await import('./profile/profile.js');
      m.openUserProfileModal?.(uid);
    }
  });
}
