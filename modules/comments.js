import { sb, state, isAdmin, getMediaUrl, mapProfile } from './config.js';
import { $, esc, renderMarkdown, defAvi, fmtCount, fmt }     from './utils.js';
import { toast }                   from './toast.js';

/* ── Duplicate load oldini olish ──────────────────────────────────────── */
let _loading = false;
let _mode = null; // 'inline' | 'rail'

function isDesktopCmt() {
  return window.matchMedia('(min-width: 1200px)').matches;
}

/* Yuborish tugmasi: matn bo'sh bo'lsa o'chiq (X kabi 50%) */
function syncSend(inp, btn) {
  if (btn) btn.disabled = !inp?.value?.trim();
}

/* ── Shared: skeleton HTML ────────────────────────────────────────────── */
function skelHtml() {
  return `
    <div class="cmt-skel-row"><div class="skel skel-avi w-32px h-32px flex-shrink-0"></div><div class="flex-1 d-flex flex-col gap-6px"><div class="skel skel-line w-45pct"></div><div class="skel skel-line w-75pct h-9px opacity-60"></div></div></div>
    <div class="cmt-skel-row delay-60ms"><div class="skel skel-avi w-32px h-32px flex-shrink-0"></div><div class="flex-1 d-flex flex-col gap-6px"><div class="skel skel-line w-35pct"></div><div class="skel skel-line w-60pct h-9px opacity-60"></div></div></div>`;
}

function emptyHtml() {
  return `<div class="cmt-empty">
    <svg class="opacity-30 mb-8px" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    Hali izoh yo'q
  </div>`;
}

/* ── Close any open inline panels ─────────────────────────────────────── */
function closeAllInline() {
  document.querySelectorAll('.post-cmt-panel').forEach(el => el.remove());
}

