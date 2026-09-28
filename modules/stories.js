/**
 * Stories — Instagram uslubida 24 soatlik hikoyalar.
 * Feed yuqorisida horizontal strip (mobile + desktop).
 */
import { sb, state, mapProfile, mediaPublicUrl, uploadViaController } from './config.js';
import { $, esc, defAvi } from './utils.js';
import { toast } from './toast.js';

const STORY_MS = 5000; // har bir story ko'rsatish muddati

/** @type {{ uid: string, name: string, avatar: string, items: any[], hasUnseen: boolean }[]} */
let _groups = [];
let _viewerIdx = 0;   // guruh indeksi
let _itemIdx = 0;     // guruh ichidagi story
let _timer = null;
let _progressRaf = null;
let _startedAt = 0;
let _paused = false;
let _bound = false;


function ensureStoriesCss() {
  if (document.getElementById('stories-bar-css')) return;
  const s = document.createElement('style');
  s.id = 'stories-bar-css';
  s.textContent = `
.stories-bar {
  display: block;
  width: 100%;
  padding: 10px 0 6px;
  border-bottom: 1px solid var(--line);
  background: var(--bg);
  position: relative;
  z-index: 2;
}
.stories-track {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 12px 8px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.stories-track::-webkit-scrollbar { display: none; }
.story-item {
  flex: 0 0 auto;
  width: 72px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-family: var(--font);
  position: relative;
}
.story-item--skel {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--bg3); opacity: 0.6;
}
.story-ring {
  width: 64px; height: 64px; border-radius: 50%;
  padding: 2px;
  display: grid; place-items: center;
  position: relative;
  background: var(--bg3);
}
.story-ring--new {
  background: linear-gradient(135deg, #f59e0b, #ec4899 55%, #8b5cf6);
}
.story-ring--seen { background: var(--line2, #333); }
.story-ring--add { background: var(--bg3); border: 1px dashed var(--line2); }
.story-ring img, .story-ring > img {
  width: 56px; height: 56px; border-radius: 50%; object-fit: cover;
  background: var(--bg2);
}
.story-plus {
  position: absolute; right: -2px; bottom: -2px;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--blue, #1d9bf0); color: #fff;
  font-size: 16px; line-height: 18px; text-align: center;
  border: 2px solid var(--bg);
  z-index: 2;
  pointer-events: auto;
  box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600;
}
.story-label {
  font-size: 11px; max-width: 72px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; color: var(--text2);
}
.story-viewer {
  position: fixed; inset: 0; z-index: 9999;
  background: #000; display: flex; flex-direction: column;
}
.story-viewer[hidden] { display: none !important; }
`;
  document.head.appendChild(s);
}

function ensureDom() {
  ensureStoriesCss();
  if ($('storiesBar')) return;
  const home = $('homeView');
  if (!home) return;

  const bar = document.createElement('div');
  bar.id = 'storiesBar';
  bar.className = 'stories-bar';
  bar.innerHTML = `<div class="stories-track" id="storiesTrack"></div>`;

  // feed dan oldin joylashtirish
  const feed = $('feed');
  if (feed) home.insertBefore(bar, feed);
  else home.prepend(bar);

  // Viewer overlay (body ga)
  if (!$('storyViewer')) {
    const v = document.createElement('div');
    v.id = 'storyViewer';
    v.className = 'story-viewer';
    v.hidden = true;
    v.innerHTML = `
      <div class="sv-progress" id="svProgress"></div>
      <div class="sv-top">
        <div class="sv-user">
          <div class="sv-avi" id="svAvi"></div>
          <div class="sv-meta">
            <div class="sv-name" id="svName"></div>
            <div class="sv-time" id="svTime"></div>
          </div>
        </div>
        <button type="button" class="sv-close" id="svClose" aria-label="Yopish">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="sv-media" id="svMedia"></div>
      <div class="sv-nav sv-prev" id="svPrev"></div>
      <div class="sv-nav sv-next" id="svNext"></div>
    `;
    document.body.appendChild(v);
  }

  // Hidden file input for creating story
  if (!$('storyFileInput')) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.id = 'storyFileInput';
    inp.accept = 'image/*,video/*';
    inp.hidden = true;
    document.body.appendChild(inp);
    inp.addEventListener('change', onStoryFilePicked);
  }

  if (!_bound) {
    _bound = true;
    $('svClose')?.addEventListener('click', closeViewer);
    $('svPrev')?.addEventListener('click', () => step(-1));
    $('svNext')?.addEventListener('click', () => step(1));
    $('storyViewer')?.addEventListener('click', e => {
      if (e.target === $('storyViewer')) closeViewer();
    });
    // Touch pause
    const media = () => $('svMedia');
    document.addEventListener('keydown', e => {
      if ($('storyViewer')?.hidden) return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
  }
}

function fmtAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'hozir';
  if (sec < 3600) return Math.floor(sec / 60) + ' daqiqa';
  if (sec < 86400) return Math.floor(sec / 3600) + ' soat';
  return Math.floor(sec / 86400) + ' kun';
}

