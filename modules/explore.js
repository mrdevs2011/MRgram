/**
 * Qidiruv sahifasi — X "Explore" uslubida.
 * Sidebar'dagi "Qidiruv" bosilganda (overlay .open bo'lganda) markaz ustunda
 * ochiladi: pill qidiruv + tablar (Kashf / Trend / Postlar / Odamlar / Media)
 * + "Bugungi postlar" va "Trend" ro'yxatlari.
 * Yozganda — typeahead kartasi (ui.js). Enter yoki trend/taklif bosilsa —
 * natijalar shu sahifaning o'zida (Barchasi / Postlar / Odamlar / Media).
 * Ma'lumot: state.allPosts (ochiq yoki o'zimniki) + profiles jadvali.
 */
import { sb, state, mapProfile } from './config.js';
import { $, esc, defAvi } from './utils.js';

const overlay = $('searchOverlay');
const input   = $('searchInput');
const body    = $('expBody');
const tabsEl  = $('expTabs');

const EXPLORE_TABS = [['explore', 'Kashf'], ['trend', 'Trend'], ['posts', 'Postlar'], ['people', 'Odamlar'], ['media', 'Media']];
const RESULT_TABS  = [['all', 'Barchasi'], ['posts', 'Postlar'], ['people', 'Odamlar'], ['media', 'Media']];

const DOTS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';

let mode  = 'explore';   // 'explore' | 'results'
let tab   = 'explore';
let query = '';
let users = [];
let usersOk = false;

/* ── Ma'lumot ────────────────────────────────────────────────────────── */
const ms = p => p?.createdAt?.toMillis?.() || 0;

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

function trends() {
  const map = new Map();
  visiblePosts().forEach(p => {
    const seen = new Set();
    (p.text || '').match(/#[\p{L}\p{N}_]+/gu)?.forEach(t => {
      const k = t.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      const e = map.get(k) || { tag: t, n: 0 };
      e.n++;
      map.set(k, e);
    });
  });
  return [...map.values()].sort((a, b) => b.n - a.n);
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
  if (p.mediaType?.startsWith('video')) return 'Video post';
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

