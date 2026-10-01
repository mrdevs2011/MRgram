import { busEmit } from './rt-bus.js';
import { sb, state, CAP_LIMIT, getMediaUrl, isAdmin, mapProfile, MEDIA_BUCKET } from './config.js';
import { $, esc, renderMarkdown, fmt, fmtSz, defAvi,
         initVidWrap, showConfirm,
         dlFile, openZoom, showHeartBurst, fmtCount } from './utils.js';
import { toast }                            from './toast.js';

/* ── Helpers ─────────────────────────────────────────────────────────── */

/* File type → SVG icon (mirrors upload.js getFileTypeInfo) */
function getFileIcon(name, mime) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const m   = (mime || '').toLowerCase();
  if (m.startsWith('audio') || ['mp3','wav','ogg','aac','flac','m4a','wma','opus','aiff','mid','midi'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(255, 255, 255,0.12)"/><path d="M18 34V18l16-4v16" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="34" r="3" fill="#ffffff"/><circle cx="31" cy="30" r="3" fill="#ffffff"/><path d="M20 22l12-3" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".5"/></svg>`;
  if (['html','htm'].includes(ext) || m === 'text/html')
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(249,115,22,0.12)"/><path d="M14 18l-5 6 5 6" stroke="#f97316" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 18l5 6-5 6" stroke="#f97316" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><line x1="28" y1="14" x2="20" y2="34" stroke="#f97316" stroke-width="2" stroke-linecap="round" opacity=".6"/></svg>`;
  if (['ts','tsx'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(255, 255, 255,0.12)"/><rect x="10" y="10" width="28" height="28" rx="5" fill="#ffffff"/><text x="24" y="30" text-anchor="middle" font-family="monospace" font-weight="800" font-size="14" fill="white">TS</text></svg>`;
  if (['js','mjs','cjs','jsx'].includes(ext) || m.includes('javascript'))
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(234,179,8,0.12)"/><rect x="10" y="10" width="28" height="28" rx="5" fill="#eab308"/><text x="24" y="30" text-anchor="middle" font-family="monospace" font-weight="800" font-size="14" fill="#111">${ext==='jsx'?'JSX':'JS'}</text></svg>`;
  if (ext === 'pdf' || m === 'application/pdf')
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(239,68,68,0.12)"/><path d="M13 8h16l8 8v24a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" stroke="#ef4444" stroke-width="2"/><path d="M29 8v8h8" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/><text x="24" y="34" text-anchor="middle" font-family="monospace" font-weight="700" font-size="9" fill="#ef4444">PDF</text></svg>`;
  if (['zip','rar','7z','tar','gz','bz2','xz'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(255, 255, 255,0.12)"/><rect x="12" y="16" width="24" height="20" rx="3" stroke="#ffffff" stroke-width="2"/><path d="M12 22h24" stroke="#ffffff" stroke-width="2"/><rect x="20" y="8" width="8" height="8" rx="2" stroke="#ffffff" stroke-width="2"/><line x1="24" y1="8" x2="24" y2="16" stroke="#ffffff" stroke-width="2"/></svg>`;
  if (['doc','docx'].includes(ext) || m.includes('msword') || m.includes('wordprocessingml'))
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(255, 255, 255,0.12)"/><path d="M13 8h16l8 8v24a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" stroke="#ffffff" stroke-width="2"/><line x1="16" y1="26" x2="32" y2="26" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="31" x2="28" y2="31" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".6"/><text x="24" y="23" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="8" fill="#ffffff">W</text></svg>`;
  if (['xls','xlsx','csv','ods'].includes(ext) || m.includes('spreadsheet') || m.includes('excel') || m === 'text/csv')
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(22,163,74,0.12)"/><rect x="9" y="14" width="30" height="22" rx="3" stroke="#16a34a" stroke-width="2"/><line x1="9" y1="22" x2="39" y2="22" stroke="#16a34a" stroke-width="1.5"/><line x1="9" y1="29" x2="39" y2="29" stroke="#16a34a" stroke-width="1.5" opacity=".6"/><line x1="21" y1="14" x2="21" y2="36" stroke="#16a34a" stroke-width="1.5" opacity=".7"/></svg>`;
  if (ext === 'py')
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(255, 255, 255,0.10)"/><path d="M18 10h8a4 4 0 0 1 4 4v4H18a4 4 0 0 1-4-4v-2a2 2 0 0 1 2-2z" fill="#ffffff"/><path d="M18 38h8a4 4 0 0 0 4-4v-4H18a4 4 0 0 0-4 4v2a2 2 0 0 0 2 2z" fill="#eab308"/><circle cx="22" cy="16" r="1.5" fill="white"/><circle cx="26" cy="32" r="1.5" fill="white"/></svg>`;
  if (ext === 'json')
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(245,158,11,0.12)"/><text x="10" y="30" font-family="monospace" font-weight="700" font-size="18" fill="#f59e0b">{}</text><text x="10" y="20" font-family="monospace" font-size="9" fill="#f59e0b" opacity=".7">"key":</text></svg>`;
  if (['css','scss','sass','less'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(255, 255, 255,0.12)"/><rect x="10" y="10" width="28" height="28" rx="5" fill="#ffffff"/><text x="24" y="30" text-anchor="middle" font-family="monospace" font-weight="800" font-size="11" fill="white">CSS</text></svg>`;
  if (['md','mdx'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(118, 118, 118,0.12)"/><path d="M8 14h32v20H8z" stroke="#767676" stroke-width="2" rx="3"/><text x="24" y="29" text-anchor="middle" font-family="monospace" font-weight="700" font-size="11" fill="#767676">M↓</text></svg>`;
  // default
  return `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="rgba(255, 255, 255,0.10)"/><path d="M13 8h16l8 8v24a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" stroke="#ffffff" stroke-width="2"/><path d="M29 8v8h8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="24" x2="32" y2="24" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity=".6"/></svg>`;
}


export function filtered() {
  let p = [...state.allPosts];
  // Firestore postlar: isPublic === true bo'lsa hammaga, aks holda faqat egasiga
  p = p.filter(x => {
    if (x.userId === state.me?.uid) return true; // o'z postlari har doim ko'rinadi
    return x.isPublic === true;
  });
  if (state.search) {
    const q = state.search.toLowerCase();
    p = p.filter(x =>
      (x.text||'').toLowerCase().includes(q) ||
      (x.userFullName||'').toLowerCase().includes(q)
    );
  }
  return p;
}


export function buildCaption(text, postId) {
  if (!text) return '';
  const escaped = renderMarkdown(text);
  if (text.length <= CAP_LIMIT) return `<div class="post-caption">${escaped}</div>`;
  const short = renderMarkdown(text.substring(0, CAP_LIMIT));
  return `<div class="post-caption cap-collapsed" data-postid="${postId}">
    <span class="cap-short">${short}<span class="cap-more">...ko'proq</span></span>
    <span class="cap-full">${escaped}<span class="cap-more c-blue-theme">kamroq</span></span>
  </div>`;
}

export function buildMedia(p) {
  if (!p.mediaUrl) return '';
  // Post matni doim darrov ko'rinadi (buildCaption alohida chiziladi).
  // Media esa "pm-loading" holatida boshlanadi: agar postda mediaWidth/
  // mediaHeight saqlangan bo'lsa (yuklash paytida o'lchangan), post-card
  // ALDINDAN xuddi shu nisbatda joy ochib turadi — shu bois rasm/video
  // hali yuklanmasdan turib ham layout "sakramaydi", faqat blur bilan
  // ko'rinadi. To'liq yuklangach (onload/onloadeddata) "pm-loading"
  // klassi olib tashlanadi va blur asta yo'qoladi.
  const ratio = (p.mediaWidth && p.mediaHeight)
    ? ` style="aspect-ratio:${p.mediaWidth}/${p.mediaHeight}"`
    : '';
  if (p.mediaType?.startsWith('image'))
    return `<div class="post-media pm-loading" data-id="${p.id}" data-type="image" data-url="${esc(p.mediaUrl)}"${ratio}><img src="${esc(p.mediaUrl)}" loading="lazy" onload="this.closest('.post-media')?.classList.remove('pm-loading')" onerror="this.closest('.post-media')?.classList.remove('pm-loading')"></div>`;
  if (p.mediaType?.startsWith('video'))
    return `<div class="post-media pm-loading" data-id="${p.id}" data-type="video" data-url="${esc(p.mediaUrl)}"${ratio}>
      <div class="vid-wrap">
        <video src="${esc(p.mediaUrl)}" preload="metadata" playsinline onloadeddata="this.closest('.post-media')?.classList.remove('pm-loading')" onerror="this.closest('.post-media')?.classList.remove('pm-loading')"></video>
        <div class="vid-overlay"></div>
        <div class="vid-controls">
          <button class="vc-play">
            <svg class="ic-play" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            <svg class="ic-pause d-none" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
          <div class="vc-progress">
            <div class="vc-bar"><div class="vc-fill"></div></div>
          </div>
          <span class="vc-time">0:00</span>
          <button class="vc-mute">
            <svg class="ic-vol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <svg class="ic-muted d-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          </button>
          <button class="vc-fs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  return `<div class="file-card" data-url="${esc(p.mediaUrl)}" data-name="${esc(p.fileName||'file')}">
    <div class="file-card-icon">${getFileIcon(p.fileName||'', p.mediaType||'')}</div>
    <div class="file-info"><div class="file-name">${esc(p.fileName||'File')}</div><div class="file-size">${p.fileSize ? fmtSz(p.fileSize) : ''}</div></div>
    <button class="file-dl" data-url="${esc(p.mediaUrl)}" data-name="${esc(p.fileName||'file')}">Yuklab olish</button>
  </div>`;
}

/* ── Feed rendering ──────────────────────────────────────────────────── */
/** Scroll paytida faqat yangi postlarni qo'shadi (butun feed qayta yozilmaydi) */
async function appendPostsToFeed(feedEl, newPosts) {
  if (!newPosts.length) return;

  // Media URL larni olish
  await Promise.all(newPosts.map(async p => {
    if (!p.mediaUrl && (p.mediaPath || p.storageIndex)) {
      p.mediaUrl = await getMediaUrl(p);
    }
  }));

  // Vaqtinchalik konteyner orqali HTML yaratamiz
  const tempEl = document.createElement('div');
  tempEl.style.display = 'none';
  document.body.appendChild(tempEl);
  await renderFeedTo(tempEl, newPosts);
  document.body.removeChild(tempEl);

  // Yangi postlarni asosiy feed'ga ko'chiramiz
  const posts = tempEl.querySelectorAll('.post');
  posts.forEach(p => feedEl.appendChild(p));

  bindFeedEvents(feedEl);
}

export async function renderFeedTo(feedEl, posts) {
  if (!state.me || !feedEl) return;
  if (!posts.length) {
    if (state.search) {
      feedEl.innerHTML = `<div class="empty-search">
        <div class="empty-search-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <div>Natija topilmadi: "<strong>${esc(state.search)}</strong>"</div>
        <div class="empty-search-hint">Boshqa so'z bilan qidirib ko'ring yoki imloni tekshiring</div>
      </div>`;
    } else {
      const createBtn = state.view === 'home'
        ? `<button class="empty-cta" onclick="document.querySelector('.nav-center-btn')?.click() || document.getElementById('createBtn')?.click()">Birinchi postingizni joylang</button>`
        : '';
      feedEl.innerHTML = `<div class="empty empty--home">
        <div class="empty-glow" aria-hidden="true"></div>
        <div class="empty-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14"/><path d="M5 12h14"/>
          </svg>
        </div>
        <div class="empty-title">Lenta hali bo'sh</div>
        <div class="empty-sub">Rasm, video yoki fikr bo'lishing — do'stlaringiz ko'radi.</div>
        ${createBtn}
      </div>`;
    }
    return;
  }

  // User cache dan foydalanish - Firestore reads kamaytirish
  const uids = [...new Set(posts.map(p => p.userId))];
  const uMap = {};
  const uidsToFetch = uids.filter(uid => !state._userCache[uid]);

  // Cache dan borlarni olish
  uids.forEach(uid => {
    if (state._userCache[uid]) {
      uMap[uid] = {
        fullName: state._userCache[uid].fullName,
        avatar: state._userCache[uid].avatar || defAvi(state._userCache[uid].fullName)
      };
    }
  });

  // Faqat cache da yo'qlarni yuklash
  if (uidsToFetch.length) {
    const { data: _uRows } = await sb.from('profiles')
      .select('id,full_name,avatar,username').in('id', uidsToFetch);
    const _uById = new Map((_uRows || []).map(r => [r.id, mapProfile(r)]));
    uidsToFetch.forEach(u => {
      const d = _uById.get(u) || {};
      state._userCache[u] = {
        uid: u,
        fullName: d.fullName,
        avatar: d.avatar,
        username: d.username
      };
      uMap[u] = { fullName: d.fullName, avatar: d.avatar || defAvi(d.fullName) };
    });
  } else {
  }

  // Like status cache dan foydalanish (local va Firestore postlar alohida collection)
  const unknownPosts = posts.filter(p => !state.myLikedPosts.has(p.id) && !state._knownUnliked.has(p.id));
  if (unknownPosts.length) {
    let likedRows = null;
    try {
      const { data, error } = await sb.from('post_likes').select('post_id')
        .eq('user_id', state.me.uid).in('post_id', unknownPosts.map(p => p.id));
      if (!error) likedRows = new Set((data || []).map(r => r.post_id));
    } catch (e) { console.warn('[feed]', e?.message || e); }
    if (likedRows) {
      unknownPosts.forEach(p => {
        if (likedRows.has(p.id)) state.myLikedPosts.add(p.id);
        else state._knownUnliked.add(p.id);
      });
    }
  }
  const likedSet = new Set(posts.filter(p => state.myLikedPosts.has(p.id)).map(p => p.id));

  // Multi-Supabase: Har bir post uchun mediaUrl yaratish (backward compatibility)
  await Promise.all(posts.map(async p => {
    if (!p.mediaUrl && (p.mediaPath || p.storageIndex)) {
      p.mediaUrl = await getMediaUrl(p);
    }
  }));

  // commentCount ni post documentidan olish
  const cMap = {};
  // Post objectidagi ma'lumotni ishlatamiz (har render'da Firestore o'qish o'rniga — RAM dan)
  posts.forEach(p => { cMap[p.id] = p.commentCount ?? 0; });

  let html = '';
  for (const p of posts) {
    const u        = uMap[p.userId] || {};
    const liked    = likedSet.has(p.id);
    const canDel   = state.me.uid === p.userId || isAdmin();
    const isMine   = state.me.uid === p.userId;

    html += `<div class="post" data-id="${p.id}">
      <div class="avi user-avi-btn" data-uid="${p.userId}"><img src="${u.avatar}" onerror="this.style.display='none'"></div>
      <div class="post-main">
        <div class="post-head">
          <div class="post-meta user-avi-btn" data-uid="${p.userId}">
            <span class="post-name">${esc(u.fullName||'Noma\'lum')}</span>
            ${u.username ? `<span class="post-user">@${esc(u.username)}</span>` : ''}
            <span class="post-dot">·</span>
            <span class="post-time">${fmt(p.createdAt)}</span>
          </div>

        </div>
        ${buildCaption(p.text, p.id)}
        ${buildMedia(p)}
        <div class="post-actions">
          <button class="act-btn cmt-open-btn" data-id="${p.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
            <span id="cc-${p.id}">${fmtCount(cMap[p.id] || 0)}</span>
          </button>
          <button class="act-btn like-btn${liked?' liked':''}" data-id="${p.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${liked?'#f04060':'none'}" stroke="${liked?'#f04060':'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
            <span id="lc-${p.id}">${fmtCount(p.likes || 0)}</span>
          </button>
          <button class="act-btn share-btn"
            data-id="${p.id}"
            data-url="${p.mediaUrl ? esc(p.mediaUrl) : ''}"
            data-private="${!p.isPublic ? '1' : '0'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          </button>
        </div>
      </div>
    </div>`;
  }

  feedEl.innerHTML = html;
  bindFeedEvents(feedEl);
}

/* ── Auto-play videos on scroll ──────────────────────────────────────── */
export function setupFeedVideoObs(feedEl) {
  if (state.feedVidObs) state.feedVidObs.disconnect();
  state.feedVidObs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const wrap = en.target;
      const vid  = wrap.querySelector('video');
      if (!vid) return;
      if (en.isIntersecting && en.intersectionRatio >= 0.5) {
        vid.muted = state.globalMuted;
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    });
  }, { threshold: 0.5 });
  feedEl.querySelectorAll('.vid-wrap').forEach(w => state.feedVidObs.observe(w));
}

/* ── Share popup ─────────────────────────────────────────────────────── */
function _injectShareCSS() {
  if (document.getElementById('share-popup-css')) return;
  const s = document.createElement('style');
  s.id = 'share-popup-css';
  s.textContent = `
.share-popup-overlay {
  position: fixed; inset: 0; z-index: 9990;
}
.share-popup {
  position: fixed; z-index: 9991;
  background: var(--bg2, #242424);
  border: 1px solid color-mix(in srgb, var(--blue, #ffffff) 25%, transparent);
  border-radius: 16px;
  padding: 6px;
  min-width: 210px;
  box-shadow: 0 8px 32px rgba(0, 0, 0,.45), 0 0 0 1px rgba(255,255,255,.04);
  transform-origin: top center;
}
.share-popup-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  border-radius: 11px;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--text, #fff);
  font-weight: 500;

  user-select: none;
}
.share-popup-row:hover { background: color-mix(in srgb, var(--blue, #ffffff) 14%, transparent); }
.share-popup-row:active { background: color-mix(in srgb, var(--blue, #ffffff) 22%, transparent); }
.share-popup-icon { color: var(--blue, #ffffff); flex-shrink: 0; display: flex; align-items: center; }
.share-popup-divider { height: 1px; margin: 2px 10px; background: color-mix(in srgb, var(--border, #fff) 12%, transparent); }

/* ── Post highlight glow ── */
.post-highlight {
  border-radius: 18px;

}
`;
  document.head.appendChild(s);
}

let _sharePopupEl = null;
let _shareOverlayEl = null;

function _closeSharePopup() {
  if (_sharePopupEl) {
    _sharePopupEl.remove(); _sharePopupEl = null;
  }
  if (_shareOverlayEl) { _shareOverlayEl.remove(); _shareOverlayEl = null; }
}

function showSharePopup(btn) {
  _injectShareCSS();
  _closeSharePopup();

  const postId   = btn.dataset.id;
  const mediaUrl = btn.dataset.url;
  const isPrivate = btn.dataset.private === '1';

  // Agar private va media yo'q → hech narsa qilamiz
  if (isPrivate && !mediaUrl) {
    toast('Bu post private — ulashish imkonsiz', 'error');
    return;
  }

  // Agar private → auto nusxa media link
  if (isPrivate) {
    navigator.clipboard?.writeText(mediaUrl);
    toast('Fayl havolasi nusxalandi', 'info');
    return;
  }

  // Public post — popup ko'rsatamiz
  const overlay = document.createElement('div');
  overlay.className = 'share-popup-overlay';
  overlay.addEventListener('click', _closeSharePopup);
  document.body.appendChild(overlay);
  _shareOverlayEl = overlay;

  const popup = document.createElement('div');
  popup.className = 'share-popup';

  const rows = [];

  if (mediaUrl) {
    rows.push({ icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`, label: 'Fayl havolasi', action: () => {
      navigator.clipboard?.writeText(mediaUrl);
      toast('Fayl havolasi nusxalandi', 'info');
      _closeSharePopup();
    }});
  }

  if (!isPrivate) {
    rows.push({ icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`, label: 'Post havolasi', action: () => {
      const postUrl = window.location.origin + window.location.pathname + '#post-' + postId;
      navigator.clipboard?.writeText(postUrl);
      toast('Post havolasi nusxalandi', 'info');
      _closeSharePopup();
    }});
  }

  popup.innerHTML = rows.map((r, i) => `
    ${i > 0 ? '<div class="share-popup-divider"></div>' : ''}
    <div class="share-popup-row" data-idx="${i}">
      <span class="share-popup-icon">${r.icon}</span>
      <span>${r.label}</span>
    </div>
  `).join('');

  document.body.appendChild(popup);
  _sharePopupEl = popup;

  // Position popup above/below the button
  const rect = btn.getBoundingClientRect();
  const popW = 220;
  let left = rect.left + rect.width / 2 - popW / 2;
  let top  = rect.top - 8;
  // Clamp horizontal
  left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
  // Show above or below
  const popH = rows.length * 48 + 20;
  if (top - popH < 8) top = rect.bottom + 8;
  else top = top - popH;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
  popup.style.width = popW + 'px';

  popup.querySelectorAll('.share-popup-row').forEach(row => {
    row.addEventListener('click', (e) => { e.stopPropagation(); rows[+row.dataset.idx].action(); });
  });
}

/* ── Scroll to post by URL hash ──────────────────────────────────────── */
export function scrollToPostFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith('#post-')) return;
  const postId = hash.slice(6);

  let attempts = 0;
  const tryScroll = () => {
    const el = document.querySelector(`.post[data-id="${postId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
      // Glow / flash effect
      el.classList.add('post-highlight');
      setTimeout(() => el.classList.remove('post-highlight'), 2200);
      return;
    }
    // Post hali DOM'da yo'q (masalan, postlar hali yuklanmoqda) — bir necha
    // marta qayta urinib ko'ramiz, shunda ulashilgan link boshqa odamda ham ishlaydi
    attempts++;
    if (attempts < 8) setTimeout(tryScroll, 400);
  };
  setTimeout(tryScroll, 500);
}

function bindFeedEvents(feedEl) {
  feedEl.querySelectorAll('.vid-wrap').forEach(w => initVidWrap(w));
  feedEl.querySelectorAll('.like-btn').forEach(b => b.addEventListener('click', () => doLike(b.dataset.id, b)));

  feedEl.querySelectorAll('.cmt-open-btn').forEach(b => b.addEventListener('click', async () => {
    const { openCmtModal } = await import('./comments.js');
    openCmtModal(b.dataset.id);
  }));
  feedEl.querySelectorAll('.share-btn').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    showSharePopup(b);
  }));
  feedEl.querySelectorAll('.post-media').forEach(m => m.addEventListener('click', async e => {
    if (e.target.closest('.file-dl')) return;
    if (e.target.closest('.vid-controls') || e.target.closest('.vc-progress')) return;
    // Open media in zoom modal
    const { openMediaInModal } = await import('./ui.js');
    openMediaInModal(m.dataset.id);
  }));
  feedEl.querySelectorAll('.user-avi-btn').forEach(b => b.addEventListener('click', async () => {
    if (b.dataset.uid !== state.me?.uid) {
      const { openUserProfileModal } = await import('./profile.js');
      openUserProfileModal(b.dataset.uid);
    }
  }));
  feedEl.querySelectorAll('.file-dl').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    dlFile(b.dataset.url, b.dataset.name);
  }));
  // Fayl post (rasm/video bo'lmagan, lekin fayl biriktirilgan post) ustiga
  // bosilganda — faylning havolasini (Supabase url) yangi tabda ochamiz.
  // Matnli (fayl yuklanmagan) postlarda .file-card umuman render qilinmaydi,
  // shu sababli bu shart avtomatik ravishda faqat fayl yuklangan postlarga tegishli.
  feedEl.querySelectorAll('.file-card').forEach(card => card.addEventListener('click', e => {
    if (e.target.closest('.file-dl')) return; // "Yuklab olish" tugmasi o'z vazifasini bajaradi
    const url = card.dataset.url;
    if (url) window.open(url, '_blank', 'noopener');
  }));
  feedEl.querySelectorAll('.cap-more').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const cap = btn.closest('.post-caption');
      cap.classList.toggle('cap-collapsed');
      cap.classList.toggle('cap-expanded');
    });
  });
  setupFeedVideoObs(feedEl);
}

/* ── Like ────────────────────────────────────────────────────────────── */
export async function doLike(postId, btn) {
  if (!state.me) return;
  const wasLiked = state.myLikedPosts.has(postId);
  const post     = state.allPosts.find(p => p.id === postId);
  const cur      = post?.likes || 0;
  const svg      = btn.querySelector('svg');
  const lc       = document.getElementById(`lc-${postId}`);

  if (wasLiked) {
    state.myLikedPosts.delete(postId);
    state._knownUnliked.add(postId);
    btn.classList.remove('liked');
    svg?.setAttribute('fill','none'); svg?.setAttribute('stroke','currentColor');
    if (lc) lc.textContent = fmtCount(Math.max(0,cur-1));
    if (post) post.likes = Math.max(0, cur-1);
  } else {
    state.myLikedPosts.add(postId);
    state._knownUnliked.delete(postId);
    btn.classList.add('liked');
    svg?.setAttribute('fill','#f04060'); svg?.setAttribute('stroke','#f04060');
    if (lc) lc.textContent = fmtCount(cur+1);
    if (post) post.likes = cur + 1;
    btn.classList.add('like-pop');
    setTimeout(() => btn.classList.remove('like-pop'), 400);
  }

  // Boshqalarga shu zahoti (DB trigger/postgres_changes kutilmaydi)
  busEmit('like', { postId, n: post?.likes ?? (wasLiked ? Math.max(0, cur-1) : cur+1), on: !wasLiked });

  // Like sonini DB trigger yangilaydi (post_likes → posts.likes_count)
  try {
    if (wasLiked) {
      const { error } = await sb.from('post_likes').delete()
        .eq('post_id', postId).eq('user_id', state.me.uid);
      if (error) throw error;
    } else {
      const { error } = await sb.from('post_likes')
        .insert({ post_id: postId, user_id: state.me.uid });
      if (error && error.code !== '23505') throw error; // 23505 = allaqachon like
    }
  } catch (err) {
    console.warn('[Feed] Like saqlanmadi:', err?.message);
  }
}

/* ── Delete ──────────────────────────────────────────────────────────── */
export async function doDelete(id) {
  // Confirm card yo'q — to'g'ridan-to'g'ri o'chiradi (faqat profil detail dan)
  const post = state.allPosts?.find(p => p.id === id);
  if (!post) return;
  if (post.userId !== state.me?.uid && !isAdmin()) {
    toast("Faqat o'z postingizni o'chira olasiz", 'error');
    return;
  }
  const { error } = await sb.from('posts').delete().eq('id', id);
  if (error) { toast("O'chirib bo'lmadi: " + error.message, 'error'); return; }
  if (post?.mediaPath) sb.storage.from(MEDIA_BUCKET).remove([post.mediaPath]).catch(() => {});
  state.allPosts = state.allPosts.filter(p => p.id !== id);
  document.querySelector(`.post[data-id="${id}"]`)?.remove();
  document.querySelector(`.grid-cell[data-id="${id}"]`)?.remove();
  busEmit('post', { op: 'del', id });
  toast("Post o'chirildi", 'success');
  document.dispatchEvent(new CustomEvent('postsUpdated'));
}
/* ── Keyboard Controls ───────────────────────────────────────────────── */
/* ── patchCounts — update numbers without full re-render ─────────────── */
export function patchCounts(posts) {
  posts.forEach(p => {
    // Like count
    const lc = document.getElementById(`lc-${p.id}`);
    if (lc) lc.textContent = fmtCount(p.likes || 0);

    const rlc = document.querySelector(`.rlc-${p.id}`);
    if (rlc) rlc.textContent = `${p.likes || 0}`;

    // Comment count
    const cc = document.getElementById(`cc-${p.id}`);
    if (cc) cc.textContent = fmtCount(p.commentCount || 0);

    const rcc = document.querySelector(`.rcmt-${p.id}`);
    if (rcc) rcc.textContent = `${p.commentCount || 0}`;

  });
}

/* ── Birinchi render da spinner ──────────────────────────── */
let _feedFirstRender = true;
let _hashPostHandled = false; // link orqali kelingan postni faqat bir marta moslashtiramiz

/* ── renderFeed ────────────────────────────────────────────────────── */
export async function renderFeed() {
  if (!state.me) return;
  const feedEl = $('feed');

  // URL'da #post-<id> hash bo'lsa (masalan, "Havolani nusxalash" orqali
  // ulashilgan link), lekin o'sha post visibleN chegarasidan tashqarida
  // (ya'ni feedning pastida) bo'lsa — u hali render qilinmagan bo'ladi va
  // pastdagi scrollToPostFromHash uni topa olmay, sukut bilan hech narsa
  // qilmaydi. Shuning uchun avval postni filtered() ro'yxatida topib,
  // kerak bo'lsa visibleN ni shu postgacha (+bir oz zaxira) oshiramiz.
  if (!_hashPostHandled && window.location.hash.startsWith('#post-')) {
    const hashId = window.location.hash.slice(6);
    const all = filtered();
    const idx = all.findIndex(p => String(p.id) === String(hashId));
    if (idx !== -1) {
      if (idx >= state.visibleN) state.visibleN = Math.min(idx + 10, all.length);
      _hashPostHandled = true;
    }
    // idx === -1 bo'lsa — postlar hali to'liq yuklanmagan bo'lishi mumkin,
    // _hashPostHandled true qilinmaydi va keyingi renderFeed chaqirilganda
    // (allPosts to'liq kelganda) qayta urinib ko'riladi.
  }

  const posts  = filtered().slice(0, state.visibleN);

  // Birinchi renderda spinner
  if (_feedFirstRender && !feedEl.querySelector('.post')) {
    feedEl.innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
  }
  _feedFirstRender = false;

  await renderFeedTo(feedEl, posts);

  // URL hash da post id bo'lsa — o'sha postga smooth scroll
  if (window.location.hash.startsWith('#post-')) scrollToPostFromHash();

  if (state.visibleN < filtered().length) {
    feedEl.insertAdjacentHTML('beforeend', '<div class="spin-wrap"><div class="spinner"></div></div>');
  }
  setupScroll();
}

function setupScroll() {
  window.onscroll = () => {
    const maxN = filtered().length;
    if (state.loadingMore || state.visibleN >= maxN) return;
    if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 400) {
      state.loadingMore = true;
      setTimeout(async () => {
        const prevN = state.visibleN;
        state.visibleN = Math.min(prevN + 10, maxN);
        state.loadingMore = false;
        if (state.view !== 'home') return;

        const feedEl = $('feed');
        if (!feedEl) return;

        // Spinner'ni olib tashlaymiz
        feedEl.querySelector('.spin-wrap')?.remove();

        // Faqat yangi postlarni qo'shamiz (butun feed'ni qayta yozmaymiz)
        const newPosts = filtered().slice(prevN, state.visibleN);
        if (newPosts.length > 0) {
          await appendPostsToFeed(feedEl, newPosts);
        }

        if (state.visibleN < filtered().length) {
          feedEl.insertAdjacentHTML('beforeend', '<div class="spin-wrap"><div class="spinner"></div></div>');
        }
      }, 300);
    }
  };
}
/* ── FIX: setupPullToRefresh ─────────────────── */
export function setupPullToRefresh() {
    const homeView = document.getElementById('homeView');
    if (!homeView || homeView._ptrReady) return;
    homeView._ptrReady = true;

    let startY    = 0;
    let isPulling = false;
    let distance  = 0;

    homeView.addEventListener('touchstart', e => {
        if (window.scrollY <= 5) {
            startY    = e.touches[0].clientY;
            isPulling = true;
            distance  = 0;
        }
    }, { passive: true });

    homeView.addEventListener('touchmove', e => {
        if (!isPulling) return;
        distance = e.touches[0].clientY - startY;
    }, { passive: true });

    homeView.addEventListener('touchend', async () => {
        if (isPulling && distance > 130) {
            await renderFeed();
            try { const { loadStories } = await import('./stories.js'); await loadStories(); } catch (_) {}
            toast('Yangilandi', 'success', 1200);
        }
        isPulling = false;
        distance  = 0;
    });
}

/* ── Feed scroll: native scroll ishlatiladi (silliq, momentum bilan) ── */
export function setupFeedScrollSensitivity() {
    // Native browser scroll intentionally used — no override needed.
    // Custom touchmove override was causing janky scroll on iOS/Android.
}