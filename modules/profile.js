import { sb, state, getMediaUrl, uploadViaController, mapProfile } from './config.js';
import { $, esc, fmt, fmtSz, defAvi,
         initVidWrap, openZoom }         from './utils.js';
import { toast }                         from './toast.js';

/** profiles qatori (eski users/{uid} hujjatiga o'xshash) */
async function _loadProfile(uid) {
  const { data } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
  return mapProfile(data) || {};
}
import { cacheProfile, getCachedProfile } from './local-cache.js';

/* ── My profile ──────────────────────────────────────────────────────── */

/* Profil postlari filter (Barchasi / Photos / Videos / Text / Music) */
let _pgAllPosts = [];
let _pgTab = 'all';
let _pgTabsBound = false;

function _postKind(p) {
  const mt = (p.mediaType || '').toLowerCase();
  if (mt.startsWith('image')) return 'photos';
  if (mt.startsWith('video')) return 'videos';
  if (mt.startsWith('audio') || mt.includes('mpeg') || mt.includes('mp3') || mt.includes('wav') || mt.includes('ogg')) return 'music';
  // ba'zi audio fayllar media_type bo'sh, fileName dan
  const fn = (p.fileName || p.mediaPath || '').toLowerCase();
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/.test(fn)) return 'music';
  if (/\.(mp4|webm|mov|mkv)(\?|$)/.test(fn)) return 'videos';
  if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/.test(fn)) return 'photos';
  if (p.mediaUrl && mt.startsWith('image')) return 'photos';
  if (p.mediaUrl && mt.startsWith('video')) return 'videos';
  if (!p.mediaUrl && !p.mediaPath) return 'text';
  // media bor lekin type noma'lum
  if (p.mediaUrl || p.mediaPath) return 'photos';
  return 'text';
}

function _filterPgPosts(posts, tab) {
  if (!tab || tab === 'all') return posts;
  return posts.filter(p => _postKind(p) === tab);
}