export async function loadStories() {
  ensureDom();
  const track = $('storiesTrack');
  if (!track || !state.me?.uid) return;

  track.innerHTML = `<div class="story-item story-item--skel"></div>`.repeat(5);

  try {
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await sb.from('stories')
      .select('id, user_id, media_path, media_type, created_at, expires_at')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const stories = rows || [];
    const uids = [...new Set(stories.map(s => s.user_id))];
    if (state.me?.uid && !uids.includes(state.me.uid)) uids.push(state.me.uid);

    let profiles = [];
    if (uids.length) {
      const { data: pr } = await sb.from('profiles')
        .select('id, full_name, username, avatar')
        .in('id', uids);
      profiles = (pr || []).map(mapProfile);
    }
    const pMap = Object.fromEntries(profiles.map(p => [p.uid, p]));

    // Viewed set
    let viewed = new Set();
    if (stories.length && state.me?.uid) {
      const ids = stories.map(s => s.id);
      const { data: vv } = await sb.from('story_views')
        .select('story_id')
        .eq('user_id', state.me.uid)
        .in('story_id', ids);
      (vv || []).forEach(v => viewed.add(v.story_id));
    }

    // Group by user
    const byUser = new Map();
    for (const s of stories) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id).push({
        id: s.id,
        mediaPath: s.media_path,
        mediaType: s.media_type || 'image',
        mediaUrl: mediaPublicUrl(s.media_path),
        createdAt: s.created_at,
        seen: viewed.has(s.id),
      });
    }

    const me = state.me.uid;
    const groups = [];

    // Own first
    const myItems = byUser.get(me) || [];
    const meP = pMap[me] || {};
    groups.push({
      uid: me,
      name: 'Sizning story',
      avatar: meP.avatar || defAvi(meP.fullName || 'U'),
      items: myItems,
      hasUnseen: myItems.some(i => !i.seen),
      isMe: true,
    });

    // Others: unseen first, then seen
    const others = [...byUser.keys()].filter(u => u !== me).map(uid => {
      const items = byUser.get(uid) || [];
      const p = pMap[uid] || {};
      return {
        uid,
        name: p.fullName || p.username || 'Foydalanuvchi',
        avatar: p.avatar || defAvi(p.fullName || '?'),
        items,
        hasUnseen: items.some(i => !i.seen),
        isMe: false,
      };
    });
    others.sort((a, b) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0));
    groups.push(...others.filter(g => g.items.length > 0));

    _groups = groups;
    renderBar();
  } catch (e) {
    console.warn('[stories]', e?.message || e);
    // Jadval yo'q bo'lsa ham "Sizning story" ko'rsatamiz
    const meP = state._userCache?.[state.me.uid] || {};
    _groups = [{
      uid: state.me.uid,
      name: 'Sizning story',
      avatar: meP.avatar || defAvi(meP.fullName || 'U'),
      items: [],
      hasUnseen: false,
      isMe: true,
    }];
    renderBar();
  }
}

function renderBar() {
  const track = $('storiesTrack');
  if (!track) return;

  track.innerHTML = _groups.map((g, i) => {
    const ring = g.isMe && !g.items.length
      ? 'story-ring story-ring--add'
      : (g.hasUnseen ? 'story-ring story-ring--new' : 'story-ring story-ring--seen');
    const plus = g.isMe
      ? `<span class="story-plus" aria-hidden="true">+</span>`
      : '';
    return `<button type="button" class="story-item" data-idx="${i}" title="${esc(g.name)}">
      <div class="${ring}">
        <img src="${esc(g.avatar)}" alt="" onerror="this.style.display='none'">
        ${plus}
      </div>
      <span class="story-label">${esc(g.isMe ? (g.items.length ? 'Sizning story' : 'Story qo\'shish') : g.name.split(' ')[0])}</span>
    </button>`;
  }).join('');

  track.querySelectorAll('.story-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.idx;
      const g = _groups[idx];
      if (!g) return;
      if (g.isMe && !g.items.length) {
        $('storyFileInput')?.click();
        return;
      }
      if (g.isMe && g.items.length) {
        // long-press style: if click plus area — add; else view
        // Simple: click opens viewer; to add, use the empty state or double-tap plus
        openViewer(idx, 0);
        return;
      }
      openViewer(idx, g.items.findIndex(it => !it.seen));
    });
  });

  // Me with items: also allow add via long-press on plus — add small add chip
  const meBtn = track.querySelector('.story-item[data-idx="0"]');
  if (meBtn && _groups[0]?.items?.length) {
    meBtn.querySelector('.story-plus')?.addEventListener('click', e => {
      e.stopPropagation();
      $('storyFileInput')?.click();
    });
  }
}

