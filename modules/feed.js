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
      <div class="post-head">
        <div class="avi user-avi-btn" data-uid="${p.userId}"><img src="${u.avatar}" onerror="this.style.display='none'"></div>
        <div class="post-meta user-avi-btn" data-uid="${p.userId}">
          <span class="post-name">${esc(u.fullName||'Noma\'lum')}</span>
          ${u.username ? `<span class="post-user">@${esc(u.username)}</span>` : ''}
          <span class="post-dot">·</span>
          <span class="post-time">${fmt(p.createdAt)}</span>
        </div>
        ${canDel ? `<button class="del-btn post-del-btn" data-id="${p.id}" title="O'chirish" aria-label="O'chirish">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
          </svg></button>` : ''}
      </div>
      <div class="post-main">
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
            title="Chatga ulashish"
            aria-label="Chatga ulashish">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
          <button class="act-btn link-btn"
            data-id="${p.id}"
            title="Havolani nusxalash"
            aria-label="Havolani nusxalash">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M8 7C5.23858 7 3 9.23858 3 12C3 14.7614 5.23858 17 8 17H10C10.5523 17 11 17.4477 11 18C11 18.5523 10.5523 19 10 19H8C4.13401 19 1 15.866 1 12C1 8.13401 4.13401 5 8 5H10C10.5523 5 11 5.44772 11 6C11 6.55228 10.5523 7 10 7H8ZM13 6C13 5.44772 13.4477 5 14 5H16C19.866 5 23 8.13401 23 12C23 15.866 19.866 19 16 19H14C13.4477 19 13 18.5523 13 18C13 17.4477 13.4477 17 14 17H16C18.7614 17 21 14.7614 21 12C21 9.23858 18.7614 7 16 7H14C13.4477 7 13 6.55228 13 6ZM7 12C7 11.4477 7.44772 11 8 11H16C16.5523 11 17 11.4477 17 12C17 12.5523 16.5523 13 16 13H8C7.44772 13 7 12.5523 7 12Z"/>
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

/* ── Init: URL'dan kelgan post id ni saqlab qo'yamiz (login qilmagan bo'lsa ham yo'qolmasligi uchun) ── */
try {
  const hash = window.location.hash || '';
  let initPostId = null;
  if (hash.startsWith('#post-')) initPostId = hash.slice(6);
  if (!initPostId) {
    const p = new URLSearchParams(window.location.search).get('post');
    if (p) initPostId = p;
  }
  if (initPostId) {
    sessionStorage.setItem('target_post_id', initPostId);
  }
} catch (_) {}

export async function copyPostLink(postId) {
  if (!postId) return;
  const postUrl = `${window.location.origin}/#post-${postId}`;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(postUrl);
    } else {
      const ta = document.createElement('textarea');
      ta.value = postUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Havola nusxalandi', 'info');
  } catch (_) {
    toast('Havola nusxalandi', 'info');
  }
}

export async function sharePostToChat(postId) {
  if (!postId || !state.me) return;
  const post = state.allPosts?.find(p => p.id === postId);
  const postEl = document.querySelector(`.post[data-id="${postId}"]`);

  const authorName = postEl?.querySelector('.post-name')?.textContent || '';
  const authorUsername = postEl?.querySelector('.post-user')?.textContent?.replace(/^@/, '') || '';
  const authorAvatar = postEl?.querySelector('.post-head .avi img')?.src || '';
  const postText = postEl?.querySelector('.post-caption')?.textContent || post?.text || '';
  const postMediaEl = postEl?.querySelector('.post-media');
  const mediaImg = postMediaEl?.querySelector('img')?.src || '';
  const mediaVid = postMediaEl?.querySelector('video')?.src || '';
  const mediaUrl = post?.mediaUrl || mediaImg || mediaVid || '';
  const mediaType = post?.mediaType || (mediaVid ? 'video' : (mediaImg ? 'image' : null));

  const payload = {
    id: postId,
    userId: post?.userId || postEl?.querySelector('.user-avi-btn')?.dataset.uid || '',
    authorName: authorName || 'Noma\'lum',
    authorUsername: authorUsername || '',
    authorAvatar: authorAvatar || '',
    text: (post?.text || postText || '').trim(),
    mediaUrl: mediaUrl,
    mediaType: mediaType,
    createdAt: post?.createdAt || Date.now()
  };

  const { setPendingPostShare } = await import('./chat.js');
  setPendingPostShare(payload);
  const { navigateTo } = await import('./router.js');
  navigateTo('chats');
  toast("Post biriktirildi. Suhbat yoki guruhni tanlang", "info");
}