/* ── Right rail: ensure comments container exists ─────────────────────── */
function ensureRailCmt() {
  const rail = $('rightRail');
  if (!rail) return null;
  let panel = $('rrCmtPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'rrCmtPanel';
    panel.className = 'rr-cmt-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="rr-cmt-hdr">
        <button type="button" class="rr-cmt-back" id="rrCmtBack" title="Orqaga" aria-label="Orqaga">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="rr-cmt-title">Izohlar</span>
      </div>
      <div class="rr-cmt-input-row cmt-input-row">
        <div class="cmt-my-avi" id="rrCmtMyAvi"></div>
        <input class="cmt-input" id="rrCmtInput" placeholder="Izoh qoldirish..." maxlength="300">
        <span class="cmt-char-count" id="rrCmtCharCount">300</span>
        <button class="cmt-send" id="rrCmtSend" type="button" disabled>Yuborish</button>
      </div>
      <div class="rr-cmt-list cmt-modal-list" id="rrCmtList"></div>
    `;
    rail.appendChild(panel);

    $('rrCmtBack')?.addEventListener('click', closeRailCmt);
    $('rrCmtSend')?.addEventListener('click', () => sendComment('rail'));
    $('rrCmtInput')?.addEventListener('input', () => {
      syncSend($('rrCmtInput'), $('rrCmtSend'));
      const len = $('rrCmtInput').value.length;
      const cnt = $('rrCmtCharCount');
      if (!cnt) return;
      cnt.textContent = 300 - len;
      cnt.className = 'cmt-char-count' + (len >= 270 ? (len >= 300 ? ' over' : ' warn') : '');
    });
    $('rrCmtInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendComment('rail');
      }
    });
  }
  return panel;
}

function showRailDefault(show) {
  const rail = $('rightRail');
  if (!rail) return;
  rail.querySelectorAll('.rr-card').forEach(c => {
    c.hidden = !show;
  });
}

function closeRailCmt() {
  const panel = $('rrCmtPanel');
  if (panel) panel.hidden = true;
  showRailDefault(true);
  if (_mode === 'rail') {
    state.cmtPostId = null;
    _mode = null;
  }
}

async function fillMyAvi(targetId) {
  const el = $(targetId);
  if (!el || !state.me) return;
  try {
    const { data } = await sb.from('profiles').select('full_name,avatar').eq('id', state.me.uid).maybeSingle();
    const av = data?.avatar || defAvi(data?.full_name || 'U');
    el.innerHTML = `<img class="w-full h-full object-cover brr-50pct" src="${av}" onerror="this.classList.add('d-none')">`;
  } catch (_) {}
}

/* ── Open: routes mobile → inline, desktop → right rail ───────────────── */
export async function openCmtModal(postId) {
  // Hide old bottom-sheet modal always
  $('cmtModal')?.classList.remove('show');

  if (isDesktopCmt()) {
    await openRailCmt(postId);
  } else {
    await openInlineCmt(postId);
  }
}

/* ── Mobile: inline under post ────────────────────────────────────────── */
async function openInlineCmt(postId) {
  const post = document.querySelector(`.post[data-id="${postId}"]`);
  if (!post) return;

  // Toggle: same post already open → close
  const existing = post.querySelector('.post-cmt-panel');
  if (existing) {
    existing.remove();
    if (state.cmtPostId === postId) {
      state.cmtPostId = null;
      _mode = null;
    }
    return;
  }

  closeAllInline();
  closeRailCmt();

  state.cmtPostId = postId;
  _mode = 'inline';

  const panel = document.createElement('div');
  panel.className = 'post-cmt-panel';
  panel.dataset.postId = postId;
  panel.innerHTML = `
    <div class="post-cmt-input-row cmt-input-row">
      <div class="cmt-my-avi" id="inlineCmtMyAvi"></div>
      <input class="cmt-input" id="inlineCmtInput" placeholder="Izoh qoldirish..." maxlength="300">
      <span class="cmt-char-count" id="inlineCmtCharCount">300</span>
      <button class="cmt-send" id="inlineCmtSend" type="button" disabled>Yuborish</button>
    </div>
    <div class="post-cmt-list" id="inlineCmtList">${skelHtml()}</div>
  `;

  // Insert after post-actions (inside post-main if present)
  const actions = post.querySelector('.post-actions');
  if (actions && actions.parentNode) {
    actions.insertAdjacentElement('afterend', panel);
  } else {
    post.appendChild(panel);
  }

  fillMyAvi('inlineCmtMyAvi');

  $('inlineCmtSend')?.addEventListener('click', () => sendComment('inline'));
  $('inlineCmtInput')?.addEventListener('input', () => {
    syncSend($('inlineCmtInput'), $('inlineCmtSend'));
    const len = $('inlineCmtInput').value.length;
    const cnt = $('inlineCmtCharCount');
    if (!cnt) return;
    cnt.textContent = 300 - len;
    cnt.className = 'cmt-char-count' + (len >= 270 ? (len >= 300 ? ' over' : ' warn') : '');
  });
  $('inlineCmtInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendComment('inline');
    }
  });

  // Focus input
  setTimeout(() => $('inlineCmtInput')?.focus(), 50);

  await loadComments(postId, 'inlineCmtList');
}

/* ── Desktop: right rail ──────────────────────────────────────────────── */
async function openRailCmt(postId) {
  closeAllInline();

  // Toggle same post
  if (_mode === 'rail' && state.cmtPostId === postId) {
    closeRailCmt();
    return;
  }

  state.cmtPostId = postId;
  _mode = 'rail';

  const panel = ensureRailCmt();
  if (!panel) return;

  showRailDefault(false);
  panel.hidden = false;

  const list = $('rrCmtList');
  if (list) list.innerHTML = skelHtml();

  const inp = $('rrCmtInput');
  if (inp) {
    inp.value = '';
    $('rrCmtCharCount').textContent = '300';
    $('rrCmtCharCount').className = 'cmt-char-count';
  }
  syncSend(inp, $('rrCmtSend'));

  fillMyAvi('rrCmtMyAvi');
  setTimeout(() => inp?.focus(), 50);

  await loadComments(postId, 'rrCmtList');
}

/* ── Load comments into a list element ────────────────────────────────── */
export async function loadCmtModal(postId) {
  // Back-compat: refresh whichever is open
  if (_mode === 'inline') await loadComments(postId, 'inlineCmtList');
  else if (_mode === 'rail') await loadComments(postId, 'rrCmtList');
  else await loadComments(postId, 'cmtModalList');
}

async function loadComments(postId, listId) {
  if (_loading) return;
  _loading = true;

  const list = $(listId);
  if (!list) { _loading = false; return; }

  try {
    const { data: _cRows, error: _cErr } = await sb.from('comments').select('*')
      .eq('post_id', postId).order('created_at', { ascending: true });
    if (_cErr) throw _cErr;
    const cmts = (_cRows || []).map(r => ({
      id: r.id, userId: r.user_id, userName: r.user_name, text: r.text, createdAt: r.created_at,
    }));

    const ccSpanFeed = document.getElementById(`cc-${postId}`);
    if (ccSpanFeed) ccSpanFeed.textContent = fmtCount(cmts.length);

    const post = state.allPosts.find(p => p.id === postId);
    if (post) post.commentCount = cmts.length;

    if (!cmts.length) {
      list.innerHTML = emptyHtml();
      return;
    }

    const uids = [...new Set(cmts.map(c => c.userId))];
    const { data: _uRows } = await sb.from('profiles').select('id,full_name,avatar').in('id', uids);
    const _uById = new Map((_uRows || []).map(r => [r.id, mapProfile(r)]));
    const aMap = {};
    uids.forEach(u => {
      const d = _uById.get(u) || {};
      aMap[u] = d.avatar || defAvi(d.fullName);
    });

    list.innerHTML = cmts.map(c => `<div class="cmt-row" data-cmt-id="${c.id}">
      <div class="cmt-avi user-avi-btn" data-uid="${c.userId}">
        <img src="${aMap[c.userId]}" onerror="this.style.display='none'">
      </div>
      <div class="cmt-body">
        <div class="cmt-head"><span class="cmt-name">${esc(c.userName)}</span><span class="cmt-time">· ${fmt(c.createdAt)}</span></div>
        <div class="cmt-text">${renderMarkdown(c.text)}</div>
      </div>
      ${(state.me?.uid === c.userId || isAdmin())
        ? `<button class="cmt-del" data-post="${postId}" data-cmt="${c.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
            </svg></button>`
        : ''}
    </div>`).join('');

    list.querySelectorAll('.cmt-del').forEach(b => b.addEventListener('click', async () => {
      if (b.disabled) return;
      b.disabled = true;
      try {
        const { error: delErr } = await sb.from('comments').delete().eq('id', b.dataset.cmt);
        if (delErr) throw delErr;
        toast('Izoh o\'chirildi', 'success');
        await loadComments(b.dataset.post, listId);
      } catch (e) {
        console.error('❌ Comment delete failed:', e);
        toast('Izohni o\'chirib bo\'lmadi', 'error');
        b.disabled = false;
      }
    }));

    list.querySelectorAll('.user-avi-btn').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.uid !== state.me?.uid) {
        if (_mode === 'inline') closeAllInline();
        if (_mode === 'rail') closeRailCmt();
        const { openUserProfileModal } = await import('./profile.js');
        openUserProfileModal(b.dataset.uid);
      }
    }));

    list.scrollTop = list.scrollHeight;

  } catch (e) {
    console.error('❌ Izohlar load failed:', e);
    list.innerHTML = `<div class="cmt-empty">Izohlar yuklanmadi. Qayta urinib ko'ring.</div>`;
  } finally {
    _loading = false;
  }
}