function trendRow(t, i, ranked) {
  return `<div class="exp-item" role="button" tabindex="0" data-q="${esc(t.tag)}">
    <span class="exp-item-main">
      <span class="exp-kicker">${ranked ? (i + 1) + ' · ' : ''}Trend · MRgram</span>
      <span class="exp-title">${esc(t.tag)}</span>
      <span class="exp-sub">${fmtN(t.n)} ta post</span>
    </span>
    <button type="button" class="exp-more" aria-label="Ko'proq" data-noop>${DOTS}</button>
  </div>`;
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

function mediaGrid(posts) {
  const list = posts.filter(p => p.mediaUrl && (p.mediaType?.startsWith('image') || p.mediaType?.startsWith('video'))).slice(0, 45);
  if (!list.length) return empty('Hozircha media yo\'q');
  return `<div class="exp-media">${list.map(p => {
    const v = p.mediaType.startsWith('video');
    const el = v
      ? `<video src="${esc(p.mediaUrl)}#t=0.1" muted playsinline preload="metadata"></video>`
      : `<img src="${esc(p.mediaUrl)}" alt="" loading="lazy">`;
    return `<button type="button" data-post="${esc(p.id)}" aria-label="Post">${el}</button>`;
  }).join('')}</div>`;
}

const empty = t => `<div class="exp-empty">${esc(t)}</div>`;
const section = (title, inner, last) =>
  `<section class="exp-sec${last ? ' exp-last' : ''}">${title ? `<h2 class="exp-h">${esc(title)}</h2>` : ''}${inner}</section>`;
const more = (t, go) => `<button type="button" class="exp-show-more" data-go="${go}">${esc(t)}</button>`;

/* ── Sahifalar ───────────────────────────────────────────────────────── */
function exploreHtml() {
  const posts = visiblePosts();
  const tr = trends();
  const pe = otherUsers();

  if (tab === 'trend') {
    return tr.length
      ? tr.slice(0, 25).map((t, i) => trendRow(t, i, true)).join('')
      : empty('Hozircha trend hashtaglar yo\'q. Postlarga #hashtag qo\'shing.');
  }
  if (tab === 'posts')  return posts.length ? posts.slice(0, 25).map(postRow).join('') : empty('Hozircha postlar yo\'q');
  if (tab === 'people') return pe.length ? pe.slice(0, 40).map(personRow).join('') : empty(usersOk ? 'Hozircha odamlar yo\'q' : 'Yuklanmoqda…');
  if (tab === 'media')  return mediaGrid(posts);

  // Kashf
  let html = '';
  if (posts.length) html += section('Bugungi postlar', posts.slice(0, 3).map(postRow).join(''));
  if (tr.length) {
    html += section('', tr.slice(0, 5).map((t, i) => trendRow(t, i, false)).join('') + (tr.length > 5 ? more('Ko\'proq ko\'rsatish', 'trend') : ''));
  }
  if (pe.length) {
    html += section('Odamlar', pe.slice(0, 3).map(personRow).join('') + (pe.length > 3 ? more('Ko\'proq ko\'rsatish', 'people') : ''), true);
  }
  return html || empty('Hozircha ko\'rsatadigan narsa yo\'q');
}

function resultsHtml() {
  const q = query.toLowerCase().replace(/^@/, '');
  const posts = visiblePosts().filter(p =>
    (p.text || '').toLowerCase().includes(q) || (p.userFullName || '').toLowerCase().includes(q));
  const pe = otherUsers().filter(u =>
    (u.username || '').toLowerCase().includes(q) || (u.fullName || '').toLowerCase().includes(q));
  const none = empty(`"${query}" bo'yicha natija topilmadi`);

  if (tab === 'posts')  return posts.length ? posts.slice(0, 40).map(postRow).join('') : none;
  if (tab === 'people') return pe.length ? pe.slice(0, 40).map(personRow).join('') : none;
  if (tab === 'media')  return posts.some(p => p.mediaUrl) ? mediaGrid(posts) : none;

  // Barchasi
  let html = '';
  if (pe.length)    html += section('Odamlar', pe.slice(0, 3).map(personRow).join('') + (pe.length > 3 ? more('Hammasini ko\'rish', 'people') : ''));
  if (posts.length) html += section('Postlar', posts.slice(0, 15).map(postRow).join(''), true);
  return html || none;
}

function render() {
  const defs = mode === 'results' ? RESULT_TABS : EXPLORE_TABS;
  tabsEl.innerHTML = defs.map(([id, label]) =>
    `<button type="button" class="exp-tab${id === tab ? ' on' : ''}" data-tab="${id}" role="tab" aria-selected="${id === tab}"><span>${label}</span></button>`).join('');
  body.innerHTML = mode === 'results' ? resultsHtml() : exploreHtml();
}

/* ── Holat ───────────────────────────────────────────────────────────── */
function reset() {
  mode = 'explore'; tab = 'explore'; query = '';
  if (input) input.value = '';
  $('searchSuggestions')?.classList.remove('show');
  overlay.scrollTop = 0;
}

function commit(val) {
  const q = String(val || '').trim();
  if (!q) { reset(); render(); return; }
  query = q; mode = 'results'; tab = 'all';
  if (input) input.value = q;
  $('searchSuggestions')?.classList.remove('show');
  overlay.scrollTop = 0;
  render();
}

function closeOverlay() { $('searchOverlayClose')?.click(); }

/* ── Init ────────────────────────────────────────────────────────────── */
if (overlay && input && body && tabsEl) {
  let wasOpen = false;
  new MutationObserver(() => {
    const open = overlay.classList.contains('open');
    if (open && !wasOpen) { reset(); render(); loadUsers(); }
    wasOpen = open;
  }).observe(overlay, { attributes: true, attributeFilter: ['class'] });

  // Maydon bo'shatilsa — yana Kashf sahifasi
  input.addEventListener('input', () => {
    if (!input.value.trim() && mode === 'results') { reset(); render(); }
  });

  window.addEventListener('explore:commit', e => commit(e.detail));

  tabsEl.addEventListener('click', e => {
    const b = e.target.closest('.exp-tab');
    if (!b) return;
    tab = b.dataset.tab;
    overlay.scrollTop = 0;
    render();
  });

  body.addEventListener('click', async e => {
    $('searchSuggestions')?.classList.remove('show');
    if (e.target.closest('[data-noop]')) { e.stopPropagation(); return; }

    const go = e.target.closest('[data-go]');
    if (go) { tab = go.dataset.go; overlay.scrollTop = 0; render(); return; }

    const q = e.target.closest('[data-q]');
    if (q) { commit(q.dataset.q); return; }

    const post = e.target.closest('[data-post]');
    if (post) {
      const id = post.dataset.post;
      closeOverlay();
      const m = await import('./profile.js');
      m.openDetail?.(id);
      return;
    }

    const u = e.target.closest('[data-uid]');
    if (u) {
      const uid = u.dataset.uid;
      closeOverlay();
      const m = await import('./profile.js');
      m.openUserProfileModal?.(uid);
    }
  });

  body.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-q]')) {
      e.preventDefault();
      commit(e.target.dataset.q);
    }
  });
}