export function getTargetPostId() {
  const hash = window.location.hash || '';
  if (hash.startsWith('#post-')) return hash.slice(6);
  try {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('post');
    if (p) return p;
  } catch (_) {}
  return sessionStorage.getItem('target_post_id') || null;
}

let _scrolledTargetId = null;

/* ── Scroll to post by URL hash or query (faqat login qilgan userlar uchun) ── */
export function scrollToPostFromHash() {
  if (!state.me?.uid) return;
  const targetId = getTargetPostId();
  if (!targetId || _scrolledTargetId === targetId) return;

  let attempts = 0;
  const tryScroll = async () => {
    let el = document.querySelector(`.post[data-id="${targetId}"]`);
    if (el) {
      _scrolledTargetId = targetId;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 3 sekund tagidan ko'k rang yonib turib keyin o'chadi
      el.classList.add('post-link-highlight');
      try {
        if (window.location.hash.startsWith('#post-')) {
          history.replaceState(null, '', window.location.pathname);
        }
      } catch (_) {}
      setTimeout(() => {
        el.classList.remove('post-link-highlight');
        sessionStorage.removeItem('target_post_id');
      }, 3000);
      return;
    }

    if (attempts === 2) {
      try {
        const { data: postRow } = await sb.from('posts').select('*').eq('id', targetId).maybeSingle();
        if (postRow) {
          const p = mapPost(postRow);
          if (!state.allPosts.some(x => x.id === p.id)) {
            state.allPosts.unshift(p);
            await renderFeed();
            return;
          }
        }
      } catch (_) {}
    }

    attempts++;
    if (attempts < 12) setTimeout(tryScroll, 300);
  };
  setTimeout(tryScroll, 250);
}

function bindFeedEvents(feedEl) {
  feedEl.querySelectorAll('.vid-wrap').forEach(w => initVidWrap(w));
  feedEl.querySelectorAll('.like-btn').forEach(b => b.addEventListener('click', () => doLike(b.dataset.id, b)));

  feedEl.querySelectorAll('.cmt-open-btn').forEach(b => b.addEventListener('click', async () => {
    const { openCmtModal } = await import('./comments.js');
    openCmtModal(b.dataset.id);
  }));
  feedEl.querySelectorAll('.link-btn').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    copyPostLink(b.dataset.id);
  }));
  feedEl.querySelectorAll('.share-btn').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    sharePostToChat(b.dataset.id);
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
  feedEl.querySelectorAll('.post-del-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await doDelete(btn.dataset.id);
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
  const targetId = getTargetPostId();
  if (!_hashPostHandled && targetId) {
    const all = filtered();
    const idx = all.findIndex(p => String(p.id) === String(targetId));
    if (idx !== -1) {
      if (idx >= state.visibleN) state.visibleN = Math.min(idx + 10, all.length);
      _hashPostHandled = true;
    }
  }

  const posts  = filtered().slice(0, state.visibleN);

  // Birinchi renderda spinner
  if (_feedFirstRender && !feedEl.querySelector('.post')) {
    feedEl.innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
  }
  _feedFirstRender = false;

  await renderFeedTo(feedEl, posts);

  // URL hash yoki query da post id bo'lsa — o'sha postga smooth scroll va ko'k yonish
  if (targetId) scrollToPostFromHash();

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