async function onStoryFilePicked(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !state.me) return;
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    toast('Faqat rasm yoki video', 'error');
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    toast('Fayl juda katta (max 30MB)', 'error');
    return;
  }
  try {
    toast('Yuklanmoqda...', 'info');
    const { path } = await uploadViaController(file, 'stories');
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { error } = await sb.from('stories').insert({
      user_id: state.me.uid,
      media_path: path,
      media_type: mediaType,
      expires_at: expires,
    });
    if (error) throw error;
    toast('Story qo\'shildi', 'success');
    await loadStories();
  } catch (err) {
    console.error(err);
    toast('Story yuklanmadi: ' + (err.message || err), 'error');
  }
}

function openViewer(groupIdx, itemIdx) {
  if (!_groups[groupIdx]?.items?.length) return;
  _viewerIdx = groupIdx;
  _itemIdx = Math.max(0, itemIdx < 0 ? 0 : itemIdx);
  const v = $('storyViewer');
  if (!v) return;
  v.hidden = false;
  document.body.style.overflow = 'hidden';
  showCurrent();
}

function closeViewer() {
  clearTimeout(_timer);
  cancelAnimationFrame(_progressRaf);
  const v = $('storyViewer');
  if (v) v.hidden = true;
  document.body.style.overflow = '';
  const media = $('svMedia');
  if (media) {
    media.querySelector('video')?.pause();
    media.innerHTML = '';
  }
  loadStories(); // ringlarni yangilash
}

function buildProgress(n, active, ratio) {
  const el = $('svProgress');
  if (!el) return;
  el.innerHTML = Array.from({ length: n }, (_, i) => {
    let w = '0%';
    if (i < active) w = '100%';
    else if (i === active) w = Math.round(ratio * 100) + '%';
    return `<div class="sv-seg"><div class="sv-seg-fill" style="width:${w}"></div></div>`;
  }).join('');
}

async function showCurrent() {
  clearTimeout(_timer);
  cancelAnimationFrame(_progressRaf);
  _paused = false;

  const g = _groups[_viewerIdx];
  if (!g || !g.items.length) { closeViewer(); return; }
  if (_itemIdx >= g.items.length) {
    // next group
    if (_viewerIdx + 1 < _groups.length && _groups[_viewerIdx + 1].items.length) {
      _viewerIdx++;
      _itemIdx = 0;
      return showCurrent();
    }
    closeViewer();
    return;
  }
  if (_itemIdx < 0) {
    if (_viewerIdx > 0) {
      _viewerIdx--;
      _itemIdx = _groups[_viewerIdx].items.length - 1;
      return showCurrent();
    }
    _itemIdx = 0;
  }

  const item = g.items[_itemIdx];
  $('svName').textContent = g.name;
  $('svTime').textContent = fmtAgo(item.createdAt);
  $('svAvi').innerHTML = `<img src="${esc(g.avatar)}" alt="" onerror="this.style.display='none'">`;

  const media = $('svMedia');
  media.innerHTML = '';
  let duration = STORY_MS;

  if (item.mediaType === 'video' || (item.mediaUrl || '').match(/\.mp4|webm|mov/i)) {
    const vid = document.createElement('video');
    vid.src = item.mediaUrl;
    vid.playsInline = true;
    vid.autoplay = true;
    vid.muted = false;
    vid.setAttribute('playsinline', '');
    media.appendChild(vid);
    await new Promise(res => {
      vid.onloadedmetadata = () => {
        duration = Math.min(15000, Math.max(3000, (vid.duration || 5) * 1000));
        res();
      };
      vid.onerror = res;
      setTimeout(res, 2000);
    });
    vid.play().catch(() => {});
  } else {
    const img = document.createElement('img');
    img.src = item.mediaUrl;
    img.alt = '';
    media.appendChild(img);
  }

  // Mark viewed
  markViewed(item);

  // Progress animation
  _startedAt = performance.now();
  const n = g.items.length;
  const tick = (now) => {
    if (_paused) {
      _progressRaf = requestAnimationFrame(tick);
      return;
    }
    const ratio = Math.min(1, (now - _startedAt) / duration);
    buildProgress(n, _itemIdx, ratio);
    if (ratio >= 1) {
      step(1);
      return;
    }
    _progressRaf = requestAnimationFrame(tick);
  };
  buildProgress(n, _itemIdx, 0);
  _progressRaf = requestAnimationFrame(tick);
}

async function markViewed(item) {
  if (!state.me || item.seen) return;
  item.seen = true;
  try {
    await sb.from('story_views').upsert({
      story_id: item.id,
      user_id: state.me.uid,
      viewed_at: new Date().toISOString(),
    });
  } catch (_) {}
  // Update hasUnseen on group
  const g = _groups[_viewerIdx];
  if (g) g.hasUnseen = g.items.some(i => !i.seen);
}

function step(dir) {
  _itemIdx += dir;
  showCurrent();
}

export function initStories() {
  ensureDom();
  loadStories();
}
