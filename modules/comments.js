import { sb, state, isAdmin, getMediaUrl, mapProfile } from './config.js';
import { $, esc, renderMarkdown, defAvi, fmtCount }          from './utils.js';
import { toast }                   from './toast.js';

/* ── Duplicate load oldini olish ──────────────────────────────────────── */
let _loading = false;

/* ── Open modal ───────────────────────────────────────────────────────── */
export async function openCmtModal(postId) {
  state.cmtPostId = postId;

  $('cmtModalList').innerHTML = `
    <div class="cmt-skel-row"><div class="skel skel-avi w-32px h-32px flex-shrink-0"></div><div class="flex-1 d-flex flex-col gap-6px"><div class="skel skel-line w-45pct"></div><div class="skel skel-line w-75pct h-9px opacity-60"></div></div></div>
    <div class="cmt-skel-row delay-60ms"><div class="skel skel-avi w-32px h-32px flex-shrink-0"></div><div class="flex-1 d-flex flex-col gap-6px"><div class="skel skel-line w-35pct"></div><div class="skel skel-line w-60pct h-9px opacity-60"></div></div></div>`;

  const inp = $('cmtModalInput');
  inp.value = '';
  $('cmtCharCount').textContent = '300';
  $('cmtCharCount').className   = 'cmt-char-count';
  $('cmtModal').classList.add('show');

  if (state.me) {
    Promise.resolve(sb.from('profiles').select('full_name,avatar').eq('id', state.me.uid).maybeSingle()).then(({ data }) => {
      const av = data?.avatar || defAvi(data?.full_name || 'U');
      $('cmtMyAvi').innerHTML = `<img class="w-full h-full object-cover brr-50pct" src="${av}" onerror="this.classList.add('d-none')">`;
    }).catch(() => {});
  }

  await loadCmtModal(postId);
}

/* ── Load / refresh list ──────────────────────────────────────────────── */
export async function loadCmtModal(postId) {
  // Duplicate call oldini olish
  if (_loading) return;
  _loading = true;

  const list = $('cmtModalList');
  try {
    const { data: _cRows, error: _cErr } = await sb.from('comments').select('*')
      .eq('post_id', postId).order('created_at', { ascending: true });
    if (_cErr) throw _cErr;
    const cmts = (_cRows || []).map(r => ({
      id: r.id, userId: r.user_id, userName: r.user_name, text: r.text, createdAt: r.created_at,
    }));

    // Feed va post-stats da comment sonini yangilash
    const ccSpanFeed = document.getElementById(`cc-${postId}`);
    if (ccSpanFeed) ccSpanFeed.textContent = fmtCount(cmts.length);

    // allPosts state ni sinxronlash
    const post = state.allPosts.find(p => p.id === postId);
    if (post) post.commentCount = cmts.length;

    if (!cmts.length) {
      list.innerHTML = `<div class="cmt-empty">
        <svg class="opacity-30 mb-8px" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Hali izoh yo'q
      </div>`;
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
        <div class="cmt-name">${esc(c.userName)}</div>
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
        // commentCount ni DB trigger kamaytiradi
        const { error: delErr } = await sb.from('comments').delete().eq('id', b.dataset.cmt);
        if (delErr) throw delErr;
        toast('Izoh o\'chirildi', 'success');
        await loadCmtModal(b.dataset.post);
      } catch(e) {
        console.error('❌ Comment delete failed:', e);
        toast('Izohni o\'chirib bo\'lmadi', 'error');
        b.disabled = false;
      }
    }));

    list.querySelectorAll('.user-avi-btn').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.uid !== state.me?.uid) {
        $('cmtModal').classList.remove('show');
        const { openUserProfileModal } = await import('./profile.js');
        openUserProfileModal(b.dataset.uid);
      }
    }));

    list.scrollTop = list.scrollHeight;

  } catch(e) {
    console.error('❌ Izohlar load failed:', e);
    list.innerHTML = `<div class="cmt-empty">Izohlar yuklanmadi. Qayta urinib ko'ring.</div>`;
  } finally {
    _loading = false;
  }
}

/* ── Send comment ─────────────────────────────────────────────────────── */
export async function sendCmtModal() {
  const inp  = $('cmtModalInput');
  const text = inp?.value?.trim();
  if (!text || !state.cmtPostId || !state.me) return;

  const sendBtn = $('cmtModalSend');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const { data: ud } = await sb.from('profiles').select('full_name').eq('id', state.me.uid).maybeSingle();

    // commentCount ni DB trigger oshiradi
    const { error: insErr } = await sb.from('comments').insert({
      post_id:   state.cmtPostId,
      user_id:   state.me.uid,
      user_name: ud?.full_name || state.me.displayName || 'Foydalanuvchi',
      text,
    });
    if (insErr) throw insErr;

    inp.value = '';
    $('cmtCharCount').textContent = '300';
    $('cmtCharCount').className   = 'cmt-char-count';

    // DOM ni darhol yangilash
    const newCount = (state.allPosts.find(p => p.id === state.cmtPostId)?.commentCount || 0) + 1;

    const ccSpan = document.getElementById(`cc-${state.cmtPostId}`);
    if (ccSpan) ccSpan.textContent = fmtCount(newCount);

    const rccSpan = document.querySelector(`.rcmt-${state.cmtPostId}`);
    if (rccSpan) rccSpan.textContent = `${newCount}`;

    // allPosts state ni yangilash
    const post = state.allPosts.find(p => p.id === state.cmtPostId);
    if (post) post.commentCount = newCount;

    toast('Izoh qo\'shildi', 'success');
    await loadCmtModal(state.cmtPostId);

  } catch(e) {
    console.error('❌ Comment send failed:', e);
    toast('Izohni yuborib bo\'lmadi', 'error');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

/* ── Modal event listeners ────────────────────────────────────────────── */
$('cmtModalSend').onclick = sendCmtModal;
$('cmtModalInput')
$('cmtModalInput').addEventListener('input', () => {
  const len = $('cmtModalInput').value.length;
  const cnt = $('cmtCharCount');
  cnt.textContent = 300 - len;
  cnt.className   = 'cmt-char-count' + (len >= 270 ? (len >= 300 ? ' over' : ' warn') : '');
});
$('cmtModalClose').onclick = () => $('cmtModal').classList.remove('show');
$('cmtModal').addEventListener('click', e => {
  if (e.target === $('cmtModal')) $('cmtModal').classList.remove('show');
});

