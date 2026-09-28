/**
 * Right rail (desktop ≥1200px) — ~50 kishilik doira:
 * Onlayn, Guruhlar, So‘nggi faollik.
 * Realtime: profiles / posts / groups yangilanganda darhol yangilanadi.
 */
import { sb, state, mapProfile } from './config.js';
import { $, esc, defAvi, isOnline } from './utils.js';
import { groupListItems } from './groups.js';

const MAX_ONLINE = 12;
const MAX_GROUPS = 8;
const MAX_RECENT = 8;

let _tick = null;
let _started = false;
let _ch = null;
let _refreshTimer = null;

function rail() { return $('rightRail'); }

function showRail(on) {
  const el = rail();
  if (!el) return;
  if (on) el.removeAttribute('hidden');
  else el.setAttribute('hidden', '');
}

function fit() {
  // Faqat home va profile da ko'rsatiladi (chats / actions / login da yopiq)
  const view = state.view || 'home';
  const allowed = view === 'home' || view === 'profile';
  showRail(
    allowed &&
    window.matchMedia('(min-width: 1200px)').matches &&
    !!state.me?.uid
  );
}

/** Router navigatsiyasidan chaqiriladi */
export function onRouteChange() {
  fit();
  // Comments panel ochiq qolgan bo'lsa, view o'zgarganda yopamiz
  if ((state.view || '') !== 'home' && (state.view || '') !== 'profile') {
    const cmt = document.getElementById('rrCmtPanel');
    if (cmt && !cmt.hidden) {
      cmt.hidden = true;
      document.querySelectorAll('#rightRail .rr-card').forEach(c => { c.hidden = false; });
    }
  }
}

function aviHtml(name, url, online) {
  const src = url || defAvi(name || '?');
  return `<span class="rr-avi"><img src="${esc(src)}" alt="" onerror="this.style.display='none'">${online ? '<span class="rr-dot" title="onlayn"></span>' : ''}</span>`;
}

function cmtOpen() {
  const cmt = document.getElementById('rrCmtPanel');
  return cmt && !cmt.hidden;
}

async function loadOnline() {
  const box = $('rrOnlineList');
  if (!box || !state.me?.uid) return;
  try {
    const { data, error } = await sb.from('profiles')
      .select('id, username, full_name, avatar, last_seen, approval, blocked, blocked_until')
      .eq('approval', 'approved')
      .eq('blocked', false)
      .order('last_seen', { ascending: false })
      .limit(40);
    if (error) throw error;
    const me = state.me.uid;
    const online = (data || [])
      .map(mapProfile)
      .filter(u => u && u.uid !== me && isOnline(u.lastSeenAt))
      .slice(0, MAX_ONLINE);
    if (!online.length) {
      box.innerHTML = '<div class="rr-empty">Hozircha hech kim onlayn emas</div>';
      return;
    }
    box.innerHTML = online.map(u => {
      const name = u.fullName || u.username || 'Foydalanuvchi';
      const sub = u.username ? '@' + u.username : 'onlayn';
      return `<button type="button" class="rr-row" data-rr-user="${esc(u.uid)}">
        ${aviHtml(name, u.avatar, true)}
        <span class="rr-meta"><div class="rr-name">${esc(name)}</div><div class="rr-sub">${esc(sub)}</div></span>
      </button>`;
    }).join('');
  } catch (e) {
    console.warn('[right-rail] online', e?.message || e);
    box.innerHTML = '<div class="rr-empty">Yuklab bo‘lmadi</div>';
  }
}

function loadGroups() {
  const box = $('rrGroupsList');
  if (!box) return;
  const items = (groupListItems || []).slice(0, MAX_GROUPS);
  if (!items.length) {
    box.innerHTML = '<div class="rr-empty">Hali guruh yo‘q</div>';
    return;
  }
  box.innerHTML = items.map(g => {
    const name = g.name || g.title || 'Guruh';
    const n = g.subscriberCount || (g.members?.length || 0);
    const sub = g.type === 'channel' ? ('Kanal' + (n ? ' · ' + n : '')) : (n ? n + ' a\'zo' : 'Guruh');
    const av = g.avatar || g.photoURL || '';
    return `<button type="button" class="rr-row" data-rr-group="${esc(g.id)}">
      ${aviHtml(name, av, false)}
      <span class="rr-meta"><div class="rr-name">${esc(name)}</div><div class="rr-sub">${esc(sub)}</div></span>
    </button>`;
  }).join('');
}