/* ── Send comment ─────────────────────────────────────────────────────── */
export async function sendCmtModal() {
  // Back-compat for old modal send
  return sendComment(_mode || 'modal');
}

async function sendComment(mode) {
  let inp, sendBtn, listId, charId;
  if (mode === 'inline') {
    inp = $('inlineCmtInput');
    sendBtn = $('inlineCmtSend');
    listId = 'inlineCmtList';
    charId = 'inlineCmtCharCount';
  } else if (mode === 'rail') {
    inp = $('rrCmtInput');
    sendBtn = $('rrCmtSend');
    listId = 'rrCmtList';
    charId = 'rrCmtCharCount';
  } else {
    inp = $('cmtModalInput');
    sendBtn = $('cmtModalSend');
    listId = 'cmtModalList';
    charId = 'cmtCharCount';
  }

  const text = inp?.value?.trim();
  if (!text || !state.cmtPostId || !state.me) return;

  if (sendBtn) sendBtn.disabled = true;

  try {
    const { data: ud } = await sb.from('profiles').select('full_name').eq('id', state.me.uid).maybeSingle();

    const { error: insErr } = await sb.from('comments').insert({
      post_id:   state.cmtPostId,
      user_id:   state.me.uid,
      user_name: ud?.full_name || state.me.displayName || 'Foydalanuvchi',
      text,
    });
    if (insErr) throw insErr;

    if (inp) inp.value = '';
    const cnt = $(charId);
    if (cnt) {
      cnt.textContent = '300';
      cnt.className = 'cmt-char-count';
    }

    const newCount = (state.allPosts.find(p => p.id === state.cmtPostId)?.commentCount || 0) + 1;

    const ccSpan = document.getElementById(`cc-${state.cmtPostId}`);
    if (ccSpan) ccSpan.textContent = fmtCount(newCount);

    const rccSpan = document.querySelector(`.rcmt-${state.cmtPostId}`);
    if (rccSpan) rccSpan.textContent = `${newCount}`;

    const post = state.allPosts.find(p => p.id === state.cmtPostId);
    if (post) post.commentCount = newCount;

    toast('Izoh qo\'shildi', 'success');
    await loadComments(state.cmtPostId, listId);

  } catch (e) {
    console.error('❌ Comment send failed:', e);
    toast('Izohni yuborib bo\'lmadi', 'error');
  } finally {
    if (sendBtn) sendBtn.disabled = !inp?.value?.trim();
  }
}

/* ── Legacy modal listeners (fallback, rarely used) ───────────────────── */
if ($('cmtModalSend')) $('cmtModalSend').onclick = () => sendComment('modal');
if ($('cmtModalInput')) {
  $('cmtModalInput').addEventListener('input', () => {
    const len = $('cmtModalInput').value.length;
    const cnt = $('cmtCharCount');
    if (!cnt) return;
    cnt.textContent = 300 - len;
    cnt.className = 'cmt-char-count' + (len >= 270 ? (len >= 300 ? ' over' : ' warn') : '');
  });
}
if ($('cmtModalClose')) $('cmtModalClose').onclick = () => $('cmtModal')?.classList.remove('show');
if ($('cmtModal')) {
  $('cmtModal').addEventListener('click', e => {
    if (e.target === $('cmtModal')) $('cmtModal').classList.remove('show');
  });
}

// Resize: if switching breakpoints while open, re-route
window.addEventListener('resize', () => {
  if (!state.cmtPostId || !_mode) return;
  const wantRail = isDesktopCmt();
  if (wantRail && _mode === 'inline') {
    const id = state.cmtPostId;
    closeAllInline();
    openRailCmt(id);
  } else if (!wantRail && _mode === 'rail') {
    const id = state.cmtPostId;
    closeRailCmt();
    openInlineCmt(id);
  }
});