function _bindProfileTabs() {
  if (_pgTabsBound) return;
  const hdr = document.getElementById('profileGridTabs');
  if (!hdr) return;
  _pgTabsBound = true;
  hdr.addEventListener('click', e => {
    const btn = e.target.closest('[data-pg-tab]');
    if (!btn) return;
    const tab = btn.dataset.pgTab;
    if (!tab || tab === _pgTab) return;
    _pgTab = tab;
    hdr.querySelectorAll('[data-pg-tab]').forEach(b => {
      const on = b.dataset.pgTab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderProfileGrid(_pgAllPosts);
  });
}

export async function renderProfile() {
  if (!state.me) return;

  // Tarmoqni kutmasdan — keshdagi so'nggi profil ma'lumotini darhol chizamiz
  const cached = getCachedProfile(state.me.uid);
  if (cached) _paintProfile(cached);

  const ud = await _loadProfile(state.me.uid);
  cacheProfile(state.me.uid, ud);
  await _paintProfile(ud);
}

async function _paintProfile(ud) {
  const fn   = ud.fullName || state.me.displayName || 'Foydalanuvchi';
  const av   = ud.avatar   || defAvi(fn);

  // Cover photo
  const coverEl = $('profileCover');
  if (coverEl) {
    if (ud.coverUrl) {
      coverEl.style.backgroundImage = `url(${ud.coverUrl})`;
      coverEl.style.backgroundSize  = 'cover';
      coverEl.style.backgroundPosition = 'center';
      coverEl.style.display = 'block';
      coverEl.dataset.empty = 'false';
    } else {
      coverEl.style.backgroundImage = '';
      coverEl.style.display = 'none';
      coverEl.dataset.empty = 'true';
    }
  }

  $('profileAvi').innerHTML = `<img src="${av}" onerror="this.style.display='none'">
    <div class="avi-edit-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>`;

  $('profileName').textContent = fn;

  // Username
  const usernameEl = $('profileUsername');
  if (usernameEl) {
    usernameEl.textContent = ud.username ? '@' + ud.username : '';
    usernameEl.style.display = ud.username ? '' : 'none';
  }

  $('profileBio').textContent  = ud.bio || '';

  // Meta: website + location
  const metaEl = $('profileMeta');
  if (metaEl) {
    let metaHtml = '';
    if (ud.location) metaHtml += `<span class="profile-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${ud.location}</span>`;
    if (ud.website) metaHtml += `<a class="profile-meta-item profile-meta-link" href="${ud.website}" target="_blank" rel="noopener"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>${ud.website.replace(/^https?:\/\//, '')}</a>`;
    metaEl.innerHTML = metaHtml;
    metaEl.style.display = metaHtml ? '' : 'none';
  }

  const myP = state.allPosts.filter(p => p.userId === state.me.uid);
  $('statPosts').textContent     = myP.length;
  $('statLikes').textContent     = myP.reduce((s,p) => s+(p.likes||0), 0);

  // Avatar click — zoom + quick edit shortcut
  $('profileAvi').onclick = () => {
    openZoom(av, 'avatar');
    const zm = document.getElementById('zoomModal');
    if (zm) {
      let editBtn = document.getElementById('aviEditBtn');
      if (!editBtn) {
        editBtn = document.createElement('button');
        editBtn.id = 'aviEditBtn';
        editBtn.className = 'avi-zoom-edit-btn';
        editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Rasmni tahrirlash`;
        zm.appendChild(editBtn);
      }
      editBtn.style.display = 'flex';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        zm.classList.remove('show');
        $('editProfileBtn')?.click(); // open full edit sheet
      };
      const hideEditBtn = () => { if (editBtn) editBtn.style.display = 'none'; };
      zm.addEventListener('click', function onZmClick(e) {
        if (e.target === zm) { hideEditBtn(); zm.removeEventListener('click', onZmClick); }
      });
      document.getElementById('zoomClose')?.addEventListener('click', hideEditBtn, { once: true });
    }
  };

  await renderProfileGrid(myP);
}

export async function renderProfileGrid(posts) {
  _bindProfileTabs();
  if (Array.isArray(posts)) _pgAllPosts = posts;
  const list = _filterPgPosts(_pgAllPosts, _pgTab);

  // mosaic faqat Barchasi da; boshqa tablarda bir xil katak
  const grid = $('profileGrid');
  if (grid) grid.classList.toggle('profile-grid--uniform', _pgTab !== 'all');

  if (!list.length) {
    $('profileGrid').innerHTML = `<div class="up-grid-empty">
      <div class="up-grid-empty-title">Hozircha postlar yo'q</div>
      <div class="up-grid-empty-sub">Birinchi postingizni joylang — shu yerda ko'rinadi</div>
    </div>`;
    return;
  }

  // Multi-Supabase: mediaUrl yaratish (backward compatibility)
  await Promise.all(list.map(async p => {
    if (!p.mediaUrl && (p.mediaPath || p.storageIndex)) {
      p.mediaUrl = await getMediaUrl(p);
    }
  }));

  $('profileGrid').innerHTML = list.map(p => {
    const isImg = !!(p.mediaUrl && p.mediaType?.startsWith('image'));
    const isVid = !!(p.mediaUrl && p.mediaType?.startsWith('video'));
    const isMedia = isImg || isVid;
    let c = '';
    if (isImg) c = `<img src="${esc(p.mediaUrl)}" loading="lazy" alt="">`;
    else if (isVid) c = `<video src="${esc(p.mediaUrl)}" preload="metadata" muted></video>`;
    else c = `<div class="grid-cell-txt">${esc((p.text||p.fileName||'').substring(0,80))}</div>`;
    const kind = isMedia ? 'grid-cell--media' : 'grid-cell--text';
    return `<div class="grid-cell ${kind}" data-id="${p.id}">${c}
      ${isVid ? `<div class="grid-play-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="m5 3 14 9-14 9V3z"/></svg></div>` : ''}
      <div class="grid-cell-overlay">
        <div class="grid-stat">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          ${p.likes||0}
        </div>
        <div class="grid-stat">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${p.views||0}
        </div>
      </div>
    </div>`;
  }).join('');
  document.querySelectorAll('.grid-cell').forEach(c => c.addEventListener('click', () => openDetail(c.dataset.id)));
}

/* ── Post detail modal ───────────────────────────────────────────────── */
export async function openDetail(id) {
  const p = state.allPosts.find(x => x.id === id); if (!p) return;

  // Multi-Supabase: mediaUrl yaratish (backward compatibility)
  if (!p.mediaUrl && (p.mediaPath || p.storageIndex)) {
    p.mediaUrl = await getMediaUrl(p);
  }

  $('detailContent').innerHTML = `
    <div class="dm-handle"></div>
    <div class="d-flex items-center gap-10px p-14px-16px-10px">
      <div class="w-38px h-38px brr-50pct bg-bg3 flex-shrink-0"></div>
      <div class="flex-1"><div class="h-12px w-120px bg-bg3 brr-4px mb-6px"></div><div class="h-10px w-80px bg-bg3 brr-4px"></div></div>
    </div>
    <div class="w-full aspect-1 bg-bg3"></div>
    <div class="h-60px"></div>`;
  $('detailModal').classList.add('show');

  const [lR, cR, uR] = await Promise.all([
    sb.from('post_likes').select('post_id', { count: 'exact', head: true }).eq('post_id', id).eq('user_id', state.me.uid),
    sb.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', id),
    sb.from('profiles').select('*').eq('id', p.userId).maybeSingle(),
  ]);
  const isLiked  = (lR.count || 0) > 0;
  const cmtCount = cR.count || 0;
  const ud = mapProfile(uR.data) || {};
  const av = ud.avatar || defAvi(ud.fullName);
  const isOwn = p.userId === state.me?.uid;
  if (isLiked) state.myLikedPosts.add(id);

  let mediaHtml = '';
  if (p.mediaUrl && p.mediaType?.startsWith('image')) {
    mediaHtml = `<div class="dm-media"><img src="${esc(p.mediaUrl)}" loading="lazy"></div>`;
  } else if (p.mediaUrl && p.mediaType?.startsWith('video')) {
    mediaHtml = `<div class="dm-media"><div class="vid-wrap"><video src="${esc(p.mediaUrl)}" preload="metadata" playsinline></video><div class="vid-overlay"></div><div class="vid-controls"><button class="vc-play"><svg class="ic-play" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg><svg class="ic-pause d-none" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></button><div class="vc-progress"><div class="vc-bar"><div class="vc-fill"></div></div></div><span class="vc-time">0:00</span><button class="vc-mute"><svg class="ic-vol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg><svg class="ic-muted d-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg></button><button class="vc-fs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button></div></div></div>`;
  }

  const likeColor = isLiked ? '#f04060' : 'currentColor';
  const likeFill  = isLiked ? '#f04060' : 'none';

  $('detailContent').innerHTML = `
    <div class="dm-handle"></div>
    <div class="dm-head">
      <div class="dm-avi${isOwn?'':' dm-avi-link'}" ${isOwn?'':('data-uid="'+p.userId+'"')}><img src="${av}" onerror="this.style.display='none'"></div>
      <div class="dm-meta">
        <div class="dm-name${isOwn?'':' dm-name-link'}" ${isOwn?'':('data-uid="'+p.userId+'"')}>${esc(ud.fullName||'Noma\'lum')}</div>
        <div class="dm-time">${fmt(p.createdAt)}</div>
      </div>
      <button class="dm-close" id="dmClose"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    ${mediaHtml}
    ${p.text ? `<div class="dm-caption">${esc(p.text)}</div>` : ''}
    <div class="dm-stats">
      <span class="dm-stat-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${p.views||0}</span>
      <span class="dm-stat-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="${likeFill}" stroke="${likeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> <span id="dmLikeCount">${p.likes||0}</span></span>
      <span class="dm-stat-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${cmtCount}</span>
    </div>
    <div class="dm-actions">
      <button class="dm-act${isLiked?' liked':''}" id="dmLikeBtn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${likeFill}" stroke="${likeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span class="dm-act-count" id="dmLikeCount2">${p.likes||0}</span>
      </button>
      <button class="dm-act" id="dmCmtBtn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="dm-act-count">${cmtCount}</span>
      </button>
      ${p.mediaUrl ? `<button class="dm-act" id="dmShareBtn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>` : ''}
      ${isOwn ? `<button class="dm-act dm-del" id="dmDelBtn" title="O'chirish">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>` : ''}
    </div>`;

  const vw = $('detailContent').querySelector('.vid-wrap');
  if (vw) initVidWrap(vw);

  const closeDetail = () => {
    const vid = $('detailContent').querySelector('video');
    if (vid) vid.pause();
    $('detailModal').classList.remove('show');
  };

  $('dmClose').onclick = closeDetail;
  $('detailModal').onclick = e => { if (e.target === $('detailModal')) closeDetail(); };
  $('dmLikeBtn').onclick = async () => {
    await doLikeGen(id, $('dmLikeBtn'));
    const { data: _pr } = await sb.from('posts').select('likes_count').eq('id', id).maybeSingle();
    const n = _pr?.likes_count ?? 0;
    $('dmLikeCount').textContent  = n;
    $('dmLikeCount2').textContent = n;
  };
  $('dmCmtBtn').onclick = () => { closeDetail(); import('./comments.js').then(({ openCmtModal }) => openCmtModal(id)); };
  $('dmShareBtn')?.addEventListener('click', () => { navigator.clipboard?.writeText(p.mediaUrl); toast('Link nusxalandi','info'); });
  $('dmDelBtn')?.addEventListener('click', async () => {
    const { doDelete } = await import('./feed.js');
    await doDelete(id);
    closeDetail();
    // Profil grid ni yangilash
    try {
      const myP = (state.allPosts || []).filter(x => x.userId === state.me?.uid);
      await renderProfileGrid(myP);
    } catch (_) {}
  });
  $('detailContent').querySelectorAll('.dm-avi-link,.dm-name-link').forEach(el => {
    el.addEventListener('click', () => { closeDetail(); openUserProfileModal(el.dataset.uid); });
  });
}

export async function doLikeGen(id, btn) {
  if (!state.me) return;
  const wasLiked = state.myLikedPosts.has(id);
  const svg      = btn.querySelector('svg');
  if (wasLiked) {
    state.myLikedPosts.delete(id);
    const { error } = await sb.from('post_likes').delete().eq('post_id', id).eq('user_id', state.me.uid);
    if (error) { state.myLikedPosts.add(id); return; }
    btn.classList.remove('liked'); svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor');
  } else {
    state.myLikedPosts.add(id);
    const { error } = await sb.from('post_likes').insert({ post_id: id, user_id: state.me.uid });
    if (error && error.code !== '23505') { state.myLikedPosts.delete(id); return; }
    btn.classList.add('liked'); svg.setAttribute('fill','#f04060'); svg.setAttribute('stroke','#f04060');
  }
}

/* ── Other user's profile modal ──────────────────────────────────────── */
export async function openUserProfileModal(uid) {
  if (!uid || uid === state.me?.uid) return;
  state.currentViewingUserId = uid;
  $('userProfileModal').classList.add('show');
  $('upBody').innerHTML = '<div class="spin-wrap pt-80px"><div class="spinner"></div></div>';
  await renderUserProfileModal(uid);
}

export async function renderUserProfileModal(uid) {
  const ud    = await _loadProfile(uid);
  let av      = ud.avatar;
  if (!av || av === '' || av === 'undefined') av = defAvi(ud.fullName || 'U');

  const userPublicPosts = state.allPosts.filter(p => p.userId === uid && p.isPublic === true);
  state.currentViewingUserPosts = userPublicPosts;

  // Multi-Supabase: mediaUrl yaratish (backward compatibility)
  await Promise.all(userPublicPosts.map(async p => {
    if (!p.mediaUrl && (p.mediaPath || p.storageIndex)) {
      p.mediaUrl = await getMediaUrl(p);
    }
  }));

  const totalLikes     = userPublicPosts.reduce((s,p) => s + (p.likes||0), 0);

  const gridHTML = userPublicPosts.length === 0
    ? '<div class="up-grid-empty"><div class="up-grid-empty-title">Ommaviy postlar yo\'q</div><div class="up-grid-empty-sub">Bu foydalanuvchi hali hech narsa joylamagan</div></div>'
    : userPublicPosts.map(p => {
        let c = '';
        if (p.mediaUrl && p.mediaType?.startsWith('image'))
          c = `<img class="w-full h-full object-cover" src="${esc(p.mediaUrl)}" loading="lazy" onerror="this.classList.add('d-none')">`;
        else if (p.mediaUrl && p.mediaType?.startsWith('video'))
          c = `<video src="${esc(p.mediaUrl)}" preload="metadata" muted></video>`;
        else
          c = `<div class="up-grid-cell-txt">${esc((p.text||p.fileName||'').substring(0,40))}</div>`;
        const isVid = p.mediaType?.startsWith('video');
        const _um = !!(p.mediaUrl && (p.mediaType?.startsWith('image') || p.mediaType?.startsWith('video')));
        return `<div class="up-grid-cell ${_um ? 'up-grid-cell--media' : 'up-grid-cell--text'}" data-id="${p.id}" data-uid="${uid}">${c}
          ${isVid ? `<div class="grid-play-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="m5 3 14 9-14 9V3z"/></svg></div>` : ''}
          <div class="up-grid-cell-overlay">
            <div class="grid-stat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              ${p.likes||0}
            </div>
            <div class="grid-stat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              ${p.views||0}
            </div>
          </div>
        </div>`;
      }).join('');

  const coverStyle = ud.coverUrl
    ? `background-image:url(${ud.coverUrl});background-size:cover;background-position:center;`
    : '';
  $('upBody').innerHTML = `
    <div class="up-cover" style="${coverStyle}"><div class="up-avi-wrap"><div class="up-avi" id="upAviImg" style="cursor:pointer" title="Rasmni ko'rish"><img class="w-full h-full object-cover" src="${av}" onerror="this.src='${defAvi(ud.fullName || 'U')}'"></div></div></div>
    <div class="up-info">
      <div class="up-name">${esc(ud.fullName||'Noma\'lum')}</div>
      ${ud.bio ? `<div class="up-bio">${esc(ud.bio)}</div>` : ''}
      <div class="up-stats">
        <div class="up-stat"><div class="up-stat-val">${userPublicPosts.length}</div><div class="up-stat-lbl">postlar</div></div>
        <div class="up-stat"><div class="up-stat-val">${totalLikes}</div><div class="up-stat-lbl">yoqtirishlar</div></div>
      </div>
      <div class="up-posts-tab">
        <span class="up-posts-tab-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Postlar
        </span>
      </div>
      <div class="up-grid" id="upGrid">${gridHTML}</div>
    </div>`;

  // Avatar rasmini kattalashtirish (boshqa user profili)
  const upAviEl = document.getElementById('upAviImg');
  if (upAviEl) {
    upAviEl.onclick = () => openZoom(av, 'avatar');
  }

  document.querySelectorAll('.up-grid-cell[data-id]').forEach(cell => {
    cell.addEventListener('click', () => openDetail(cell.dataset.id));
  });
}

$('upBack').onclick = () => {
  state.currentViewingUserId    = null;
  state.currentViewingUserPosts = [];
  $('userProfileModal').classList.remove('show');
};
$('userProfileModal').addEventListener('click', e => {
  if (e.target === $('userProfileModal')) {
    state.currentViewingUserId    = null;
    state.currentViewingUserPosts = [];
    $('userProfileModal').classList.remove('show');
  }
});