function loadRecent() {
  const box = $('rrRecentList');
  if (!box) return;
  const posts = (state.allPosts || []).slice(0, MAX_RECENT);
  if (!posts.length) {
    box.innerHTML = '<div class="rr-empty">Hali yangilik yo‘q</div>';
    return;
  }
  box.innerHTML = posts.map(p => {
    const name = p.userFullName || 'Kimdir';
    const text = (p.text || '').trim().replace(/\s+/g, ' ').slice(0, 60) || (p.mediaType ? 'Media' : 'Post');
    const uid = p.userId || '';
    const av = state._userCache?.[uid]?.avatar || '';
    return `<button type="button" class="rr-row" data-rr-post="${esc(p.id)}" data-rr-user="${esc(uid)}">
      ${aviHtml(name, av, false)}
      <span class="rr-meta"><div class="rr-name">${esc(name)}</div><div class="rr-sub">${esc(text)}</div></span>
    </button>`;
  }).join('');
}

function scheduleRefresh(delay = 200) {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => { refresh(); }, delay);
}

async function refresh() {
  fit();
  if (!rail() || rail().hasAttribute('hidden')) return;
  if (cmtOpen()) return;
  await loadOnline();
  loadGroups();
  loadRecent();
}

function onClick(e) {
  const row = e.target.closest('.rr-row');
  if (!row) return;
  const uid = row.getAttribute('data-rr-user');
  const gid = row.getAttribute('data-rr-group');
  const pid = row.getAttribute('data-rr-post');
  if (gid) {
    import('./groups.js').then(m => m.openGroupThread?.(gid));
    return;
  }
  if (pid) {
    const el = document.getElementById('post-' + pid) || document.querySelector(`.post[data-id="${pid}"]`) || document.querySelector(`[data-post-id="${pid}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (uid) {
    import('./profile.js').then(m => m.openUserProfileModal?.(uid)).catch(() => {});
  }
}

function startRealtime() {
  if (_ch || !state.me?.uid) return;
  _ch = sb.channel('right-rail-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      scheduleRefresh(150);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
      // state.allPosts ni ham yangilab qo'yamiz (So'nggi uchun)
      try {
        if (payload.eventType === 'INSERT' && payload.new) {
          const r = payload.new;
          const exists = (state.allPosts || []).some(p => p.id === r.id);
          if (!exists) {
            const mapped = {
              id: r.id,
              userId: r.user_id,
              userFullName: r.user_name || '',
              text: r.text || '',
              mediaType: r.media_type || '',
              mediaPath: r.media_path || '',
              createdAt: r.created_at,
              likes: r.likes_count || 0,
              views: r.views_count || 0,
              commentCount: r.comment_count || 0,
              isPublic: r.is_public !== false,
            };
            state.allPosts = [mapped, ...(state.allPosts || [])];
          }
        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
          state.allPosts = (state.allPosts || []).filter(p => p.id !== payload.old.id);
        }
      } catch (_) {}
      scheduleRefresh(100);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => scheduleRefresh(200))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => scheduleRefresh(200))
    .subscribe();
}

function stopRealtime() {
  if (_ch) {
    try { sb.removeChannel(_ch); } catch (_) {}
    _ch = null;
  }
}

export function startRightRail() {
  if (_started) return;
  _started = true;
  rail()?.addEventListener('click', onClick);
  window.addEventListener('resize', fit);
  document.addEventListener('groupsUpdated', () => { if (!cmtOpen()) loadGroups(); });
  document.addEventListener('profilesPreloaded', () => scheduleRefresh(50));
  document.addEventListener('postsUpdated', () => { if (!cmtOpen()) loadRecent(); });
  fit();
  refresh();
  startRealtime();
  // Zaxira: realtime uzilsa ham 15s da yangilanadi (oldin 45s edi)
  _tick = setInterval(() => scheduleRefresh(0), 15000);
}

export function stopRightRail() {
  if (_tick) { clearInterval(_tick); _tick = null; }
  clearTimeout(_refreshTimer);
  stopRealtime();
  showRail(false);
  _started = false;
}

// Auto-start when logged in
startRightRail();
setInterval(() => {
  if (state.me?.uid) {
    fit();
    if (!_ch) startRealtime();
  }
}, 2000);
