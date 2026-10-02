/* ── Onlayn holat (presence) uchun CSS ────────────────────────────────── */
function _injectPresenceCSS() { /* CSS: mono-x.css .presence-dot */ }

/* ── Search, Pins & Context Menu for Chats ──────────────────────────── */
let _searchQuery = '';

/* ── Pins / recent / deleted — modules/chat-storage.js ────────────────── */
// _getPins, _isPinned, _togglePin, _getRecents, ... import orqali (pastga qarang)

function _deleteChatForMe(uid) {
  if (!state.me?.uid || !uid) return;
  markChatDeletedLocal(uid);
  delete _latestChatMap[uid];
  const pins = _getPins();
  if (pins.dms.includes(uid)) _togglePin('dm', uid);
  sb.from('contacts').delete().eq('owner_id', state.me.uid).eq('contact_id', uid).then(() => {}, () => {});
}

function _isChatDeleted(uid) {
  const t = getChatDeletedAt(uid);
  if (!t) return false;
  const c = _latestChatMap[uid];
  if (c?.lastMessageAt && c.lastMessageAt > t) {
    clearChatDeletedLocal(uid);
    return false;
  }
  return true;
}

function _shouldShowInChatsList(u, chatMap) {
  if (!u || !u.uid) return false;
  if (_isChatDeleted(u.uid)) return false;
  if (_isPinned('dm', u.uid)) return true;
  if (u.isAdmin || u.username === 'admin' || u.username === 'mrdevs' || u.username === 'mr') return true;
  const c = chatMap[u.uid];
  if (c && (c.lastMessage || c.lastMessageAt || c.lastMessageId)) return true;
  return false;
}

function _injectSearchCSS() { /* CSS: mono-x.css .ulist-search-* / .chat-ctx-* */ }

function _renderRecentSearches() {
  const existing = document.getElementById('chatRecentSearchesWrap');
  if (existing) existing.remove();

  const recents = _getRecents();
  if (!recents.length) return;

  const wrap = document.createElement('div');
  wrap.id = 'chatRecentSearchesWrap';
  wrap.className = 'chat-recents-wrap';
  wrap.innerHTML = `
    <div class="chat-recents-hdr">
      <span>So'nggi qidiruvlar</span>
      <button type="button" class="chat-recents-clear-all" id="chatRecentsClearAll">Barchasini tozalash</button>
    </div>
    <div class="chat-recents-list">
      ${recents.map(item => {
        const av = item.avatar || defAvi(item.name || 'U');
        const sub = item.type === 'group' ? 'Guruh' : (item.username ? '@' + item.username : '');
        return `
          <div class="chat-recent-item" data-id="${esc(item.id)}" data-type="${esc(item.type)}">
            <div class="chat-recent-avi"><img src="${av}" onerror="this.style.display='none'"></div>
            <div class="chat-recent-info">
              <div class="chat-recent-name">${esc(item.name || 'Foydalanuvchi')}</div>
              ${sub ? `<div class="chat-recent-sub">${esc(sub)}</div>` : ''}
            </div>
            <button type="button" class="chat-recent-del" title="O'chirish" data-del="${esc(item.id)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const box = document.getElementById('chatSearchBoxWrap');
  if (box && box.nextSibling) {
    box.parentNode.insertBefore(wrap, box.nextSibling);
  } else if (box) {
    box.parentNode.appendChild(wrap);
  }

  wrap.querySelector('#chatRecentsClearAll')?.addEventListener('click', (e) => {
    e.stopPropagation();
    _clearAllRecents();
    wrap.remove();
  });

  wrap.querySelectorAll('.chat-recent-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.del;
      _removeRecent(id);
      const row = btn.closest('.chat-recent-item');
      row?.remove();
      if (!wrap.querySelector('.chat-recent-item')) {
        wrap.remove();
      }
    });
  });

  wrap.querySelectorAll('.chat-recent-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const type = item.dataset.type;
      wrap.remove();
      if (type === 'group') {
        openGroupThread(id);
      } else {
        openChatThread(id);
      }
    });
  });
}

function _renderSearchBox(container) {
  _injectSearchCSS();
  const existingBox = document.getElementById('chatSearchBoxWrap');
  if (existingBox) return; // already injected
  const wrap = document.createElement('div');
  wrap.id = 'chatSearchBoxWrap';
  wrap.innerHTML = `
    <div class="ulist-search-wrap">
      <div class="ulist-search-icon" id="chatSearchBtn" title="Qidirish">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"/><line x1="17" y1="17" x2="22" y2="22"/>
        </svg>
      </div>
      <input class="ulist-search-input" id="chatSearchInput" placeholder="Qidirish (ism yoki username)..." autocomplete="off" spellcheck="false">
      <button type="button" class="ulist-search-clear d-none" id="chatSearchClear" aria-label="Tozalash">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="ulist-search-result d-none" id="chatSearchResult"></div>
  `;
  container.insertBefore(wrap, container.firstChild);

  const inp = document.getElementById('chatSearchInput');
  const btn = document.getElementById('chatSearchBtn');
  const clearBtn = document.getElementById('chatSearchClear');
  const res = document.getElementById('chatSearchResult');

  function updateClearBtn() {
    if (clearBtn) {
      clearBtn.classList.toggle('d-none', !inp.value);
    }
  }

  async function doSearch() {
    const raw = inp.value.trim();
    updateClearBtn();
    document.getElementById('chatRecentSearchesWrap')?.remove();
    if (!raw) {
      _searchQuery = '';
      if (res) res.classList.add('d-none');
      paintChatsList(_usersCache || [], _latestChatMap);
      return;
    }
    _searchQuery = raw;

    if (!_usersCache) {
      try { _usersCache = await _fetchChatUsers(); } catch (_) {}
    }

    const term = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();
    const matchedUsers = (_usersCache || []).filter(u =>
      (u.username || '').toLowerCase().includes(term) ||
      (u.fullName || '').toLowerCase().includes(term)
    );
    let matchedGroups = getGroupRows().filter(g =>
      (g.name || '').toLowerCase().includes(term) ||
      (g.username || '').toLowerCase().includes(term)
    );
    if (term) {
      try {
        const extra = await searchGroups(term);
        if (extra && extra.length) {
          const map = new Map(matchedGroups.map(g => [g.id, g]));
          extra.forEach(g => map.set(g.id, g));
          matchedGroups = Array.from(map.values());
        }
      } catch (_) {}
    }
    const totalMatches = matchedUsers.length + matchedGroups.length;

    if (res) {
      if (totalMatches > 0) {
        res.textContent = `${totalMatches} ta natija topildi`;
        res.className = 'ulist-search-result';
        res.classList.remove('d-none');
      } else {
        res.textContent = `"${raw}" — topilmadi`;
        res.className = 'ulist-search-result not-found';
        res.classList.remove('d-none');
      }
    }
    paintChatsList(_usersCache || [], _latestChatMap);
  }

  let debounceTimer = null;
  inp.addEventListener('input', () => {
    updateClearBtn();
    document.getElementById('chatRecentSearchesWrap')?.remove();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      doSearch();
    }, 120);
  });

  inp.addEventListener('focus', () => {
    if (!inp.value.trim()) {
      _renderRecentSearches();
    }
  });

  inp.addEventListener('click', () => {
    if (!inp.value.trim()) {
      _renderRecentSearches();
    }
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      doSearch();
    }
  });

  btn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    doSearch();
  });

  clearBtn?.addEventListener('click', () => {
    inp.value = '';
    clearTimeout(debounceTimer);
    doSearch();
    inp.focus();
    _renderRecentSearches();
  });

  document.addEventListener('click', (e) => {
    const recWrap = document.getElementById('chatRecentSearchesWrap');
    if (recWrap && !recWrap.contains(e.target) && e.target !== inp) {
      recWrap.remove();
    }
  });
}

/* ── Context Menu (Long press / right-click on chat row) ─────────────── */
function _attachChatRowContextMenu(row) {
  let timer = null;
  let started = false;
  let startX = 0, startY = 0;

  const trigger = (e) => {
    timer = null;
    started = true;
    _openChatContextMenu(row);
  };

  row.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) return;
    started = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    timer = setTimeout(() => trigger(e), 450);
  }, { passive: true });

  row.addEventListener('touchmove', (e) => {
    if (!timer) return;
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 8 || dy > 8) {
      clearTimeout(timer);
      timer = null;
    }
  }, { passive: true });

  row.addEventListener('touchend', (e) => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (started) {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => { started = false; }, 300);
    }
  });

  row.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    started = false;
    timer = setTimeout(() => trigger(e), 450);
  });

  row.addEventListener('mouseup', () => {
    if (timer) { clearTimeout(timer); timer = null; }
  });

  row.addEventListener('mouseleave', () => {
    if (timer) { clearTimeout(timer); timer = null; }
  });

  row.addEventListener('click', (e) => {
    if (started) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      started = false;
    }
  }, true);

  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    trigger(e);
  });
}

function _openChatContextMenu(row) {
  document.getElementById('chatCtxOverlay')?.remove();

  const isGroup = !!row.dataset.gid;
  const id = isGroup ? row.dataset.gid : row.dataset.uid;
  const isPinned = _isPinned(isGroup ? 'group' : 'dm', id);

  let title = 'Suhbat';
  if (isGroup) {
    const g = getGroupRows().find(x => x.id === id);
    title = g?.name || 'Guruh';
  } else {
    const u = (_usersCache || []).find(x => x.uid === id);
    title = u?.fullName || (u?.username ? '@' + u.username : 'Foydalanuvchi');
  }

  const overlay = document.createElement('div');
  overlay.id = 'chatCtxOverlay';
  overlay.className = 'chat-ctx-overlay';
  overlay.innerHTML = `
    <div class="chat-ctx-menu">
      <div class="chat-ctx-title">${esc(title)}</div>
      <button type="button" class="chat-ctx-item" id="chatCtxPin">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
        <span>${isPinned ? "Qadashni bekor qilish" : (isGroup ? "Guruhni qadash" : "Suhbatni qadash")}</span>
      </button>
      ${isGroup ? `
        <button type="button" class="chat-ctx-item danger" id="chatCtxLeave">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Guruhdan chiqish</span>
        </button>
      ` : `
        <button type="button" class="chat-ctx-item danger" id="chatCtxDelete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          <span>Suhbatni o'chirish</span>
        </button>
      `}
    </div>
  `;

  document.body.appendChild(overlay);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const close = () => {
    window.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector('#chatCtxPin')?.addEventListener('click', () => {
    close();
    const nowPinned = _togglePin(isGroup ? 'group' : 'dm', id);
    toast(nowPinned ? "Qadandi" : "Qadash bekor qilindi", "success");
    paintChatsList(_usersCache || [], _latestChatMap);
  });

  overlay.querySelector('#chatCtxDelete')?.addEventListener('click', () => {
    close();
    if (!confirm("Ushbu suhbatni o'chirmoqchimisiz?")) return;
    _deleteChatForMe(id);
    toast("Suhbat o'chirildi", "info");
    paintChatsList(_usersCache || [], _latestChatMap);
  });

  overlay.querySelector('#chatCtxLeave')?.addEventListener('click', async () => {
    close();
    if (!confirm("Guruhdan chiqmoqchimisiz?")) return;
    try {
      await leaveGroup(id);
      toast("Guruhdan chiqdingiz", "info");
      paintChatsList(_usersCache || [], _latestChatMap);
    } catch { toast("Xatolik yuz berdi", "error"); }
  });
}

/* ── Header 3-dots Dropdown Menu (DM & Group) ────────────────────────── */
export function initChatHeaderMenu() {
  const btn = $('chatHeaderMenuBtn');
  if (!btn || btn._wired) return;
  btn._wired = true;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = document.getElementById('chatHeaderDropdown');
    if (existing) { existing.remove(); return; }

    const isGroup = state.currentChatKind === 'group' || !!getCurrentGroupId() || !!document.getElementById('chatThreadModal')?.dataset?.gid;
    const drop = document.createElement('div');
    drop.id = 'chatHeaderDropdown';
    drop.className = 'chat-header-dropdown';

    if (isGroup) {
      drop.innerHTML = `
        <button type="button" class="chat-header-dropdown-item danger" id="chmLeaveGroup">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Guruhdan chiqish</span>
        </button>
      `;
    } else {
      drop.innerHTML = `
        <button type="button" class="chat-header-dropdown-item danger" id="chmDeleteChat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          <span>Suhbatdan chiqish</span>
        </button>
      `;
    }

    const hdr = document.querySelector('.chat-thread-hdr');
    if (hdr) hdr.appendChild(drop);

    drop.querySelector('#chmLeaveGroup')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      drop.remove();
      const gid = getCurrentGroupId() || document.getElementById('chatThreadModal')?.dataset?.gid;
      if (!gid) return;
      if (!confirm("Guruhdan chiqmoqchimisiz?")) return;
      try {
        await leaveGroup(gid);
        $('chatThreadModal')?.classList.remove('show');
        closeGroupThread();
        toast("Guruhdan chiqdingiz", "info");
        if (state.view === 'chats') renderChatsList();
      } catch { toast("Xatolik yuz berdi", "error"); }
    });

    drop.querySelector('#chmDeleteChat')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      drop.remove();
      const uid = state.currentChatUid;
      if (!uid) return;
      if (!confirm("Suhbatdan chiqmoqchimisiz?")) return;
      _deleteChatForMe(uid);
      closeChatThread();
      toast("Suhbatdan chiqildi", "info");
      if (state.view === 'chats') renderChatsList();
    });
  });

  document.addEventListener('click', (e) => {
    const drop = document.getElementById('chatHeaderDropdown');
    if (drop && !drop.contains(e.target) && e.target !== btn) {
      drop.remove();
    }
  });
}
window._initChatHeaderMenu = initChatHeaderMenu;

/* ── Spinner (qidiruv yuklanishi) ─────────────────────────────────────── */
function _paintSearchSpinner() {
  const root = $('chatsListWrap');
  if (!root) return;
  let rowsWrap = document.getElementById('chatRowsWrap');
  if (!rowsWrap) {
    rowsWrap = document.createElement('div');
    rowsWrap.id = 'chatRowsWrap';
    root.appendChild(rowsWrap);
  }
  rowsWrap.innerHTML = '<div class="spin-wrap"><div class="spinner"></div></div>';
}

/* ── Paint only user rows (for search results / contacts) ────────────── */
function _paintUserRows(users, animate = false) {
  const root = $('chatsListWrap');
  if (!root) return;

  // Spinner yoki bo'sh placeholder ni o'chiramiz
  root.querySelectorAll('.spin-wrap, .empty').forEach(el => el.remove());

  let rowsWrap = document.getElementById('chatRowsWrap');
  if (!rowsWrap) {
    rowsWrap = document.createElement('div');
    rowsWrap.id = 'chatRowsWrap';
    root.appendChild(rowsWrap);
  }
  const chatMap = _latestChatMap;
  if (!users.length) {
    if (!_searchQuery.trim() && !getGroupRows().length) {
      rowsWrap.innerHTML = '<div class="empty tac" style="padding: 40px 16px;"><div class="fs-13px c-text2">Yangi suhbat boshlash uchun yuqoridagi qidiruvdan foydalaning</div></div>';
    } else {
      rowsWrap.innerHTML = '';
    }
    return;
  }
  const rows = users.map(u => ({ u, c: chatMap[u.uid] || null, pinned: _isPinned('dm', u.uid) }));
  rows.sort((a, b) => {
    // 1. Pinned users first
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    // 2. Latest message first
    const ta = a.c?.lastMessageAt || 0;
    const tb = b.c?.lastMessageAt || 0;
    if (ta !== tb) return tb - ta;
    // 3. Alphabetical
    return (a.u.fullName || '').localeCompare(b.u.fullName || '');
  });
  const html = rows.map(({ u, c, pinned }, idx) => {
    const av = u.avatar || defAvi(u.fullName || 'U');
    const isContact = _myContacts.has(u.uid);
    const online = isUidOnline(u.uid, isOnline(u.lastSeenAt));
    const isAdminUser = u.isAdmin || u.username === 'admin' || u.username === 'mrdevs' || u.username === 'mr';
    const rawPreview = c?.lastMessage || '';
    const formattedLastMsg = formatLastMessageText(rawPreview);
    const preview = c
      ? `${c.lastSenderId === state.me.uid ? 'You: ' : ''}${esc(formattedLastMsg.slice(0, 46))}`
      : isAdminUser ? "Admin bilan bog'lanish" : isContact ? 'Kontakt' : 'Yangi suhbat boshlash';
    const time   = c?.lastMessageAt ? fmt(c.lastMessageAt) : '';
    const unread = c?.unreadCount?.[state.me.uid] || 0;
    const badgeTxt = unread > 99 ? '+99' : '+' + unread;
    const pinHtml = pinned ? `<span class="chat-row-pin-ico" title="Qadalgan"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></span>` : '';
    const animStyle = '';
    return `<div class="chat-row${unread ? ' unread' : ''}${animate ? ' chat-row-anim' : ''}" data-uid="${u.uid}" ${animStyle}>
      <div class="chat-avi">
        <img src="${av}" onerror="this.style.display='none'">
        ${online ? '<span class="presence-dot" title="onlayn"></span>' : ''}
      </div>
      <div class="chat-row-body">
        <div class="chat-row-name">${esc(u.fullName || (u.username ? '@' + u.username : 'Foydalanuvchi'))}${u.username && u.fullName ? ` <span style="font-size:12px;font-weight:400;color:var(--text3)">@${esc(u.username)}</span>` : ''}</div>
        <div class="chat-row-preview${c ? '' : ' chat-row-empty'}">${preview}</div>
      </div>
      <div class="chat-row-right">
        ${pinHtml}
        ${time ? `<div class="chat-row-time">${time}</div>` : ''}
        ${unread ? `<div class="chat-row-badge">${badgeTxt}</div>` : ''}
      </div>
    </div>`;
  }).join('');
  rowsWrap.innerHTML = html;
  _injectPresenceCSS();
  rowsWrap.querySelectorAll('.chat-row').forEach(row => {
    _attachChatRowContextMenu(row);
    row.addEventListener('click', () => {
      const uid = row.dataset.uid;
      const u = users.find(x => x.uid === uid);
      if (u) {
        _saveRecent({ type: 'user', id: u.uid, name: u.fullName || u.username, username: u.username, avatar: u.avatar });
      }
      openChatThread(uid);
    });
  });
}

/**
 * MRdatabase — Suhbatlar (1-on-1 DM)
 * Suhbatlar ro'yxati: barcha ro'yxatdan o'tgan userlar
 * Chat thread: real vaqtli xabarlashish (Firestore onSnapshot)
 *
 * Firestore schema:
 *   chats/{chatId} {
 *     participants:[uidA,uidB], lastMessage, lastSenderId, lastMessageAt,
 *     unreadCount: { [uid]: number }   // har bir ishtirokchi uchun alohida hisob
 *   }
 *   chats/{chatId}/messages/{msgId} {
 *     senderId, text, createdAt,
 *     status: 'sent' | 'read',         // 1 ptichka / 2 ptichka uchun
 *     readAt                           // o'qilgan vaqt (status='read' bo'lganda)
 *   }
 *   chatId = [uidA, uidB] tartiblanib '_' bilan birlashtiriladi (har doim bitta xat ID)
 *
 * NOT: agar real qurilmada ptichkalar 1dan 2ga o'tmasa — Firestore Security
 * Rules'ni tekshiring. messages/{msgId} hujjatini OLDIN faqat senderId yozgan,
 * endi esa qabul qiluvchi (boshqa ishtirokchi) ham shu hujjatni "status: read"
 * qilib yangilashi kerak — demak update qoidasi faqat
 * `senderId == request.auth.uid` bilan emas, balki ikkala ishtirokchiga ham
 * ruxsat berishi kerak (masalan: request.auth.uid in get(parent chat).data.participants).
 */
import {
  sb, state, uploadViaController, isAdmin, fetchAllRows, mapProfile, mapChat, mapMessage,
  mediaPublicUrl, ts, SUPABASE_URL, SUPABASE_ANON_KEY, MEDIA_BUCKET
} from './config.js';
import { $, esc, renderMarkdown, defAvi, fmt, fmtTime, fmtSz, isOnline, formatLastSeen } from './utils.js';
import { toast }            from './toast.js';
import { initMsgMenu, msgMenuAfterPaint, msgMenuReset, isEditing, commitEdit } from './msg-menu.js';
import { dissolveMarks, markDissolve, playDeleteDissolve, dissolveGroupInfo } from './dissolve.js';
import { rateOk }           from './rate-limit.js';
import { initEmojiPicker } from './emoji-picker.js';
import { emojiOnlyClass } from './emoji-only.js';
import { openRt } from './rt-chat.js';
import { busOn, inboxSend, inboxWarm, isUidOnline } from './rt-bus.js';
import {
  startGroupsWatcher, stopGroupsWatcher, bindGroupsRealtime,
  openGroupThread, closeGroupThread,
  sendGroupMessage, sendGroupFile, sendGroupVoice, groupTypingInput, reloadGroupThread,
  injectGroupsDOM, openCreateChoice, getGroupRows,
  getCurrentGroupId, joinGroup, leaveGroup, searchGroups
} from './groups.js';
import {
  cacheChatsList, getCachedChatsList, getCachedChatsListAgeMs,
  cacheThreadMessages, getCachedThreadMessages, invalidateChatsListCache
} from './local-cache.js';
import {
  getPins as _getPins,
  isPinned as _isPinned,
  togglePin as _togglePin,
  getRecents as _getRecents,
  saveRecent as _saveRecent,
  removeRecent as _removeRecent,
  clearAllRecents as _clearAllRecents,
  markChatDeletedLocal,
  clearChatDeletedLocal,
  getChatDeletedAt,
} from './chat-storage.js';

const MSG_LIMIT = 60; // Bir thread'da max xabar soni (RAM tejash)

/* ── Helpers ──────────────────────────────────────────────────────────── */
const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tasdiqlangan va (muddati o'tmagan) bloklanmagan foydalanuvchi */
function _isActiveUser(u) {
  if (u.approval !== 'approved') return false;
  if (!u.blocked) return true;
  return !!(u.blockedUntil && u.blockedUntil < Date.now());
}
async function _fetchChatUsers() {
  const rows = await fetchAllRows('profiles', '*', 'created_at');
  return rows.map(mapProfile).filter(u => u.uid !== state.me.uid && _isActiveUser(u));
}

/** _usersCache 5 daqiqagacha keshlanadi — shu vaqt ichida `lastSeenAt` eskirib,
 * "onlayn" nuqta noto'g'ri o'chib/yonib qoladi. Faqat `last_seen` ni yengil
 * so'rov bilan yangilaymiz. O'zgarish bo'lsa true qaytaradi. */
async function _refreshUsersPresence() {
  if (!_usersCache || !_usersCache.length || !state.me) return false;
  if (document.visibilityState !== 'visible') return false;
  try {
    const rows = await fetchAllRows('profiles', 'id,last_seen', 'created_at');
    const seen = new Map((rows || []).map(r => [r.id, ts(r.last_seen)]));
    let changed = false;
    for (const u of _usersCache) {
      if (!seen.has(u.uid)) continue;
      const t = seen.get(u.uid);
      if (t !== u.lastSeenAt) { u.lastSeenAt = t; changed = true; }
    }
    return changed;
  } catch (_) { return false; }
}

let _threadUnsub = null;
let _reloadThread = null;

/* ── Tezkor yo'l (rt-chat.js): WebRTC DataChannel / broadcast ─────────────
 * _rtLocal — hali DB'dan tasdiqlanmagan (optimistik yoki p2p kelgan) xabarlar.
 * _rtRead  — p2p orqali "o'qildi" deb tasdiqlangan ID'lar (DB yangilanguncha). */
let _rt = null;
let _rtChatId = null;
const _rtLocal = new Map();
const _rtRead = new Set();
const _uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

function _rtMerge(msgs) {
  if (_rtLocal.size) {
    const have = new Set(msgs.map(m => m.id));
    for (const [id, m] of _rtLocal) {
      if (have.has(id) || Date.now() - m._at > 20000) _rtLocal.delete(id);
      else msgs.push(m);
    }
  }
  if (_rtRead.size) for (const m of msgs) if (_rtRead.has(m.id)) m.status = 'read';
  return msgs;
}

function _rtIncoming(m) {
  if (!m?.id || state.currentChatId !== _rtChatId) return;
  if (_rtLocal.has(m.id) || _curMsgs.some(x => x.id === m.id)) return;
  const now = Date.now();
  const msg = {
    id: m.id, chatId: _rtChatId, senderId: state.currentChatUid, type: 'text', text: m.text,
    mediaPath: null, mediaUrl: '', mediaType: null, fileName: null, fileSize: null, duration: null,
    status: 'sent', readAt: null, editedAt: null, createdAt: now, _at: now,
  };
  _rtLocal.set(m.id, msg);
  paintMessages([..._curMsgs, msg]);
  // Read: faqat xabar ekranda ko'rinsa (IntersectionObserver)
}

function _rtReadAck(ids) {
  const me = state.me?.uid;
  let changed = false;
  const next = _curMsgs.map(x => {
    if (x.senderId === me && ids.includes(x.id) && x.status !== 'read') { changed = true; return { ...x, status: 'read' }; }
    return x;
  });
  ids.forEach(id => { if (_curMsgs.some(x => x.id === id && x.senderId === me)) _rtRead.add(id); });
  if (changed) paintMessages(next);
}

function _rtRetract(id) {
  if (!_rtLocal.has(id)) return; // DB'da tasdiqlangan bo'lsa tegmaymiz
  _rtLocal.delete(id);
  markDissolve([id]);
  paintMessages(_curMsgs.filter(x => x.id !== id));
}
let _curMsgs = [];   // msg-menu.js uchun: paintMessages() ning oxirgi xabarlar ro'yxati
let _chatSelFile = null;

/* ── Global chats watcher (badge + chats list, real-time) ─────────────
   Bitta onSnapshot orqali HAR DOIM (foydalanuvchi qaysi view'da turishidan
   qat'i nazar) ishlaydi — login bo'lgan zahoti boshlanadi (auth.js orqali).
   Shu bitta listener ikki narsani ta'minlaydi:
     1) Sidebar/bottom-nav dagi "Suhbatlar" tugmasi ustidagi kichik qizil
        badge — barcha chatlardagi umumiy o'qilmagan xabarlar soni.
     2) Suhbatlar ro'yxati (har bir foydalanuvchi qatoridagi kattaroq badge) —
        agar foydalanuvchi hozir aynan shu view'da bo'lsa, real vaqtda
        qayta chiziladi.
   ──────────────────────────────────────────────────────────────────── */
let _chatsUnsub     = null;
let _usersCache     = null;
let _latestChatMap  = {};
let _watcherPromise = null;
let _noticeUnsub    = null;   // adminNotice real-time listener
let _loadNoticeFn   = null;   // 'chats-watcher' kanali admin_notice o'zgarganda shuni chaqiradi
let _presenceRepaintTick = null; // onlayn nuqtalarni vaqt bo'yicha yangilab turadi
let _latestNotice   = null;   // { text, target, createdAt } | null
let _contactsUnsub  = null;   // contacts real-time listener
let _myContacts     = new Set(); // current user's contact UIDs
let _groupsListenerAttached = false; // groupsUpdated leak oldini olish

function updateChatBadge(count) {
  const badge = $('chatBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = `+${count > 99 ? 99 : count}`;
    badge.classList.remove('d-none');
  } else {
    badge.textContent = '';
    badge.classList.add('d-none');
  }
}

/** Admin userni o'chirgan/bloklaganda chaqiriladi — hotira ichidagi va
 * localStorage'dagi kontaktlar (suhbat boshlash) keshini bekor qilib,
 * ro'yxatni Firestore'dan qayta yuklaydi (5 daqiqa kutilmaydi). */
export async function invalidateChatsUsersCache() {
  if (state.me?.uid) invalidateChatsListCache(state.me.uid);
  _usersCache = null;
  if (!state.me) return;
  try {
    _usersCache = await _fetchChatUsers();
    cacheChatsList(state.me.uid, _usersCache, _latestChatMap);
  } catch (err) {
    console.warn('[Chat] invalidateChatsUsersCache fetch failed:', err.message);
  }
  if (state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
}

export function startChatsWatcher() {
  // Also start groups watcher
  startGroupsWatcher();
  // Listen for group updates to repaint list — faqat BIR MARTA qo'shamiz
  if (!_groupsListenerAttached) {
    _groupsListenerAttached = true;
    document.addEventListener('groupsUpdated', () => {
      if (state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
    });
  }

  if (_chatsUnsub) return Promise.resolve();
  if (_watcherPromise) return _watcherPromise;

  _watcherPromise = (async () => {
    if (!state.me) return;

    // Agar kesh 5 daqiqadan yangi bo'lsa — butun "users" kolleksiyasini
    // qayta tarmoqdan yuklamaymiz (bu og'ir so'rov, foydalanuvchilar
    // ko'payib borgan sari sekinlashadi). Kesh eskirgan/yo'q bo'lsagina
    // yangilaymiz.
    const cacheAgeMs = getCachedChatsListAgeMs(state.me.uid);
    const cacheIsFresh = cacheAgeMs !== null && cacheAgeMs < 5 * 60 * 1000;

    if (cacheIsFresh) {
      // _usersCache hali o'rnatilmagan bo'lishi mumkin (masalan foydalanuvchi
      // "Suhbatlar" bo'limini hali ochmagan bo'lsa) — shu holatda ham
      // to'g'ridan-to'g'ri localStorage'dagi keshdan o'qib olamiz.
      if (!_usersCache || !_usersCache.length) {
        const cached = getCachedChatsList(state.me.uid);
        _usersCache = cached?.users || [];
      }
    }
    // Agar kesh bo'sh bo'lsa (yangi hisob ochilganda) — baribir serverdan yuklaymiz
    if (!_usersCache || !_usersCache.length) {
      try {
        _usersCache = await _fetchChatUsers();
        cacheChatsList(state.me.uid, _usersCache, _latestChatMap);
      } catch (err) {
        console.warn('[Chat] users fetch failed:', err.message);
        _usersCache = _usersCache || [];
      }
    }

    // Kontaktlar listener — oddiy user uchun contacts subcollection.
    // MUHIM: bu yerda ENDI hech narsani kutmaymiz (avval "birinchi snapshot
    // kelguncha yoki 5 soniya" deb sun'iy kutish bor edi — aynan shu
    // "10 soniya+" sekinlikning asosiy sababi edi). Listener fonda ishga
    // tushadi, ma'lumot kelganda ekran o'zi jimgina yangilanadi.
    if (!isAdmin() && !_contactsUnsub) {
      let _cDead = false;
      _contactsUnsub = () => { _cDead = true; };
      sb.from('contacts').select('contact_id').eq('owner_id', state.me.uid).then(({ data, error }) => {
        if (_cDead) return;
        if (error) { console.warn('[Chat] contacts load error:', error.message); return; }
        _myContacts = new Set((data || []).map(r => r.contact_id));
        if (state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
      });
    }

    if (!state.me) return; // logout race davomida

    // adminNotice real-time listener
    if (!_noticeUnsub) {
      let _nDead = false;
      const loadNotice = async () => {
        const { data } = await sb.from('admin_notice').select('*').eq('id', 'global').maybeSingle();
        if (_nDead) return;
        _latestNotice = data ? { text: data.text, target: data.target, createdAt: ts(data.created_at) } : null;
        if (state.view === 'chats') _repaintNoticeBanner();
      };
      // admin_notice o'zgarishini 'chats-watcher' kanali tinglaydi (5.3: alohida kanal yo'q)
      _noticeUnsub = () => { _nDead = true; };
      _loadNoticeFn = loadNotice;
      loadNotice();
    }

    let _chDead = false, _chTimer = null;
    const loadChats = async () => {
      const me = state.me?.uid;
      if (!me) return;
      const { data, error } = await sb.from('chats')
        .select('*, chat_members(user_id, unread_count)')
        .or(`user_a.eq.${me},user_b.eq.${me}`);
      if (_chDead || !state.me) return;
      if (error) { console.warn('[Chat] chats watcher error:', error.message); return; }
      const chatMap = {};
      let total = 0;
      (data || []).forEach(r => {
        const c = mapChat(r);
        const otherUid = c.participants.find(p => p !== me);
        if (otherUid) chatMap[otherUid] = c;
        total += c.unreadCount[me] || 0;
      });
      _latestChatMap = chatMap;
      updateChatBadge(total);
      if (_usersCache) cacheChatsList(state.me.uid, _usersCache, chatMap);
      if (state.view === 'chats') paintChatsList(_usersCache || [], chatMap);
    };
    // Realtime hodisa kelishi bilan DARHOL yuklaymiz (debounce yo'q); yuklanish paytida kelganlari birlashtiriladi
    let _chBusy = false, _chAgain = false;
    const schedChats = async () => {
      if (_chBusy) { _chAgain = true; return; }
      _chBusy = true;
      try { do { _chAgain = false; await loadChats(); } while (_chAgain && !_chDead); }
      finally { _chBusy = false; }
    };
    const chBase = sb.channel('chats-watcher')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notice' }, () => { _loadNoticeFn?.(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, schedChats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members', filter: `user_id=eq.${state.me.uid}` }, p => {
        // faqat typing/last_seen o'zgargan bo'lsa ro'yxatni qayta yuklamaymiz
        if (p.eventType === 'UPDATE' && p.old && p.new.unread_count === p.old.unread_count) return;
        schedChats();
      });
    // guruh o'zgarishlari ham shu kanalda (5.3: 'groups-watcher' kanali yo'q)
    const chCh = bindGroupsRealtime(chBase).subscribe();
    _chatsUnsub = () => { _chDead = true; clearTimeout(_chTimer); sb.removeChannel(chCh); };
    loadChats();

    // Onlayn nuqtalar vaqt o'tishi bilan (masalan user oflayn bo'lib qolganda)
    // o'zi so'nishi uchun — yangi ma'lumot kelmasa ham ro'yxatni davriy
    // qayta chizamiz (isOnline() joriy vaqtga qarab hisoblanadi).
    if (!_presenceRepaintTick) {
      _presenceRepaintTick = setInterval(async () => {
        if (state.view !== 'chats') return;
        await _refreshUsersPresence();
        if (state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
      }, 30000);
    }
  })();

  return _watcherPromise;
}

export function stopChatsWatcher() {
  stopGroupsWatcher();
  if (_chatsUnsub) { _chatsUnsub(); _chatsUnsub = null; }
  if (_noticeUnsub) { _noticeUnsub(); _noticeUnsub = null; }
  _loadNoticeFn = null;
  if (_contactsUnsub) { _contactsUnsub(); _contactsUnsub = null; }
  if (_presenceRepaintTick) { clearInterval(_presenceRepaintTick); _presenceRepaintTick = null; }
  _usersCache    = null;
  _latestChatMap = {};
  _latestNotice  = null;
  _myContacts    = new Set();
  _watcherPromise = null;
  _groupsListenerAttached = false;
  updateChatBadge(0);
}

/* ── Render chats list (all registered users) ───────────────────────── */
export async function renderChatsList() {
  const root = $('chatsListWrap');
  if (!root || !state.me) return;

  if (!_usersCache) {
    // Tarmoqni kutmasdan — keshdagi so'nggi ma'lumotni darhol ko'rsatamiz
    const cached = getCachedChatsList(state.me.uid);
    if (cached && cached.users && cached.users.length) {
      _usersCache    = cached.users;
      _latestChatMap = cached.chatMap || {};
      paintChatsList(_usersCache, _latestChatMap);
    } else {
      root.innerHTML = `<div class="spin-wrap pt-60px"><div class="spinner"></div></div>`;
    }
  }

  try {
    await startChatsWatcher();

    const hasUsers = !!(_usersCache && _usersCache.length);
    const hasGroups = !!(getGroupRows() && getGroupRows().length);

    if (!hasUsers && !hasGroups) {
      root.innerHTML = `<div class="empty pt-30vh tac">
        <div class="fs-14px fw-600 c-text mb-6px">Hozircha boshqa foydalanuvchilar yo'q</div>
        <div class="fs-13px c-text2">Odamlar SpaceMR ga qo'shilgach, shu yerda ko'rinadi</div>
      </div>`;
      return;
    }

    paintChatsList(_usersCache || [], _latestChatMap);
    // Ro'yxat ochilganda darhol yangi last_seen — nuqtalar kesh bilan eskirmasin
    _refreshUsersPresence().then(changed => {
      if (changed && state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
    });
  } catch (err) {
    console.error('renderChatsList failed:', err.message);
    root.innerHTML = `<div class="empty pt-30vh tac">
      <div class="fs-14px fw-600 c-text mb-6px">Suhbatlar yuklanmadi</div>
      <div class="fs-13px c-text2">${esc(err.message)}</div>
    </div>`;
  }
}

/* ── Admin notice banner (chats tepasida) ────────────────────────────── */
function _injectNoticeCSS() { /* CSS: mono-x.css .admin-notice-banner */ }

function _repaintNoticeBanner() {
  const wrap = $('chatsListWrap');
  if (!wrap) return;
  const existing = document.getElementById('adminNoticeBanner');
  if (existing) existing.remove();
  if (!_latestNotice || !_latestNotice.text) return;
  const t = _latestNotice.target || 'all';
  if (t === 'pending') return; // kutayotganlar uchun — chatda ko'rinmaydi
  _injectNoticeCSS();
  const html = `<div class="admin-notice-banner" id="adminNoticeBanner">
    <div class="admin-notice-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <div class="admin-notice-text">${esc(_latestNotice.text)}</div>
  </div>`;
  wrap.insertAdjacentHTML('afterbegin', html);
}

export function repaintNoticeBanner() { _repaintNoticeBanner(); }

/* ── Append group/channel rows to chats list ─────────────────────────── */
async function _appendGroupRows(root, term = '') {
  // Remove old group section if any
  root.querySelector('.grp-rows-section')?.remove();

  let groups = getGroupRows();
  if (term) {
    const local = groups.filter(g =>
      (g.name || '').toLowerCase().includes(term) ||
      (g.username || '').toLowerCase().includes(term)
    );
    try {
      const remote = await searchGroups(term);
      const map = new Map(local.map(g => [g.id, g]));
      (remote || []).forEach(g => map.set(g.id, g));
      groups = Array.from(map.values());
    } catch (_) {
      groups = local;
    }
  }
  if (!groups.length) return;

  const rows = groups.map(g => ({ g, pinned: _isPinned('group', g.id) }));
  rows.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const ta = a.g.lastMessageAt || 0;
    const tb = b.g.lastMessageAt || 0;
    if (ta !== tb) return tb - ta;
    return (a.g.name || '').localeCompare(b.g.name || '');
  });

  const section = document.createElement('div');
  section.className = 'grp-rows-section';

  section.innerHTML = `<div class="chats-section-label">Guruhlar</div>` +
    rows.map(({ g, pinned }) => {
      const av      = g.avatar || defAvi(g.name || 'G');
      const unread  = g.unreadCount?.[state.me?.uid] || 0;
      const badgeTxt = unread > 99 ? '+99' : `+${unread}`;
      const rawPreview = g.lastMessage || '';
      const formattedLastMsg = formatLastMessageText(rawPreview);
      const preview  = rawPreview ? esc(formattedLastMsg.slice(0, 46)) : 'Guruh';
      const time     = g.lastMessageAt ? fmt(g.lastMessageAt) : '';
      const typeIcon = `<svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      const badgeClass = 'chat-row-grp-badge--group';
      const pinHtml = pinned ? `<span class="chat-row-pin-ico" title="Qadalgan"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></span>` : '';
      const unameHtml = g.username ? `<span style="font-size:11.5px;color:var(--blue,#4a9eff);font-weight:500;margin-left:6px;">@${esc(g.username)}</span>` : '';

      return `<div class="chat-row${unread ? ' unread' : ''}" data-gid="${g.id}">
        <div class="chat-avi">
          <img src="${av}" onerror="this.style.display='none'">
          <div class="chat-row-grp-badge ${badgeClass}">${typeIcon}</div>
        </div>
        <div class="chat-row-body">
          <div class="chat-row-name">${esc(g.name || 'Guruh')}${unameHtml}</div>
          <div class="chat-row-preview">${preview}</div>
        </div>
        <div class="chat-row-right">
          ${pinHtml}
          ${time ? `<div class="chat-row-time">${time}</div>` : ''}
          ${unread ? `<div class="chat-row-badge">${badgeTxt}</div>` : ''}
        </div>
      </div>`;
    }).join('');

  root.appendChild(section);

  section.querySelectorAll('.chat-row[data-gid]').forEach(row => {
    _attachChatRowContextMenu(row);
    row.addEventListener('click', () => {
      const gid = row.dataset.gid;
      const g = groups.find(x => x.id === gid);
      if (g) {
        _saveRecent({ type: 'group', id: g.id, name: g.name, avatar: g.avatar });
      }
      openGroupThread(gid);
    });
  });
}

function paintChatsList(users, chatMap) {
  const root = $('chatsListWrap');
  if (!root) return;

  // Search box hamma uchun ko'rsatiladi
  _renderSearchBox(root);

  const rawQ = (_searchQuery || '').trim();
  const term = (rawQ.startsWith('@') ? rawQ.slice(1) : rawQ).toLowerCase();

  let filtered = users;
  if (term) {
    filtered = users.filter(u =>
      (u.username || '').toLowerCase().includes(term) ||
      (u.fullName || '').toLowerCase().includes(term)
    );
  } else {
    filtered = users.filter(u => _shouldShowInChatsList(u, chatMap));
  }
  _paintUserRows(filtered, !!term);
  _repaintNoticeBanner();
  _appendGroupRows(root, term);
}

/* ── Other user avatar cache for DM messages ─────────────────────────── */
let _otherUserAvi = '';
let _otherUserUid = '';

/* ── Peer onlayn holati (chat thread sarlavhasi uchun) ────────────────── */
let _peerUserUnsub = null;
let _peerStatusTick = null;
let _peerLastSeenAt = null;
let _chatDocUnsub = null;
let _peerTyping = false;
let _onPeerTyping = () => {};
let _iAmTyping = false;
let _typingTimeout = null;
let _typingCh = null;      // joriy DM uchun BITTA doimiy broadcast kanal (yuborish + qabul)
let _typingChReady = false;

function _paintPeerStatus(lastSeenAt) {
  _peerLastSeenAt = lastSeenAt;
  const el = $('chatTypingStatus');
  if (!el) return;
  if (_peerTyping) {
    el.textContent = 'yozmoqda...';
    el.classList.add('online');
    return;
  }
  const online = isUidOnline(state.currentChatUid, isOnline(lastSeenAt));
  el.textContent = online ? 'onlayn' : formatLastSeen(lastSeenAt);
  el.classList.toggle('online', online);
}

/* ── "Yozmoqda..." — realtime broadcast (bazaga yozilmaydi) ──────────────
 * Chat ochilganda BITTA kanal (`typing-bc-<chatId>`) ochiladi (openChatThread),
 * ikki tomon ham shunga obuna; yuboruvchi shu kanaldan `send` qiladi.
 * Kanal chat yopilganda olib tashlanadi. Faqat DM.
 ─────────────────────────────────────────────────────────────────────── */
function _setTyping(isTyping) {
  if (!state.currentChatId || !state.me) return;
  if (_iAmTyping === isTyping) return; // ortiqcha yuborishlarni oldini olish
  if (!(_rt?.isP2P()) && (!_typingCh || !_typingChReady)) return; // kanal hali ulanmagan
  _iAmTyping = isTyping;
  try {
    if (_rt?.isP2P()) { _rt.sendTyping(isTyping); return; }
    _typingCh.send({ type: 'broadcast', event: 'typing', payload: { uid: state.me.uid, typing: isTyping } });
  } catch (_) {}
}

function _onChatInputTyping() {
  // Faqat 1v1 (DM) chatda ishlaydi — guruh/kanalda alohida mantiq kerak
  if (state.currentChatKind && state.currentChatKind !== 'dm') { groupTypingInput(); return; }
  _setTyping(true);
  clearTimeout(_typingTimeout);
  _typingTimeout = setTimeout(() => _setTyping(false), 2500);
}

/* ── Tezkor kirish qutisi: boshqa tomondan kelgan xabar ro'yxatni shu zahoti yangilaydi ── */
busOn('inbox', (o) => {
  const me = state.me?.uid;
  if (!me || !o || !o.from || o.from === me || typeof o.chatId !== 'string') return;
  if (state.currentChatId === o.chatId && $('chatThreadModal')?.classList.contains('show')) return; // ochiq thread p2p/DB orqali
  const prev = _latestChatMap[o.from];
  if (prev && prev.lastMessageId === o.id) return;
  const unread = { ...(prev?.unreadCount || {}) };
  unread[me] = (unread[me] || 0) + 1;
  _latestChatMap = {
    ..._latestChatMap,
    [o.from]: {
      ...(prev || { id: o.chatId, participants: [me, o.from], createdAt: o.ts }),
      lastMessage: String(o.text || '').slice(0, 120), lastMessageId: o.id,
      lastSenderId: o.from, lastMessageAt: o.ts || Date.now(), unreadCount: unread,
    },
  };
  updateChatBadge(Object.values(_latestChatMap).reduce((n, c) => n + (c.unreadCount?.[me] || 0), 0));
  if (state.view === 'chats') paintChatsList(_usersCache || [], _latestChatMap);
});
document.addEventListener('presenceChanged', () => {
  if (state.view === 'chats' && _usersCache) paintChatsList(_usersCache, _latestChatMap);
  if (state.currentChatUid && $('chatTypingStatus')) _paintPeerStatus(_peerLastSeenAt);
});

/* ── Open chat thread ─────────────────────────────────────────────────── */
export async function openChatThread(uid) {
  if (!uid || !state.me || uid === state.me.uid) return;
  msgMenuReset();

  state.currentChatKind = 'dm';
  document.getElementById('groupJoinBar')?.remove();
  document.getElementById('chatHeaderDropdown')?.remove();
  const inputRow = document.querySelector('.chat-thread-input-row');
  if (inputRow) inputRow.style.display = '';
  initChatHeaderMenu();

  _injectPresenceCSS();
  $('chatThreadModal').classList.add('show');
  $('chatThreadName').textContent   = '...';
  $('chatThreadAvi').innerHTML      = '';
  $('chatThreadInput').value        = '';
  autoGrowChatInput();
  updatePostAttachBar();

  state.currentChatUid = uid;
  let chatId = _latestChatMap[uid]?.id;
  if (!chatId || !_UUID_RE.test(chatId)) {
    const { data, error } = await sb.rpc('get_or_create_chat', { p_other: uid });
    if (error || !data) {
      console.warn('[Chat] get_or_create_chat:', error?.message);
      toast('Suhbat ochilmadi', 'error');
      closeChatThread();
      return;
    }
    if (state.currentChatUid !== uid) return; // shu orada boshqa chatga o'tilgan
    chatId = data;
  }
  state.currentChatId = chatId;
  // Boshqa chatga o'tilganda ID-kuzatuvchini tozalaymiz — aks holda Set
  // cheksiz o'sib ketishi mumkin va yangi chatning birinchi ochilishida
  // xabarlar tabiiy tarzda "pop-in" bo'lishi kerak.
  if (_seenMsgIdsChatId !== chatId) {
    _seenMsgIds = new Set();
    _seenMsgIdsChatId = chatId;
    _seenBaselineDone = false;
    _msgAnimStart.clear();
    _dissolving.clear(); dissolveMarks.clear();
  }
  // Agar hozir ijro etilayotgan ovozli xabar aynan shu chatga tegishli
  // bo'lsa — mini-pleer bar endi kerak emas (xabar o'zi thread ichida
  // ko'rinadi), aks holda bar davom etib turadi.
  try { _syncMiniPlayer(); } catch (_) {}

  // Tarmoqni kutmasdan — keshdagi so'nggi xabarlarni darhol ko'rsatamiz
  const _cachedMsgs = getCachedThreadMessages(chatId);
  if (_cachedMsgs && _cachedMsgs.length) {
    paintMessages(_cachedMsgs);
  } else {
    $('chatThreadMessages').innerHTML = `<div class="spin-wrap pt-60px"><div class="spinner"></div></div>`;
  }
  // Reset voice/file state (functions defined below, safe after page load)
  try { cancelRecording(); } catch(_) {}
  $('chatVoiceBtn')?.classList.remove('active');
  _chatSelFile = null;
  $('chatFilePreview')?.classList.remove('active');
  $('chatFileInput') && ($('chatFileInput').value = '');
  try { updateVoiceSendBtn(); } catch(_) {}

  const videoBtn = $('chatVideoCallBtn');
  if (videoBtn) videoBtn.style.display = '';
  const voiceCallBtn = $('chatVoiceCallBtn');
  if (voiceCallBtn) voiceCallBtn.style.display = '';
  try {
    const { data: prow } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    const ud = mapProfile(prow) || {};
    const av = ud.avatar || defAvi(ud.fullName || 'U');
    $('chatThreadName').textContent = ud.fullName || 'Foydalanuvchi';
    $('chatThreadAvi').innerHTML = `<img src="${av}" onerror="this.style.display='none'">`;
    _paintPeerStatus(ud.lastSeenAt);
    // Cache for message avatars
    _otherUserAvi = av;
    _otherUserUid = uid;
  } catch (err) {
    console.warn('[Chat] Failed to load user info:', err.message);
    _otherUserAvi = defAvi('U');
    _otherUserUid = uid;
  }

  // Onlayn holatni real vaqtda kuzatib turish — peer user hujjatidagi
  // `lastSeenAt` heartbeat orqali yangilanganda darhol sarlavhada ko'rinsin.
  if (_peerUserUnsub) { _peerUserUnsub(); _peerUserUnsub = null; }
  {
    const pch = sb.channel('peer-' + uid)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
          p => _paintPeerStatus(ts(p.new?.last_seen)))
      .subscribe();
    _peerUserUnsub = () => sb.removeChannel(pch);
  }
  // "Onlayn"dan "N daqiqa oldin"ga o'tishini ko'rsatish uchun har 20s da
  // matnni qayta hisoblaymiz (server yozuvi o'zgarmasa ham vaqt o'tadi).
  if (_peerStatusTick) clearInterval(_peerStatusTick);
  _peerStatusTick = setInterval(() => _paintPeerStatus(_peerLastSeenAt), 20000);

  // "Yozmoqda..." — realtime broadcast (typing_until ustuni yo'q)
  _peerTyping = false;
  _iAmTyping = false;
  if (_chatDocUnsub) { _chatDocUnsub(); _chatDocUnsub = null; }
  {
    let tTimer = null;
    _onPeerTyping = (v) => {
      clearTimeout(tTimer);
      _peerTyping = !!v;
      if (_peerTyping) tTimer = setTimeout(() => { _peerTyping = false; _paintPeerStatus(_peerLastSeenAt); }, 5000);
      _paintPeerStatus(_peerLastSeenAt);
    };
    const tch = sb.channel('typing-bc-' + chatId)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.uid !== uid) return;
        _onPeerTyping(payload.typing);
      })
      .subscribe(st => { if (tch === _typingCh) _typingChReady = (st === 'SUBSCRIBED'); });
    _typingCh = tch;
    _typingChReady = false;
    _chatDocUnsub = () => {
      clearTimeout(tTimer);
      if (_typingCh === tch) { _typingCh = null; _typingChReady = false; }
      sb.removeChannel(tch);
    };
  }

  // Tezkor yo'l: WebRTC DataChannel (zaxira: broadcast). Baza baribir asosiy.
  if (_rt) { _rt.close(); _rt = null; }
  _rtLocal.clear(); _rtRead.clear();
  _rtChatId = chatId;
  _rt = openRt(chatId, uid, { onMsg: _rtIncoming, onRead: _rtReadAck, onRetract: _rtRetract, onTyping: (v) => _onPeerTyping(v) });
  inboxWarm(uid);

  // unread_count endi faqat ekranda ko'rilgan xabarlar bo'yicha kamayadi (IntersectionObserver)

  // Kontaktlarni saqlash — xato bo'lsa chat ochilishga ta'sir qilmaydi.
  try {
    const od = (_usersCache || []).find(u => u.uid === uid) || {};
    const { error: cErr } = await sb.from('contacts').upsert(
      { owner_id: state.me.uid, contact_id: uid, full_name: od.fullName || '', avatar: od.avatar || '' },
      { onConflict: 'owner_id,contact_id' }
    );
    if (cErr) throw cErr;
    _myContacts.add(uid);
  } catch (err) {
    console.warn('[Chat] Failed to save contacts:', err.message);
  }

  if (_threadUnsub) { _threadUnsub(); _threadUnsub = null; }

  let _tDead = false, _tTimer = null, _tLoaded = false;
  const loadThread = async () => {
    const { data, error } = await sb.from('messages').select('*')
      .eq('chat_id', chatId).order('created_at', { ascending: false }).limit(MSG_LIMIT);
    if (_tDead) return;
    if (error) {
      console.warn('[Chat] Thread load error:', error.message);
      if (!(_cachedMsgs && _cachedMsgs.length)) {
        $('chatThreadMessages').innerHTML = `<div class="empty pt-30vh tac">
          <div class="fs-13px c-text2">Xabarlar yuklanmadi</div>
        </div>`;
      }
      return;
    }
    const msgs = (data || []).map(mapMessage).reverse();
    paintMessages(_rtMerge(msgs.slice()));
    _tLoaded = true;
    cacheThreadMessages(chatId, msgs);
    // Read: faqat ekranda ko'rinadigan xabarlar (paintMessages -> _observeMessagesForRead)
  };
  const schedThread = () => { clearTimeout(_tTimer); _tTimer = setTimeout(loadThread, 0); };
  // Realtime payload'ni qayta yuklamasdan shu zahoti qo'llaymiz (INSERT/UPDATE/DELETE)
  const applyThreadPayload = (p) => {
    if (_tDead || state.currentChatId !== chatId) return;
    if (!_tLoaded) { schedThread(); return; }
    const ev = p.eventType;
    if (ev === 'DELETE') {
      const delId = p.old?.id;
      if (!delId) { schedThread(); return; }
      _rtLocal.delete(delId);
      markDissolve([delId]);
      paintMessages(_curMsgs.filter(x => x.id !== delId));
      return;
    }
    const m = mapMessage(p.new);
    if (!m || !m.id) { schedThread(); return; }
    _rtLocal.delete(m.id);
    if (_rtRead.has(m.id)) m.status = 'read';
    const list = _curMsgs.slice();
    const i = list.findIndex(x => x.id === m.id);
    if (i >= 0) list[i] = m;
    else if (ev === 'INSERT') list.push(m);
    else { schedThread(); return; }
    paintMessages(list);
    // Read: observer yangi xabarni ekranda ko'ringanda belgilaydi
  };
  const mch = sb.channel('thread-' + chatId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, applyThreadPayload)
    .subscribe(st => { if (st === 'SUBSCRIBED') schedThread(); });
  _threadUnsub = () => { _tDead = true; clearTimeout(_tTimer); sb.removeChannel(mch); };
  _reloadThread = loadThread;
  loadThread();
}

/* ── Read receipts: faqat ekranda KO'RINGAN xabarlar o'qilgan deb belgilanadi ── */
let _readObs = null;
const _pendingReadIds = new Set();
let _readFlushTimer = null;
const _locallyReadIds = new Set(); // shu sessiya ichida o'qilgan (qayta yubormaslik)

function _teardownReadObserver() {
  if (_readObs) { try { _readObs.disconnect(); } catch (_) {} _readObs = null; }
  _pendingReadIds.clear();
  clearTimeout(_readFlushTimer);
  _readFlushTimer = null;
}

async function markThreadRead(chatId, otherUid, msgs) {
  if (!state.me || !chatId || !otherUid) return;
  const unread = (msgs || []).filter(m =>
    m && m.senderId === otherUid && m.status !== 'read' && !_locallyReadIds.has(m.id)
  );
  if (!unread.length) return;
  const ids = unread.map(m => m.id);
  ids.forEach(id => _locallyReadIds.add(id));

  try {
    const { error } = await sb.from('messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .in('id', ids);
    if (error) throw error;

    _curMsgs = _curMsgs.map(m => ids.includes(m.id) ? { ...m, status: 'read' } : m);

    const remaining = _curMsgs.filter(m =>
      m.senderId === otherUid && m.status !== 'read' && !_locallyReadIds.has(m.id)
    ).length;
    await sb.from('chat_members').update({ unread_count: remaining })
      .eq('chat_id', chatId).eq('user_id', state.me.uid);

    try { _rt?.sendRead(ids); } catch (_) {}
  } catch (err) {
    ids.forEach(id => _locallyReadIds.delete(id));
    console.error('markThreadRead failed:', err.message);
  }
}

function _flushVisibleReads() {
  _readFlushTimer = null;
  const chatId = state.currentChatId;
  const otherUid = state.currentChatUid;
  if (!chatId || !otherUid || !state.me) { _pendingReadIds.clear(); return; }
  if (document.visibilityState !== 'visible') return;
  if (!$('chatThreadModal')?.classList.contains('show')) return;

  const ids = [..._pendingReadIds];
  _pendingReadIds.clear();
  if (!ids.length) return;
  const msgs = _curMsgs.filter(m => ids.includes(m.id));
  markThreadRead(chatId, otherUid, msgs);
}

function _observeMessagesForRead() {
  const box = $('chatThreadMessages');
  if (!box) return;

  if (!_readObs) {
    _readObs = new IntersectionObserver((entries) => {
      if (document.visibilityState !== 'visible') return;
      if (!$('chatThreadModal')?.classList.contains('show')) return;
      const peer = state.currentChatUid;
      if (!peer) return;
      let any = false;
      for (const e of entries) {
        if (!e.isIntersecting || e.intersectionRatio < 0.4) continue;
        const id = e.target?.dataset?.msgId;
        if (!id) continue;
        if (_locallyReadIds.has(id) || _pendingReadIds.has(id)) continue;
        const m = _curMsgs.find(x => x.id === id);
        if (!m || m.senderId !== peer || m.status === 'read') continue;
        _pendingReadIds.add(id);
        any = true;
      }
      if (any) {
        clearTimeout(_readFlushTimer);
        _readFlushTimer = setTimeout(_flushVisibleReads, 180);
      }
    }, {
      root: box,
      rootMargin: '0px',
      threshold: [0.4, 0.6, 0.85],
    });
  } else {
    try { _readObs.disconnect(); } catch (_) {}
  }

  const peer = state.currentChatUid;
  if (!peer) return;
  box.querySelectorAll('.chat-msg[data-msg-id]').forEach(el => {
    const id = el.dataset.msgId;
    if (!id || _locallyReadIds.has(id)) return;
    const m = _curMsgs.find(x => x.id === id);
    if (m && m.senderId === peer && m.status !== 'read') {
      _readObs.observe(el);
    }
  });
}

function renderTicks(status) {
  // 'sending' = clock (hali yuborilmoqda), 'read' = 2 ko'k chek, boshqa = 1 oq chek
  if (status === 'sending') {
    return `<svg class="msg-ticks sending" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" title="Yuborilmoqda">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" opacity="0.85"/>
      <path d="M12 7v5.2l3.2 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  if (status === 'read') {
    return `<svg class="msg-ticks read" width="18" height="11" viewBox="0 0 18 11" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 5.5L4.5 9L10 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 5.5L9.5 9L16 1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  // sent
  return `<svg class="msg-ticks" width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 5.2L4.5 8.5L11 1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ── Voice waveform bars ──────────────────────────────────────────────
 * Boshlanishida — tekis (flat) past bar'lar (real ma'lumot hali yo'q).
 * Audio fayl fonda decode qilingach, har bir bar shu segmentdagi
 * HAQIQIY ovoz amplitudasiga (RMS) qarab balandligini oladi —
 * `_hydrateVoiceWaveforms()` orqali. Shu tufayli baland ovoz — baland
 * bar, past/jim joy — past bar bo'ladi (sun'iy sinus emas). */
const CVM_MIN_BARS  = 50;  // eng qisqa xabar uchun bar soni
const CVM_MAX_BARS  = 80;  // eng uzun xabar uchun bar soni
const CVM_BAR_COUNT = CVM_MIN_BARS; // fallback (davomiylik noma'lum bo'lganda)
const CVM_MIN_H = 3;   // tekis bazaviy balandlik (px)
const CVM_MAX_H = 24;  // eng baland pik (px) — ingichka, zich barlar bilan muvozanatli

/* Telegram — bar sonini xabar davomiyligiga qarab dinamik hisoblaydi:
 * qisqa ovozli xabar ~50 ta ingichka bar, uzunrog'i (≈20s+) esa ~80
 * tagacha bar bilan chiziladi — natijada wave zich va aniq ko'rinadi. */
function _voiceBarCount(duration) {
  const d = Number(duration) || 0;
  if (d <= 0) return CVM_MIN_BARS;
  const count = Math.round(d * 4); // ≈4 bar/soniya
  return Math.max(CVM_MIN_BARS, Math.min(CVM_MAX_BARS, count));
}

function renderVoiceWave(seed = 0, count = CVM_BAR_COUNT) {
  let bars = '';
  for (let i = 0; i < count; i++) {
    bars += `<span class="cvm-bar" style="height:${CVM_MIN_H}px"></span>`;
  }
  return bars;
}

/* url → Promise<number[] | null> (har bir qiymat 0..1, normalizatsiya
 * qilingan RMS amplituda). Bir xil xabar ikki marta decode qilinmasin
 * deb keshlaymiz. */
const _waveformCache = new Map();

function _getWaveformData(url, count = CVM_BAR_COUNT) {
  if (!url) return Promise.resolve(null);
  const cacheKey = `${url}::${count}`;
  if (_waveformCache.has(cacheKey)) return _waveformCache.get(cacheKey);

  const promise = (async () => {
    try {
      // cache: 'no-store' — brauzer HTTP keshida (yoki avval boshqa joyda
      // <audio> orqali Range so'rov bilan olingan qisman/206 javobda)
      // qolib ketgan noto'liq baytlarni QAYTA ISHLATMASLIK uchun. Har
      // safar to'liq, yangi oqim so'raladi — shu orqali "Unable to
      // decode audio data" xatosining eng keng tarqalgan sababi
      // (keshdagi buzuq/qisman fayl) bartaraf etiladi.
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrBuf = await res.arrayBuffer();
      if (!arrBuf || arrBuf.byteLength === 0) throw new Error('Bo\'sh audio bufer');
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const audioBuf = await ctx.decodeAudioData(arrBuf.slice(0));
      const raw = audioBuf.getChannelData(0); // 1-kanal yetarli
      const blockSize = Math.max(1, Math.floor(raw.length / count));
      const peaks = [];
      for (let i = 0; i < count; i++) {
        const start = i * blockSize;
        const end = Math.min(raw.length, start + blockSize);
        let sumSq = 0, n = 0;
        for (let j = start; j < end; j++) { sumSq += raw[j] * raw[j]; n++; }
        // RMS — segmentning haqiqiy energiya/chastota darajasi
        peaks.push(n ? Math.sqrt(sumSq / n) : 0);
      }
      try { ctx.close(); } catch (_) {}
      const max = Math.max(...peaks, 0.0001);
      return peaks.map(v => Math.min(1, v / max));
    } catch (e) {
      // e?.message || e — Error obyektining o'z xususiyatlari (message,
      // stack) enumerable emas, shuning uchun ba'zi konsollarda to'g'ridan
      // to'g'ri Error obyektini chop etsak "Error {}" (bo'sh) ko'rinadi va
      // haqiqiy sabab (masalan "Failed to fetch" — odatda CORS yoki
      // noto'g'ri/eskirgan Supabase Storage URL) yashirinib qoladi.
      console.warn('Waveform ajratib olishda xato:', e?.message || e?.name || e, '| url:', url);
      // MUHIM (flat-forever fix): agar shu (muvaffaqiyatsiz) natijani
      // keshda saqlab qo'ysak, chat ro'yxati Firestore yangilanishi bilan
      // qayta chizilganda (bu tez-tez sodir bo'ladi) HAR SAFAR shu keshdagi
      // "null"ni qaytarib, xabar ABADIY tekis (flat) ko'rinib qolardi —
      // hatto vaqtinchalik tarmoq xatosi tuzalgan bo'lsa ham. Xato holatini
      // keshdan o'chiramiz — shunda keyingi qayta chizilishda (re-render)
      // qaytadan haqiqiy urinish (retry) qilinadi.
      _waveformCache.delete(cacheKey);
      return null; // xato bo'lsa — tekis holat saqlanib qoladi
    }
  })();

  _waveformCache.set(cacheKey, promise);
  return promise;
}

/* Bir vaqtning o'zida ko'p ovozli xabar fon fonida dekod qilinsa,
 * server/tarmoqqa haddan tashqari ko'p parallel so'rov ketib, hatto
 * <audio> elementining o'zi ham yuklanishida muammo tug'dirishi mumkin
 * (masalan "no supported source" xatosi). Shu sabab — navbat orqali
 * bir vaqtda faqat 2 tasi dekod qilinadi, qolganlari navbatda kutadi. */
const CVM_MAX_CONCURRENT = 2;
let _cvmActiveDecodes = 0;
const _cvmQueue = [];

function _cvmRunQueue() {
  while (_cvmActiveDecodes < CVM_MAX_CONCURRENT && _cvmQueue.length) {
    const job = _cvmQueue.shift();
    _cvmActiveDecodes++;
    job().finally(() => {
      _cvmActiveDecodes--;
      _cvmRunQueue();
    });
  }
}

function _cvmEnqueue(job) {
  _cvmQueue.push(job);
  _cvmRunQueue();
}

/* Faqat foydalanuvchi haqiqatan ko'rayotgan (viewportga yaqin) ovozli
 * xabarlar uchun waveform yuklaymiz — chat ochilishi bilanoq o'nlab
 * xabarning to'liq audio faylini fon fonida yuklab yubormaymiz. */
let _cvmObserver = null;
function _cvmGetObserver() {
  if (_cvmObserver) return _cvmObserver;
  _cvmObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const waveEl = entry.target;
      _cvmObserver.unobserve(waveEl);
      _cvmStartHydrate(waveEl);
    });
  }, { root: null, rootMargin: '200px', threshold: 0.01 });
  return _cvmObserver;
}

function _cvmStartHydrate(waveEl) {
  const wrap = waveEl.closest('.chat-voice-msg');
  const url = wrap?.dataset.url;
  // Bar soni renderVoiceWave() chizganidagi son bilan bir xil bo'lishi kerak
  // (aks holda haqiqiy amplituda qiymatlari bar'lar bilan mos kelmay qoladi).
  const count = parseInt(wrap?.dataset.barCount, 10) || CVM_BAR_COUNT;
  if (!url || waveEl.dataset.hydrated === '1' || waveEl.dataset.hydrated === 'pending') return;
  waveEl.dataset.hydrated = 'pending';
  _cvmEnqueue(() => _getWaveformData(url, count).then(data => {
    if (!waveEl.isConnected) return;
    if (!data) { waveEl.dataset.hydrated = ''; return; }
    waveEl.dataset.hydrated = '1';
    const bars = waveEl.querySelectorAll('.cvm-bar');
    bars.forEach((b, i) => {
      const v = data[i] ?? 0;
      const h = CVM_MIN_H + v * (CVM_MAX_H - CVM_MIN_H);
      b.style.height = `${h.toFixed(1)}px`;
    });
  }));
}

/* Berilgan konteyner ichidagi hali "hydrate" qilinmagan barcha voice
 * xabarlarni kuzatuvga (IntersectionObserver) qo'shadi — har biri
 * faqat ekranga yaqinlashganda navbat orqali dekod qilinadi. */
function _hydrateVoiceWaveforms(container) {
  if (!container) return;
  const observer = _cvmGetObserver();
  const wraps = container.querySelectorAll('.chat-voice-msg[data-url]');
  wraps.forEach(wrap => {
    const waveEl = wrap.querySelector('.cvm-waveform');
    if (!waveEl || waveEl.dataset.hydrated === '1' || waveEl.dataset.hydrated === 'pending') return;
    observer.observe(waveEl);
  });
}

/* ── Xabar pufakchalari uchun "bounce" (pop-in) animatsiyasi qaysi
 * xabarlarga tegishli ekanini ANIQ, ID asosida kuzatamiz.
 *
 * ESKI USUL MUAMMOSI: oldin `idx >= prevCount` (ya'ni "avvalgi chizishda
 * nechta .chat-msg bor edi") solishtirilardi. Lekin "...yozmoqda"
 * pufakchasi HAM `.chat-msg` klassiga ega va u paintMessages()
 * dan TASHQARIDA, to'g'ridan-to'g'ri box.appendChild() bilan qo'shiladi/
 * o'chiriladi. Natijada `box.querySelectorAll('.chat-msg').length` real
 * Firestore xabarlar soniga har doim mos kelmasdi (goh ortiq, goh kam) —
 * xabar yuborilganda yoki xabar yangilanganda (bularning har biri messages'ga alohida
 * onSnapshot signalini qo'zg'atadi) `prevCount` noto'g'ri chiqib, ko'p
 * hollarda BARCHA xabarlar "yangi" deb hisoblanib, hammasi bir vaqtda
 * "bounce" bo'lib qolardi.
 *
 * YECHIM: har bir xabarning barqaror Firestore ID'si orqali — "shu ID
 * avval chizilganmi?" — tekshiramiz. Faqat HAQIQIY yangi (hali hech
 * qachon chizilmagan) xabar bounce bo'ladi; status/audioUrl kabi
 * maydonlar yangilanib qayta chizilganda eski xabarlar tegilmaydi. */
let _seenMsgIds = new Set();
let _seenMsgIdsChatId = null;
// Telegram uslubidagi "yangi xabar keldi" animatsiyasi:
// chat ilk ochilganda (baseline) animatsiya YO'Q — faqat chatda o'tirganda kelgan xabarga.
let _seenBaselineDone = false;
const _msgAnimStart = new Map();      // msgId -> animatsiya boshlangan vaqt (repaint bo'lsa ham davom etishi uchun)
const MSG_ANIM_MS = 360;
// O'chirilgan xabar "qum bo'lib sochilib ketishi" (MRdrive animatsiyasi) — jarayondagilar repaint'dan omon qoladi
const _dissolving = new Map();   // msgId -> { id, el, nextId }
function _dissolvePrepare(box, newIds, canStart) {
  const started = [];
  if (!canStart || !dissolveMarks.size) return started;
  box.querySelectorAll('.chat-msg[data-msg-id]').forEach(el => {
    const id = el.dataset.msgId;
    if (!id || !dissolveMarks.has(id) || newIds.has(id) || _dissolving.has(id)) return;
    let nx = el.nextElementSibling;
    while (nx && !(nx.classList.contains('chat-msg') && newIds.has(nx.dataset.msgId))) nx = nx.nextElementSibling;
    // Animatsiyani to'xtatib o'lchamni saqlaymiz (sakrash/kichrayish bo'lmasin)
    el.style.animation = 'none';
    el.style.transform = 'none';
    el.classList.remove('anim-in');
    el.style.animationDelay = '';
    const r = el.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * 100) / 100);
    const h = Math.max(1, Math.round(r.height * 100) / 100);
    el.style.boxSizing = 'border-box';
    el.style.width = w + 'px';
    el.style.minWidth = w + 'px';
    el.style.maxWidth = w + 'px';
    el.style.height = h + 'px';
    el.style.minHeight = h + 'px';
    el.style.maxHeight = h + 'px';
    el.style.overflow = 'hidden';
    el.style.flexShrink = '0';
    const bub = el.querySelector('.chat-bubble');
    if (bub) {
      const br = bub.getBoundingClientRect();
      const bw = Math.max(1, Math.round(br.width * 100) / 100);
      const bh = Math.max(1, Math.round(br.height * 100) / 100);
      bub.style.boxSizing = 'border-box';
      bub.style.width = bw + 'px';
      bub.style.minWidth = bw + 'px';
      bub.style.maxWidth = bw + 'px';
      bub.style.height = bh + 'px';
      bub.style.minHeight = bh + 'px';
      bub.style.flexShrink = '0';
    }
    el.classList.add('msg-dissolving');
    const rec = { id, el, nextId: nx ? nx.dataset.msgId : null };
    _dissolving.set(id, rec);
    started.push(rec);
    dissolveMarks.delete(id);
  });
  return started;
}
function _dissolveRestore(box, started) {
  if (!_dissolving.size) return;
  for (const rec of _dissolving.values()) {
    if (rec.el.parentNode === box) continue;
    let ref = null;
    if (rec.nextId) {
      const q = (window.CSS && CSS.escape) ? CSS.escape(rec.nextId) : rec.nextId;
      ref = box.querySelector(`.chat-msg[data-msg-id="${q}"]`);
      if (ref && ref.previousElementSibling?.classList.contains('chat-date-sep')) ref = ref.previousElementSibling;
    }
    box.insertBefore(rec.el, ref);
  }
  if (!started.length) return;
  const group = dissolveGroupInfo(started.map(r => r.el));
  started.forEach(rec => {
    playDeleteDissolve(rec.el, undefined, undefined, group)
      .catch(() => {})
      .finally(() => {
        _dissolving.delete(rec.id);
        try { rec.el.remove(); } catch (_) {}
        if (!_dissolving.size && !_curMsgs.length) paintMessages([]);
      });
  });
}
function _isFreshMsg(m) {
  const d = _toDateSafe(m.createdAt);
  return !d || (Date.now() - d.getTime()) < 30000;   // eski (keshdan/oflayndan kelgan) xabar animatsiya qilinmaydi
}

/* ── Sana ajratuvchi (Telegram uslubida "Bugun" / "Kecha" / "12-iyul") ── */
export function _toDateSafe(ts) {
  if (!ts) return null;
  return new Date(ts);
}
export function _isSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
const _UZ_MONTHS = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
export function _dateSepLabel(ts) {
  const d = _toDateSafe(ts);
  if (!d) return '';
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (_isSameDay(d, now)) return 'Bugun';
  if (_isSameDay(d, yesterday)) return 'Kecha';
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? `${d.getDate()}-${_UZ_MONTHS[d.getMonth()]}`
    : `${d.getDate()}-${_UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function paintMessages(msgs, grp = null) {
  const box = $('chatThreadMessages');
  if (!box) return;
  _curMsgs = msgs;

  if (!msgs.length) {
    const _dsE = _dissolvePrepare(box, new Set(), _seenBaselineDone);
    _seenBaselineDone = true;
    box.innerHTML = _dissolving.size ? '' : `<div class="empty pt-30vh tac">
      <div class="fs-14px fw-600 c-text mb-6px">Hozircha xabarlar yo'q</div>
      <div class="fs-13px c-text2">Salom bering</div>
    </div>`;
    _dissolveRestore(box, _dsE);
    msgMenuAfterPaint();
    _observeMessagesForRead();
    return;
  }

  const prevCount = box.querySelectorAll('.chat-msg').length;
  // Foydalanuvchi pastda (eng oxirgi xabarlarda) turganini tekshiramiz
  // threshold: pastdan 120px uzoqda bo'lsa "pastda" hisoblanadi
  const isAtBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const isInitialLoad = prevCount === 0;
  const _baseline = !_seenBaselineDone;   // shu chatning birinchi chizilishi — animatsiyasiz
  _seenBaselineDone = true;

  const _dsStarted = _dissolvePrepare(box, new Set(msgs.map(m => String(m.id))), !_baseline);
  box.innerHTML = msgs.map((m, idx) => {
    const mine = m.senderId === state.me?.uid;
    const time = fmtTime(m.createdAt);
    let bubbleContent = '';
    let emoCls = '';
    let bubbleClassExtra = '';
    let metaOutside = true;

    if (m.type === 'voice') {
      /* ── Voice message ── */
      const voiceMedia = { url: m.mediaUrl || '', duration: m.duration || 0 };
      const dur = voiceMedia.duration ? fmtVoiceDur(voiceMedia.duration) : '0:00';
      const barCount = _voiceBarCount(voiceMedia.duration);
      // URL ni esc() orqali o'tkazmaymiz — & belgisi buziladi!
      // data-* attributga to'g'ridan-to'g'ri qo'yamiz
      const safeUrl = (voiceMedia.url || '').replace(/"/g, '&quot;');
      const _mpName = (mine ? 'Siz' : (grp ? (grp.names?.[m.senderId]?.fullName || 'Ovozli xabar') : ($('chatThreadName')?.textContent || 'Ovozli xabar'))).replace(/"/g, '&quot;');
      bubbleContent = `<div class="chat-voice-msg" data-url="${safeUrl}" data-dur="${voiceMedia.duration||0}" data-bar-count="${barCount}" data-chat-id="${state.currentChatId||''}" data-chat-uid="${state.currentChatUid||''}" data-name="${_mpName}">
        <button class="cvm-play" onclick="window._chatPlayVoice(this)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <div class="cvm-waveform">${renderVoiceWave(idx, barCount)}</div>
        <span class="cvm-dur">${dur}</span>
      </div>`;
    } else if (m.type === 'file') {
      /* ── File message ── */
      const fname = esc(m.fileName || 'file');
      const fsz = m.fileSize ? fmtSz(m.fileSize) : '';
      const safeUrl = (m.mediaUrl || '').replace(/"/g, '&quot;');
      const _ext = (m.fileName || '').toLowerCase().split('.').pop() || '';
      const _mime = (m.mediaType || '').toLowerCase();
      const _isImage = _mime.startsWith('image') || ['jpg','jpeg','png','gif','webp','svg','avif'].includes(_ext);
      const _isVideo = _mime.startsWith('video') || ['mp4','mov','avi','mkv','webm'].includes(_ext);
      const hasCaption = !!(m.text && m.text.trim());
      const captionHtml = hasCaption ? `<div class="chat-bubble-text cfm-caption">${renderMarkdown(m.text)}</div>` : '';

      if (_isImage) {
        /* ── Image preview inline ── */
        if (!hasCaption) {
          bubbleClassExtra = ' bubble-media-only';
          metaOutside = false;
          bubbleContent = `<div class="cfm-media-wrap cfm-media-wrap--standalone">
            <a href="${safeUrl}" target="_blank" rel="noopener" class="cfm-img-link">
              <img class="cfm-img-preview" src="${safeUrl}" alt="${fname}" loading="lazy" onload="this.classList.add('loaded')">
            </a>
            <span class="chat-msg-meta cfm-media-badge">
              ${m.editedAt ? '<span class="chat-msg-edited">tahrirlangan</span>' : ''}<span class="chat-msg-time">${time}</span>
              ${mine ? renderTicks(m.status) : ''}
            </span>
          </div>`;
        } else {
          bubbleClassExtra = ' bubble-media-caption';
          bubbleContent = `<div class="cfm-media-wrap">
            <a href="${safeUrl}" target="_blank" rel="noopener" class="cfm-img-link">
              <img class="cfm-img-preview" src="${safeUrl}" alt="${fname}" loading="lazy" onload="this.classList.add('loaded')">
            </a>
            ${captionHtml}
          </div>`;
        }
      } else if (_isVideo) {
        /* ── Video preview inline ── */
        if (!hasCaption) {
          bubbleClassExtra = ' bubble-media-only';
          metaOutside = false;
          bubbleContent = `<div class="cfm-media-wrap cfm-media-wrap--standalone cfm-media-wrap--video">
            <video class="cfm-video-preview" src="${safeUrl}" controls playsinline preload="metadata">
              <a href="${safeUrl}" target="_blank" rel="noopener">${fname}</a>
            </video>
            <span class="chat-msg-meta cfm-media-badge cfm-media-badge--video">
              ${m.editedAt ? '<span class="chat-msg-edited">tahrirlangan</span>' : ''}<span class="chat-msg-time">${time}</span>
              ${mine ? renderTicks(m.status) : ''}
            </span>
          </div>`;
        } else {
          bubbleClassExtra = ' bubble-media-caption';
          bubbleContent = `<div class="cfm-media-wrap cfm-media-wrap--video">
            <video class="cfm-video-preview" src="${safeUrl}" controls playsinline preload="metadata">
              <a href="${safeUrl}" target="_blank" rel="noopener">${fname}</a>
            </video>
            ${captionHtml}
          </div>`;
        }
      } else {
        /* ── Other files — name is clickable link ── */
        bubbleContent = `<div class="cfm-file-wrap">
          <div class="chat-file-msg">
            <div class="cfm-icon">${getChatFileIcon(m.fileName, m.mediaType)}</div>
            <div class="cfm-info">
              <a class="cfm-name cfm-name--link" href="${safeUrl}" target="_blank" rel="noopener" title="Ochish">${fname}</a>
              ${fsz ? `<div class="cfm-size">${fsz}</div>` : ''}
            </div>
            <a class="cfm-dl" href="${safeUrl}" download="${fname}" target="_blank" title="Yuklab olish">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
            </a>
          </div>
          ${captionHtml}
        </div>`;
      }
    } else {
      /* ── Text message ── */
      const postShare = parsePostShare(m.text);
      if (postShare) {
        bubbleClassExtra = ' bubble-post-card';
        bubbleContent = renderChatPostCard(postShare);
      } else {
        bubbleContent = `<div class="chat-bubble-text">${renderMarkdown(m.text || '')}</div>`;
        emoCls = emojiOnlyClass(m.text);
      }
    }

    // ID asosida "yangi"lik: shu xabar ID'si ilgari chizilmagan bo'lsagina
    // bounce animatsiyasi beriladi (status/audioUrl kabi maydon
    // yangilanishlari eski xabarlarni qayta "bounce" qilib yubormaydi).
    let isNew = false, animStyle = '';
    if (m.id) {
      const _nowT = Date.now();
      if (!_seenMsgIds.has(m.id)) {
        _seenMsgIds.add(m.id);
        // yangi xabar (kelgan ham, o'zimniki ham; id bir xil bo'lgani uchun optimistik->server almashinuvda qayta o'ynamaydi)
        if (!_baseline && _isFreshMsg(m)) { _msgAnimStart.set(m.id, _nowT); isNew = true; }
      } else {
        // animatsiya payti repaint bo'lsa (status/tick) — to'xtab qolmasin, qolgan joyidan davom etsin
        const _t0 = _msgAnimStart.get(m.id);
        if (_t0 && _nowT - _t0 < MSG_ANIM_MS) { isNew = true; animStyle = ` style="animation-delay:-${_nowT - _t0}ms"`; }
      }
    }

    // Guruh: faqat boshqa foydalanuvchi xabarlarida yuboruvchi ismi
    let gHead = '';
    if (grp && !mine) {
      const sn = grp.names?.[m.senderId]?.fullName || 'Foydalanuvchi';
      gHead = `<div class="grp-sender-name" data-uid="${esc(m.senderId)}">${esc(sn)}</div>`;
    }

    // Kun almashgan bo'lsa — Telegram uslubidagi "Bugun"/"Kecha"/sana pill'i
    let dateSep = '';
    const prevMsg = msgs[idx - 1];
    const curDate  = _toDateSafe(m.createdAt);
    const prevDate = prevMsg ? _toDateSafe(prevMsg.createdAt) : null;
    if (curDate && (!prevDate || !_isSameDay(curDate, prevDate))) {
      dateSep = `<div class="chat-date-sep"><span>${_dateSepLabel(m.createdAt)}</span></div>`;
    }

    const outerMeta = metaOutside ? `<span class="chat-msg-meta">
      ${m.editedAt ? '<span class="chat-msg-edited">tahrirlangan</span>' : ''}<span class="chat-msg-time">${time}</span>
      ${mine ? renderTicks(m.status) : ''}
    </span>` : '';

    return `${dateSep}<div class="chat-msg ${mine ? 'mine' : 'theirs'}${isNew ? ' anim-in' : ''}${emoCls}" data-msg-id="${m.id || ''}"${animStyle}>

      <div class="chat-bubble${bubbleClassExtra}">
        <div class="chat-bubble-wrap">
          ${gHead}${bubbleContent}
          ${outerMeta}
        </div>
      </div>
    </div>`;
  }).join('');

  _dissolveRestore(box, _dsStarted);

  // Faqat pastda turgan bo'lsak yoki chat yangi ochilgan bo'lsa scroll qilamiz
  if (isAtBottom || isInitialLoad) {
    setTimeout(() => { box.scrollTop = box.scrollHeight; }, 60);
  }

  // "theirs" xabarlaridagi avatar bosilganda profil ochamiz
  box.querySelectorAll('.grp-sender-name[data-uid]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', async () => {
      const { openUserProfileModal } = await import('./profile.js');
      openUserProfileModal(el.dataset.uid);
    });
  });
  box.querySelectorAll('.msg-avi-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.dataset.uid;
      if (!uid || uid === state.me?.uid) return;
      const { openUserProfileModal } = await import('./profile.js');
      openUserProfileModal(uid);
    });
  });

  // Voice xabarlar uchun — haqiqiy waveform balandliklarini fonda yuklaymiz
  _hydrateVoiceWaveforms(box);

  // BUG FIX: paintMessages() har qanday Firestore yozuvida (masalan
  // _attachSecondaryVoice orqali fon rejimida ikkinchi jins ovozi
  // qo'shilganda) butun DOM'ni qayta chizadi. Agar shu paytda audio
  // fonda ijro etilayotgan bo'lsa (_activeAudio), eski <button> DOM
  // elementi yo'q qilinadi va _activeBtn "orfan" obyektga aylanadi —
  // natijada yangi tugma har doim "Play" holatida chiqadi, garchi
  // audio haqiqatan hali ham ijro etilayotgan bo'lsa ham. Shu yerda
  // faol ijro holatini yangi chizilgan DOM ichidan data-url bo'yicha
  // qidirib topilgan tugma/waveform'ga qayta bog'laymiz.
  _reattachActiveVoiceUI(box);
  msgMenuAfterPaint();
  // Faqat viewportdagi (ko'rinadigan) xabarlar o'qilgan bo'ladi
  _observeMessagesForRead();
  checkSharedPostExistence(msgs);
}

/** Guruh thread'i shu yagona painter bilan chiziladi (DM bilan bir xil UI/mantiq) */
export function paintGroupThread(msgs, names) { paintMessages(msgs, { names: names || {} }); }
/** Guruh almashganda "yangi xabar" animatsiyasi hisobini boshidan boshlash */
export function resetSeenMsgs(key) {
  if (_seenMsgIdsChatId !== key) { _seenMsgIds = new Set(); _seenMsgIdsChatId = key; _seenBaselineDone = false; _msgAnimStart.clear(); _dissolving.clear(); dissolveMarks.clear(); }
}

/**
 * Agar hozir biror ovozli xabar ijro etilayotgan/pauza holatida bo'lsa
 * (_activeAudio hali mavjud), paintMessages() repaint qilganidan keyin
 * uning UI holatini (tugma ikonkasi, waveform progress, davomiylik) yangi
 * DOM elementlariga qayta bog'laydi. _activeBtn eski (endi DOM'dan
 * o'chirilgan) tugmaga ishora qilib qolmasligi uchun uni ham yangilaymiz.
 */
function _reattachActiveVoiceUI(box) {
  if (!_activeAudio || !_activeBtn) return;

  // Eski tugma hali DOM ichida turibdimi (masalan repaint umuman shu
  // xabarga tegmagan bo'lsa) — bo'lsa hech narsa qilish shart emas.
  if (box.contains(_activeBtn)) return;

  const url = _activeBtn?.closest?.('.chat-voice-msg')?.dataset?.url
    || (_activeAudio.src || '');
  if (!url) return;

  // Xuddi shu audio URL'iga mos yangi chizilgan wrapper'ni topamiz.
  const newWrap = Array.from(box.querySelectorAll('.chat-voice-msg'))
    .find(w => w.dataset.url === url || (w.dataset.url && _activeAudio.src && _activeAudio.src.endsWith(w.dataset.url)));
  if (!newWrap) return;

  const newBtn = newWrap.querySelector('.cvm-play');
  if (!newBtn) return;

  // Holatni (play/pause ikonka) qayta tiklaymiz
  newBtn.innerHTML = _activeAudio.paused ? PLAY_ICON : PAUSE_ICON;

  const bars   = newWrap.querySelectorAll('.cvm-bar');
  const durEl  = newWrap.querySelector('.cvm-dur');
  const waveEl = newWrap.querySelector('.cvm-waveform');
  const total  = parseFloat(newWrap.dataset.dur || '0') || _activeAudio.duration || 0;

  if (!_activeAudio.paused && waveEl) waveEl.classList.add('playing');

  // Progressni joriy audio.currentTime asosida darhol tiklaymiz
  const duration = _activeAudio.duration || total || 1;
  const pct = duration ? (_activeAudio.currentTime / duration) : 0;
  const filled = Math.floor(pct * bars.length);
  bars.forEach((b, i) => b.classList.toggle('played', i < filled));
  if (durEl) durEl.textContent = fmtVoiceDur(_activeAudio.currentTime);

  // Audio event handlerlarini yangi elementlarga qayta ulaymiz, aks holda
  // ular hamon eski (DOM'dan o'chirilgan) tugmani yangilashda davom etadi.
  _activeAudio.onwaiting = () => {
    newBtn.innerHTML = LOADING_ICON;
    newBtn.classList.add('cvm-play--loading');
  };
  _activeAudio.onplaying = () => {
    newBtn.innerHTML = PAUSE_ICON;
    newBtn.classList.remove('cvm-play--loading');
    _syncMiniPlayer();
  };
  _activeAudio.ontimeupdate = () => {
    const dur2 = _activeAudio.duration || total || 1;
    const pct2 = _activeAudio.currentTime / dur2;
    const filled2 = Math.floor(pct2 * bars.length);
    bars.forEach((b, i) => b.classList.toggle('played', i < filled2));
    if (durEl) durEl.textContent = fmtVoiceDur(_activeAudio.currentTime);
    _updateMiniPlayerProgress(pct2);
  };
  _activeAudio.onended = () => {
    if (waveEl) waveEl.classList.remove('playing');
    newBtn.innerHTML = PLAY_ICON;
    bars.forEach(b => b.classList.remove('played'));
    if (durEl) durEl.textContent = fmtVoiceDur(total);
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  };
  const _thisAudio = _activeAudio;
  _activeAudio.onerror = (e) => {
    if (_activeAudio !== _thisAudio) return;
    console.error('Audio xatosi (repaint keyin):', e, 'URL:', url);
    toast('Audio yuklanmadi', 'error');
    newBtn.innerHTML = PLAY_ICON;
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  };

  _activeBtn = newBtn;
}

/* ── Yopish chat thread ───────────────────────────────────────────────── */
export function closeChatThread() {
  if (_isHoldingVoice) {
    _isHoldingVoice = false;
    cancelRecording();
    _hideRecordBar();
  }
  _teardownReadObserver();
  _locallyReadIds.clear();
  document.getElementById('chatHeaderDropdown')?.remove();
  document.getElementById('groupJoinBar')?.remove();
  document.dispatchEvent(new Event('chatmedia:close'));
  if (_rt) { _rt.close(); _rt = null; }
  _rtLocal.clear(); _rtRead.clear(); _rtChatId = null;
  msgMenuReset();
  if (_threadUnsub) { _threadUnsub(); _threadUnsub = null; }
  if (_peerUserUnsub) { _peerUserUnsub(); _peerUserUnsub = null; }
  if (_peerStatusTick) { clearInterval(_peerStatusTick); _peerStatusTick = null; }
  clearTimeout(_typingTimeout);
  _setTyping(false);
  if (_chatDocUnsub) { _chatDocUnsub(); _chatDocUnsub = null; }
  _iAmTyping = false;
  _peerTyping = false;
  // If in group/channel mode, cleanup group state too
  if (state.currentChatKind && state.currentChatKind !== 'dm') {
    closeGroupThread();
  }
  state.currentChatUid = null;
  state.currentChatId  = null;
  const modal = $('chatThreadModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.bottom = '0px';
  }
  // Chat ro'yxatini yangilash — oxirgi xabar/preview yangi bo'lishi uchun
  if (state.view === 'chats') renderChatsList();
  // Ovoz hali ijro etilayotgan bo'lsa — endi bu chat yopilgani uchun
  // mini-pleer bar ko'rinishi kerak (ovozning o'zi to'xtamaydi).
  try { _syncMiniPlayer(); } catch (_) {}
}

/* ── Send message ────────────────────────────────────────────────────── */
export async function sendChatMessage() {
  // Route to group/channel send if in that mode
  if (state.currentChatKind && state.currentChatKind !== 'dm') {
    return sendGroupMessage();
  }
  if (isEditing()) { await commitEdit($('chatThreadInput')?.value); return; }
  const inp  = $('chatThreadInput');
  const userText = (inp?.value || '').trim();
  const postShare = _pendingPostShare;

  if ((!userText && !postShare) || !state.currentChatId || !state.me) return;
  if (!rateOk('msg', 8, 10000)) return;

  const chatId   = state.currentChatId;
  const otherUid = state.currentChatUid;

  inp.value = '';
  if (postShare) {
    clearPendingPostShare();
  } else {
    updateVoiceSendBtn();
  }
  clearTimeout(_typingTimeout);
  _setTyping(false);

  const finalMsgText = postShare
    ? JSON.stringify({ __postShare: true, post: postShare, comment: userText })
    : userText;

  const previewText = postShare
    ? (userText ? `📌 ${userText}` : `📌 Post: ${postShare.authorName || 'Post'}`)
    : userText.slice(0, 120);

  // 1) Optimistik: o'z xabarimiz shu zahoti ekranda (DB javobini kutmaymiz)
  const id = _uuid();
  const nowMs = Date.now();
  const localMsg = {
    id, chatId, senderId: state.me.uid, type: 'text', text: finalMsgText,
    mediaPath: null, mediaUrl: '', mediaType: null, fileName: null, fileSize: null, duration: null,
    status: 'sending', readAt: null, editedAt: null, createdAt: nowMs, _at: nowMs,
  };
  _rtLocal.set(id, localMsg);
  paintMessages([..._curMsgs, localMsg]);
  // 2) Peer'ga to'g'ridan-to'g'ri (WebRTC DataChannel; ulanmagan bo'lsa broadcast)
  if (_rt && _rtChatId === chatId) _rt.send(id, finalMsgText);
  // 2b) Peer'ning suhbatlar ro'yxati/unread — suhbat ochiq bo'lmasa ham shu zahoti
  inboxSend(otherUid, { chatId, from: state.me.uid, id, text: previewText.slice(0, 120), ts: nowMs });

  // Chat ro'yxatida suhbat darhol saqlansin
  if (!_latestChatMap[otherUid]) {
    _latestChatMap[otherUid] = {
      id: chatId, participants: [state.me.uid, otherUid], createdAt: nowMs,
      lastMessage: previewText.slice(0, 120), lastSenderId: state.me.uid, lastMessageAt: nowMs, unreadCount: {}
    };
  } else {
    _latestChatMap[otherUid].lastMessage = previewText.slice(0, 120);
    _latestChatMap[otherUid].lastMessageAt = nowMs;
    _latestChatMap[otherUid].lastSenderId = state.me.uid;
  }

  try {
    // 3) Baza (haqiqat manbai) — xuddi shu ID bilan, dedup uchun
    const { error } = await sb.from('messages')
      .insert({ id, chat_id: chatId, sender_id: state.me.uid, type: 'text', text: finalMsgText });
    if (error) throw error;
    // DB tasdiqladi — clock → 1 chek
    const conf = _rtLocal.get(id);
    if (conf) { conf.status = 'sent'; _rtLocal.set(id, conf); }
    if (state.currentChatId === chatId) {
      paintMessages(_curMsgs.map(m => m.id === id ? { ...m, status: 'sent' } : m));
    }
    _reloadThread && _reloadThread();
    // Push bildirishnoma push.js bosqichida ulanadi (Edge Function / DB webhook)
  } catch (err) {
    console.error('sendChatMessage failed:', err.message);
    toast('Xabar yuborilmadi', 'error');
    _rtLocal.delete(id);
    if (_rt && _rtChatId === chatId) _rt.retract(id);
    if (state.currentChatId === chatId) paintMessages(_curMsgs.filter(x => x.id !== id));
    inp.value = userText; // qaytarib qo'yamiz, user qayta yuborishi uchun
    if (postShare) setPendingPostShare(postShare);
    updateVoiceSendBtn();
  }
}

/* ── Helpers for new features ───────────────────────────────────────── */
function fmtVoiceDur(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

function getChatFileIcon(name = '', mime = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const m   = (mime || '').toLowerCase();

  if (m.startsWith('image') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(34,197,94,0.12)"/><rect x="8" y="12" width="32" height="24" rx="4" stroke="#22c55e" stroke-width="2"/><circle cx="17" cy="20" r="3" stroke="#22c55e" stroke-width="1.8"/><path d="M8 30l8-7 7 6 5-4 12 9" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  if (m.startsWith('audio') || ['mp3','wav','ogg','aac','opus','m4a'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(255, 255, 255,0.12)"/><path d="M18 34V18l16-4v16" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="34" r="3" fill="#ffffff"/><circle cx="31" cy="30" r="3" fill="#ffffff"/></svg>`;

  if (m.startsWith('video') || ['mp4','mov','avi','mkv','webm'].includes(ext))
    return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(239,68,68,0.12)"/><rect x="6" y="12" width="28" height="24" rx="4" stroke="#ef4444" stroke-width="2"/><path d="M34 18l8-4v20l-8-4V18z" stroke="#ef4444" stroke-width="2" stroke-linejoin="round"/><polygon points="18 19 18 29 26 24" fill="#ef4444"/></svg>`;

  if (ext === 'pdf' || m === 'application/pdf')
    return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(239,68,68,0.12)"/><path d="M13 8h16l8 8v24a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" stroke="#ef4444" stroke-width="2"/><path d="M29 8v8h8" stroke="#ef4444" stroke-width="2"/><text x="24" y="34" text-anchor="middle" font-family="monospace" font-weight="700" font-size="9" fill="#ef4444">PDF</text></svg>`;

  return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="10" fill="rgba(118, 118, 118,0.12)"/><path d="M13 8h16l8 8v24a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z" stroke="#a6a6a6" stroke-width="2"/><path d="M29 8v8h8" stroke="#a6a6a6" stroke-width="2"/><line x1="16" y1="24" x2="32" y2="24" stroke="#a6a6a6" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="30" x2="26" y2="30" stroke="#a6a6a6" stroke-width="2" stroke-linecap="round"/></svg>`;
}

/* ── Voice player (global handler for onclick in innerHTML) ─────────── */
let _activeAudio   = null;
let _activeBtn     = null;
let _activeChatId  = null;
let _activeChatUid = null;
let _activeName    = '';

window._chatPlayVoice = function(btn) {
  const wrap = btn.closest('.chat-voice-msg');
  const url  = wrap?.dataset?.url;

  if (!url) {
    console.warn('Voice: URL topilmadi', wrap?.dataset);
    toast('Audio URL topilmadi', 'error');
    return;
  }

  // Bir xil xabar — pause/resume
  if (_activeAudio && _activeBtn === btn) {
    if (_activeAudio.paused) {
      _activeAudio.play().catch(e => { console.error('Resume xatosi:', e); toast('Ijro etilmadi', 'error'); });
      btn.innerHTML = PAUSE_ICON;
    } else {
      _activeAudio.pause();
      btn.innerHTML = PLAY_ICON;
    }
    _syncMiniPlayer();
    return;
  }

  // Boshqa xabar o'ynayotgan bo'lsa — to'xtat
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.onended = null;
    _activeAudio.ontimeupdate = null;
    if (_activeBtn) _activeBtn.innerHTML = PLAY_ICON;
    // Oldingi xabar barlarini reset
    const oldWrap = _activeBtn?.closest('.chat-voice-msg');
    oldWrap?.querySelectorAll('.cvm-bar').forEach(b => b.classList.remove('played'));
  }

  _activeBtn    = btn;
  _activeChatId  = wrap.dataset.chatId || state.currentChatId || null;
  _activeChatUid = wrap.dataset.chatUid || state.currentChatUid || null;
  _activeName   = wrap.dataset.name || 'Ovozli xabar';
  const audio = new Audio(url);
  audio.preload = 'auto';
  _activeAudio = audio;

  const bars      = wrap.querySelectorAll('.cvm-bar');
  const durEl     = wrap.querySelector('.cvm-dur');
  const waveEl    = wrap.querySelector('.cvm-waveform');
  const total     = parseFloat(wrap.dataset.dur || '0') || 0;

  // Fayl hali (masalan sekin tarmoqda) yuklanayotgan bo'lsa — tugmani
  // darhol pauza belgisiga o'tkazmasdan, kichik spinner ko'rsatamiz. Aks
  // holda foydalanuvchi uchun "bosdim-yu hech narsa bo'lmadi, qotib qoldi"
  // taassuroti qoladi, garchi audio aslida orqa fonda yuklanayotgan bo'lsa
  // ham. `waiting` — buferlash paytida, `playing` — ijro haqiqatan
  // boshlanganda chaqiriladi (brauzer standart Audio eventlari).
  btn.innerHTML = LOADING_ICON;
  btn.classList.add('cvm-play--loading');

  audio.onwaiting = () => {
    btn.innerHTML = LOADING_ICON;
    btn.classList.add('cvm-play--loading');
  };
  audio.onplaying = () => {
    btn.innerHTML = PAUSE_ICON;
    btn.classList.remove('cvm-play--loading');
    _syncMiniPlayer();
  };

  if (waveEl) waveEl.classList.add('playing');

  audio.ontimeupdate = () => {
    const duration = audio.duration || total || 1;
    const pct = audio.currentTime / duration;
    const filled = Math.floor(pct * bars.length);
    bars.forEach((b, i) => b.classList.toggle('played', i < filled));
    if (durEl) durEl.textContent = fmtVoiceDur(audio.currentTime);
    _updateMiniPlayerProgress(pct);
  };

  audio.onended = () => {
    if (waveEl) waveEl.classList.remove('playing');
    btn.innerHTML = PLAY_ICON;
    bars.forEach(b => b.classList.remove('played'));
    if (durEl) durEl.textContent = fmtVoiceDur(total);
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  };

  audio.onerror = (e) => {
    // Agar bu audio allaqachon boshqasi bilan almashtirilgan bo'lsa (masalan
    // foydalanuvchi tez orada boshqa xabarni bosgan) — bu "eski" audio
    // xatosi endi hech narsaga ta'sir qilmasligi kerak.
    if (_activeAudio !== audio) return;
    console.error('Audio xatosi:', e, 'URL:', url);
    toast('Audio yuklanmadi', 'error');
    btn.innerHTML = PLAY_ICON;
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  };

  audio.play().catch(e => {
    // AbortError — play() so'rovi darhol keyingi pause()/boshqa xabar
    // bosilishi bilan bekor qilinganda tashlanadi. Bu KUTILGAN holat
    // (foydalanuvchi tez-tez xabarlar orasida almashganda) — xato emas,
    // shuning uchun toast ko'rsatmaymiz.
    if (e?.name === 'AbortError') return;
    if (_activeAudio !== audio) return;
    console.error('Audio play xatosi:', e, 'URL:', url);
    toast('Audio ijro etilmadi', 'error');
    btn.innerHTML = PLAY_ICON;
    _activeAudio = null;
    _activeBtn   = null;
    _syncMiniPlayer();
  });

  _syncMiniPlayer();
};

/* ── Voice mini-player — foydalanuvchi shu xabarning chatidan chiqib
 * ketsa (boshqa chatga o'tsa yoki thread'ni yopsa) ham, ovoz ijrosi
 * davom etadi (browser Audio elementi DOM'ga bog'liq emas — allaqachon
 * shunday ishlaydi). Bu funksiya faqat KO'RINADIGAN bar'ni — hozir
 * qaysi chat ochiqligiga qarab — ko'rsatish/yashirishni boshqaradi.
 * Telegram/WhatsApp'dagi "ovoz almashtirilgan chatda ham davom etadi"
 * funksiyasiga mos. */
function _isVoiceOwnerChatOpen() {
  const threadOpen = $('chatThreadModal')?.classList.contains('show');
  return !!(threadOpen && state.currentChatId && state.currentChatId === _activeChatId);
}

function _syncMiniPlayer() {
  const bar = $('voiceMiniPlayer');
  if (!bar) return;
  const shouldShow = !!_activeAudio && !_isVoiceOwnerChatOpen();
  if (!shouldShow) { bar.classList.remove('show'); return; }

  bar.classList.add('show');
  const titleEl = $('vmpTitle');
  if (titleEl) titleEl.textContent = _activeName || 'Ovozli xabar';
  const playBtn = $('vmpPlay');
  if (playBtn) playBtn.innerHTML = (_activeAudio && !_activeAudio.paused) ? PAUSE_ICON : PLAY_ICON;
}

function _updateMiniPlayerProgress(pct) {
  const fill = $('vmpFill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
}

$('vmpPlay')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!_activeAudio) return;
  if (_activeAudio.paused) _activeAudio.play().catch(() => {});
  else _activeAudio.pause();
  if (_activeBtn) _activeBtn.innerHTML = _activeAudio.paused ? PLAY_ICON : PAUSE_ICON;
  _syncMiniPlayer();
});

$('vmpClose')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (_activeAudio) {
    _activeAudio.pause();
    _activeAudio.onended = null;
    _activeAudio.ontimeupdate = null;
    _activeAudio = null;
  }
  if (_activeBtn) { _activeBtn.innerHTML = PLAY_ICON; _activeBtn = null; }
  _activeChatId  = null;
  _activeChatUid = null;
  _syncMiniPlayer();
});

// Bar bosilganda — ovoz chiqayotgan chatga qaytamiz
$('voiceMiniPlayer')?.addEventListener('click', () => {
  if (_activeChatUid) openChatThread(_activeChatUid);
});

const PLAY_ICON  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const PAUSE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
// Fayl hali yuklanayotganda (buferlanmoqda) ko'rsatiladigan aylanuvchi spinner —
// CSS animatsiyasi uchun .cvm-play--loading klassi (CSS/chat.css) bilan birga ishlaydi.
const LOADING_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="cvm-spin"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="42 14"/></svg>`;

/* ── Voice recording (Telegram-style push-to-talk & live 3-ring pulse) ────
 * Mikrofonga BOSIB TURIB gapiriladi (hold to record).
 * Qo'yib yuborilganda — ovoz darhol ketadi.
 * Chapga surilsa — bekor qilinadi.
 * Gapirilayotganda tugma atrofida Telegram'dagi kabi 3 qavatli jonli to'lqin
 * halqalari (#cvPulse1, #cvPulse2, #cvPulse3) ovoz balandligiga mos ravishda kengayadi. */
let _isHoldingVoice    = false;
let _voiceCancelled    = false;
let _voiceStartX       = 0;
let _voiceStartY       = 0;
let _voiceStartTime    = 0;
let _voiceJustHandled  = false;
let _activePointerId   = null;
let _recTimerInterval  = null;
let _recStartTs        = 0;
let _mediaRec          = null;
let _recChunks         = [];
let _mediaStream       = null;
let _pulseCtx          = null;
let _pulseAnalyser     = null;
let _pulseRaf          = null;
let _pulseLevel        = 0;
let _voiceStopRequested = false;

function _showRecordBar() {
  const bar = $('chatRecordBar');
  const timer = $('chatRecordTimer');
  const cancelText = $('crbCancelText');
  if (!bar) return;
  bar.classList.add('active');
  bar.classList.remove('cancelling');
  if (cancelText) cancelText.textContent = 'Bekor qilish uchun suring';
  if (timer) timer.textContent = '0:00';
  _voiceStartTime = Date.now();
  if (_recTimerInterval) clearInterval(_recTimerInterval);
  _recTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _voiceStartTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    if (timer) timer.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
  }, 250);
}

function _hideRecordBar() {
  const bar = $('chatRecordBar');
  if (bar) bar.classList.remove('active', 'cancelling');
  if (_recTimerInterval) { clearInterval(_recTimerInterval); _recTimerInterval = null; }
  const wrap = $('chatVoiceWrap');
  if (wrap) wrap.classList.remove('cancelling');
  _clearVoiceCancelVisuals();
}

function _setRecordBarCancelState(isCancelling) {
  const bar = $('chatRecordBar');
  const cancelText = $('crbCancelText');
  const wrap = $('chatVoiceWrap');
  if (bar) bar.classList.toggle('cancelling', isCancelling);
  if (wrap) wrap.classList.toggle('cancelling', isCancelling);
  if (cancelText) {
    cancelText.textContent = isCancelling ? 'Qo\'yib yuboring — bekor qilish' : 'Bekor qilish uchun suring';
  }
}

/* Chapga surish progressi (0..1) — rang/pulse silliq o'zgaradi */
const _VOICE_CANCEL_DIST = 72; // px — to'liq bekor qilish masofasi
function _lerp(a, b, t) { return a + (b - a) * t; }
function _rgbMix(r1, g1, b1, r2, g2, b2, t) {
  return `rgb(${Math.round(_lerp(r1,r2,t))},${Math.round(_lerp(g1,g2,t))},${Math.round(_lerp(b1,b2,t))})`;
}
function _applyVoiceCancelProgress(p) {
  // p: 0 = normal (ko'k), 1 = to'liq cancel (qizil)
  p = Math.max(0, Math.min(1, p));
  const vBtn = $('chatVoiceBtn');
  const wrap = $('chatVoiceWrap');
  const cancelEl = $('chatRecordCancel');
  const cancelText = $('crbCancelText');

  // Ko'k #2AABEE / #229ED9  →  Qizil #ef4444 / #dc2626
  const c1 = _rgbMix(42, 171, 238, 239, 68, 68, p);
  const c2 = _rgbMix(34, 158, 217, 220, 38, 38, p);
  const shadowA = _lerp(0.55, 0.55, p);
  const shadowRgb = p < 0.5
    ? `rgba(42, 171, 238, ${0.55 + p * 0.1})`
    : `rgba(239, 68, 68, ${0.45 + p * 0.15})`;

  if (vBtn) {
    vBtn.style.setProperty('--voice-rec-bg', `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`);
    vBtn.style.setProperty('--voice-rec-shadow', `0 4px 20px ${shadowRgb}, 0 0 0 2px rgba(255, 255, 255, 0.2)`);
  }

  // Pulse rings — ko'kdan qizilga silliq
  const pr = Math.round(_lerp(42, 239, p));
  const pg = Math.round(_lerp(171, 68, p));
  const pb = Math.round(_lerp(238, 68, p));
  const r1 = $('cvPulse1'), r2 = $('cvPulse2'), r3 = $('cvPulse3');
  if (r1) r1.style.background = `radial-gradient(circle, rgba(${pr},${pg},${pb},0.65) 0%, rgba(${pr},${pg},${pb},0.35) 65%, rgba(${pr},${pg},${pb},0) 100%)`;
  if (r2) r2.style.background = `radial-gradient(circle, rgba(${pr},${pg},${pb},0.45) 0%, rgba(${pr},${pg},${pb},0.2) 70%, rgba(${pr},${pg},${pb},0) 100%)`;
  if (r3) r3.style.background = `radial-gradient(circle, rgba(${pr},${pg},${pb},0.3) 0%, rgba(${pr},${pg},${pb},0.1) 75%, rgba(${pr},${pg},${pb},0) 100%)`;

  // Cancel matn rangi/opacity
  if (cancelEl) {
    const tr = Math.round(_lerp(150, 239, p)); // text3-ish → red
    const tg = Math.round(_lerp(150, 68, p));
    const tb = Math.round(_lerp(155, 68, p));
    cancelEl.style.color = `rgb(${tr},${tg},${tb})`;
    cancelEl.style.opacity = String(0.55 + p * 0.45);
    cancelEl.style.fontWeight = p > 0.85 ? '600' : '400';
  }
  if (cancelText && p > 0.92) {
    cancelText.textContent = "Qo'yib yuboring — bekor qilish";
  } else if (cancelText && p < 0.5) {
    cancelText.textContent = 'Bekor qilish uchun suring';
  }

  // Binary class faqat to'liq cancel zonasida (release qarori uchun)
  const full = p >= 0.92;
  if (wrap) wrap.classList.toggle('cancelling', full);
  const bar = $('chatRecordBar');
  if (bar) bar.classList.toggle('cancelling', full);
  return full;
}

function _clearVoiceCancelVisuals() {
  const vBtn = $('chatVoiceBtn');
  if (vBtn) {
    vBtn.style.removeProperty('--voice-rec-bg');
    vBtn.style.removeProperty('--voice-rec-shadow');
    vBtn.style.background = '';
    vBtn.style.boxShadow = '';
  }
  ['cvPulse1', 'cvPulse2', 'cvPulse3'].forEach(id => {
    const el = $(id);
    if (el) el.style.background = '';
  });
  const cancelEl = $('chatRecordCancel');
  if (cancelEl) {
    cancelEl.style.color = '';
    cancelEl.style.opacity = '';
    cancelEl.style.fontWeight = '';
  }
}

/* ── Mikrofon ruxsati: har safar so'raymiz, custom card + browser popup ── */
function _ensureMicPermUi() {
  let ov = document.getElementById('micPermOverlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'micPermOverlay';
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="sheet mic-perm-sheet" role="dialog" aria-labelledby="micPermTitle">
      <div class="sheet-title" id="micPermTitle">Mikrofon ruxsati</div>
      <div class="mic-perm-body">
        <div class="mic-perm-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <p id="micPermMsg" class="mic-perm-msg">Ovozli xabar yuborish uchun mikrofonga ruxsat bering.</p>
        <p id="micPermHint" class="mic-perm-hint" hidden></p>
      </div>
      <button type="button" class="btn-primary" id="micPermAllowBtn">Ruxsat berish</button>
      <button type="button" class="btn-ghost" id="micPermCancelBtn">Bekor qilish</button>
    </div>`;
  document.body.appendChild(ov);
  return ov;
}

function _showMicPermCard({ msg, hint, onAllow } = {}) {
  const ov = _ensureMicPermUi();
  const msgEl = ov.querySelector('#micPermMsg');
  const hintEl = ov.querySelector('#micPermHint');
  const allowBtn = ov.querySelector('#micPermAllowBtn');
  const cancelBtn = ov.querySelector('#micPermCancelBtn');
  if (msgEl) msgEl.textContent = msg || 'Ovozli xabar yuborish uchun mikrofonga ruxsat bering.';
  if (hintEl) {
    if (hint) { hintEl.hidden = false; hintEl.textContent = hint; }
    else { hintEl.hidden = true; hintEl.textContent = ''; }
  }
  const close = () => ov.classList.remove('show');
  // clone to drop old listeners
  const newAllow = allowBtn.cloneNode(true);
  allowBtn.parentNode.replaceChild(newAllow, allowBtn);
  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
  newAllow.onclick = async () => {
    newAllow.disabled = true;
    newAllow.textContent = "So’ralmoqda...";
    try {
      await onAllow?.();
      close();
    } catch (err) {
      console.error('[mic-perm]', err);
    } finally {
      newAllow.disabled = false;
      newAllow.textContent = 'Ruxsat berish';
    }
  };
  newCancel.onclick = close;
  ov.onclick = (e) => { if (e.target === ov) close(); };
  ov.classList.add('show');
}

async function _queryMicPermission() {
  try {
    if (!navigator.permissions?.query) return 'prompt';
    const st = await navigator.permissions.query({ name: 'microphone' });
    return st?.state || 'prompt'; // 'granted' | 'denied' | 'prompt'
  } catch (_) {
    return 'prompt';
  }
}

async function _requestMicStream() {
  // Har safar yangidan so'raymiz — denied cache qilmaymiz
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

function _micErrorKind(err) {
  const name = err?.name || '';
  const msg = (err?.message || '').toLowerCase();
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || msg.includes('not found') || msg.includes('no device'))
    return 'notfound';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError')
    return 'denied';
  if (name === 'NotReadableError' || name === 'TrackStartError' || msg.includes('in use') || msg.includes('busy'))
    return 'busy';
  return 'other';
}

function _abortVoiceUi() {
  $('chatVoiceBtn')?.classList.remove('recording', 'cancelling');
  _hideRecordBar();
  _stopPulse();
  _isHoldingVoice = false;
  _voiceCancelled = true;
}

async function startRecording() {
  _voiceStopRequested = false;
  _recChunks = [];
  _recStartTs = performance.now();

  // Ruxsat holatini tekshirish — denied bo'lsa darhol o'z cardimizni ko'rsatamiz
  const perm = await _queryMicPermission();
  if (perm === 'denied') {
    _abortVoiceUi();
    _showMicPermCard({
      msg: 'Brauzer mikrofonga ruxsatni bloklagan.',
      hint: "Brauzer sozlamalaridan (qulf ikonka → Mikrofon) ruxsatni yoqing, keyin «Ruxsat berish»ni bosing. Keyingi safar ham qayta so’raladi.",
      onAllow: async () => {
        try {
          const s = await _requestMicStream();
          s.getTracks().forEach(t => t.stop());
          toast('Mikrofon ruxsati berildi — endi bosib turing', 'success');
        } catch (err) {
          const kind = _micErrorKind(err);
          if (kind === 'notfound') {
            toast('Mikrofon topilmadi — qurilma ulanganligini tekshiring', 'error');
          } else if (kind === 'denied') {
            toast("Hali ham ruxsat yo’q. Brauzer manzil qatori yonidagi qulfdan Mikrofonni yoqing", "error");
          } else {
            toast('Mikrofon ochilmadi: ' + (err.message || 'xato'), 'error');
          }
          throw err;
        }
      }
    });
    return;
  }

  try {
    const stream = await _requestMicStream();
    _mediaStream = stream;

    if (_voiceStopRequested || !_isHoldingVoice) {
      stream.getTracks().forEach(t => t.stop());
      _mediaStream = null;
      _stopPulse();
      return;
    }

    const MIME_CANDIDATES = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/webm',
    ];
    const chosenMime = MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported?.(m));
    const opts = chosenMime ? { mimeType: chosenMime } : {};

    _mediaRec = new MediaRecorder(stream, opts);
    _mediaRec.ondataavailable = e => {
      if (e.data && e.data.size > 0) _recChunks.push(e.data);
    };
    _mediaRec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      _mediaStream = null;
      const duration = Math.round((performance.now() - _recStartTs) / 1000);
      if (!_recChunks.length) return;
      const mimeType = _mediaRec.mimeType || chosenMime || 'audio/webm';
      const blob = new Blob(_recChunks, { type: mimeType });
      sendVoiceMessage(blob, duration);
    };

    _mediaRec.start();
    _startPulse(stream);

  } catch (err) {
    console.error('Mikrofon xatosi:', err);
    _abortVoiceUi();
    const kind = _micErrorKind(err);

    if (kind === 'notfound') {
      // Faqat jismoniy qurilma yo'qligida — ruxsat emas
      toast('Mikrofon topilmadi. Tashqi adapter yoki mikrofon ulanganligini tekshiring', 'error');
      return;
    }

    if (kind === 'busy') {
      toast('Mikrofon boshqa dasturda band', 'error');
      return;
    }

    // Ruxsat yo'q / boshqa — o'z cardimiz + browser popup
    _showMicPermCard({
      msg: kind === 'denied'
        ? 'Mikrofonga ruxsat berilmadi.'
        : 'Ovozli xabar uchun mikrofon kerak.',
      hint: "«Ruxsat berish»ni bosing — brauzer so’rovi chiqadi. Agar chiqmasa, manzil qatori yonidagi qulf ikonkasidan Mikrofonni yoqing.",
      onAllow: async () => {
        try {
          const s = await _requestMicStream();
          s.getTracks().forEach(t => t.stop());
          toast('Mikrofon ruxsati berildi — endi bosib turing', 'success');
        } catch (e2) {
          const k2 = _micErrorKind(e2);
          if (k2 === 'notfound') {
            toast('Mikrofon topilmadi — qurilma ulanganligini tekshiring', 'error');
          } else if (k2 === 'denied') {
            toast('Ruxsat berilmadi. Brauzer sozlamalaridan Mikrofonni yoqing', 'error');
          } else {
            toast('Mikrofon ochilmadi', 'error');
          }
          throw e2;
        }
      }
    });
  }
}

function stopRecording() {
  _voiceStopRequested = true;
  if (_mediaRec && _mediaRec.state !== 'inactive') {
    _mediaRec.stop();
  } else if (_mediaStream) {
    _mediaStream.getTracks().forEach(t => t.stop());
    _mediaStream = null;
  }
  _stopPulse();
}

function cancelRecording() {
  _voiceStopRequested = true;
  if (_mediaRec) {
    _mediaRec.ondataavailable = null;
    _mediaRec.onstop = null;
    if (_mediaRec.state !== 'inactive') {
      try { _mediaRec.stop(); } catch(_) {}
    }
    _mediaRec = null;
  }
  if (_mediaStream) {
    _mediaStream.getTracks().forEach(t => t.stop());
    _mediaStream = null;
  }
  _recChunks = [];
  _stopPulse();
}

/* ── 3 qavatli Telegram pulsatsiya to'lqini (Ultra-smooth Telegram physics) ─ */
function _startPulse(stream) {
  const r1 = $('cvPulse1');
  const r2 = $('cvPulse2');
  const r3 = $('cvPulse3');
  const vBtn = $('chatVoiceBtn');
  if (!r1 && !r2 && !r3) return;

  try {
    _pulseCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = _pulseCtx.createMediaStreamSource(stream);
    const analyser = _pulseCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85; // ultra-smooth audio analysis (no jitter)
    src.connect(analyser);
    _pulseAnalyser = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    let lastTime = performance.now();
    let phase = 0;
    _pulseLevel = 0.08;

    const tick = (now) => {
      if (!_pulseAnalyser) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      const maxBin = Math.min(64, data.length);
      for (let i = 2; i < maxBin; i++) sum += data[i];
      const avg = sum / (maxBin - 2) / 255;
      const target = Math.min(1, Math.max(0, (avg - 0.02) * 2.2));

      // Asymmetric spring-like smoothing: fast attack, gentle decay
      const speed = target > _pulseLevel ? 0.35 : 0.12;
      _pulseLevel += (target - _pulseLevel) * speed;

      const dt = (now - lastTime) / 1000;
      lastTime = now;
      phase += dt * 2.8;

      const breathe = Math.sin(phase) * 0.05;

      if (vBtn && !_voiceCancelled) {
        const btnScale = 1.18 + (_pulseLevel * 0.14) + breathe * 0.3;
        vBtn.style.transform = `scale(${btnScale.toFixed(3)})`;
      }

      if (r1) {
        const s1 = 1.05 + (_pulseLevel * 0.65) + breathe * 0.4;
        const o1 = 0.55 + (_pulseLevel * 0.42);
        r1.style.transform = `translate(-50%, -50%) scale(${s1.toFixed(3)})`;
        r1.style.opacity   = o1.toFixed(3);
      }

      if (r2) {
        const s2 = 1.32 + (_pulseLevel * 1.35) + Math.sin(phase - 0.6) * 0.07;
        const o2 = 0.38 + (_pulseLevel * 0.4);
        r2.style.transform = `translate(-50%, -50%) scale(${s2.toFixed(3)})`;
        r2.style.opacity   = o2.toFixed(3);
      }

      if (r3) {
        const s3 = 1.68 + (_pulseLevel * 2.05) + Math.sin(phase - 1.2) * 0.1;
        const o3 = 0.22 + (_pulseLevel * 0.32);
        r3.style.transform = `translate(-50%, -50%) scale(${s3.toFixed(3)})`;
        r3.style.opacity   = o3.toFixed(3);
      }

      _pulseRaf = requestAnimationFrame(tick);
    };

    _pulseRaf = requestAnimationFrame(tick);
  } catch (e) {
    console.warn('Pulse ring ishga tushmadi:', e?.message || e);
  }
}

function _stopPulse() {
  if (_pulseRaf) { cancelAnimationFrame(_pulseRaf); _pulseRaf = null; }
  if (_pulseCtx) { try { _pulseCtx.close(); } catch(_) {} _pulseCtx = null; }
  _pulseAnalyser = null;
  _pulseLevel = 0;
  const vBtn = $('chatVoiceBtn');
  if (vBtn) vBtn.style.transform = '';
  ['cvPulse1', 'cvPulse2', 'cvPulse3'].forEach(id => {
    const el = $(id);
    if (el) {
      el.style.transform = 'translate(-50%, -50%) scale(0.8)';
      el.style.opacity = '0';
    }
  });
}

async function sendVoiceMessage(blob, duration) {
  if (state.currentChatKind && state.currentChatKind !== 'dm') return sendGroupVoice(blob, duration);
  if (!state.currentChatId || !state.me) return;
  if (!rateOk('msg', 8, 10000)) return;
  const chatId   = state.currentChatId;
  const otherUid = state.currentChatUid;

  // 0ms: brauzerda darhol haqiqiy voice bubble (blob URL) — pending card yo'q
  const pendingId = 'pending_voice_' + Date.now();
  const localUrl = URL.createObjectURL(blob);
  _showOptimisticVoiceBubble(pendingId, localUrl, duration);

  try {
    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type });

    // Fon rejimida Supabase'ga yuklash (progress UI yo'q — bubble allaqachon ko'rinadi)
    const result = await uploadViaControllerProgress(file, 'chat-voice');

    const { error } = await sb.from('messages').insert({
      chat_id: chatId, sender_id: state.me.uid, type: 'voice',
      media_path: result.path, media_type: blob.type || null,
      duration: Math.round(duration || 0),
    });
    if (error) throw error;
    if (_latestChatMap[otherUid]) {
      _latestChatMap[otherUid].lastMessage = '🎤 Ovozli xabar';
      _latestChatMap[otherUid].lastMessageAt = Date.now();
      _latestChatMap[otherUid].lastSenderId = state.me.uid;
    }
    // Server xabari kelganda optimistik bubble o'chiriladi (reload)
    _removePendingBubble(pendingId);
    try { URL.revokeObjectURL(localUrl); } catch(_) {}
    _reloadThread && _reloadThread();

  } catch (err) {
    console.error('Voice send failed:', err);
    _removePendingBubble(pendingId);
    try { URL.revokeObjectURL(localUrl); } catch(_) {}
    toast('Ovozli xabar yuborilmadi', 'error');
  }
}

/* ── Chat file attach ──────────────────────────────────────────────────── */
function setChatFile(file) {
  _chatSelFile = file;
  $('cfpIcon').innerHTML = getChatFileIcon(file.name, file.type);
  $('cfpName').textContent = file.name.length > 36 ? file.name.slice(0, 34) + '…' : file.name;
  $('cfpSize').textContent = fmtSz(file.size);
  $('chatFilePreview').classList.add('active');
  updateVoiceSendBtn();
}

function clearChatFile() {
  _chatSelFile = null;
  $('chatFilePreview').classList.remove('active');
  $('chatFileInput').value = '';
  updateVoiceSendBtn();
}

/* ── Chat post attach (postni chatga ulashish) ────────────────────────── */
let _pendingPostShare = null;
export function setPendingPostShare(payload) {
  _pendingPostShare = payload;
  updatePostAttachBar();
}
export function getPendingPostShare() {
  return _pendingPostShare;
}
export function clearPendingPostShare() {
  _pendingPostShare = null;
  updatePostAttachBar();
}
export function updatePostAttachBar() {
  const bar = $('chatPostAttachBar');
  if (!bar) return;
  if (_pendingPostShare) {
    bar.style.display = 'flex';
    bar.classList.add('active');
    const authorEl = $('cpabAuthor');
    if (authorEl) {
      authorEl.textContent = _pendingPostShare.authorName + (_pendingPostShare.authorUsername ? (' @' + _pendingPostShare.authorUsername) : '');
    }
    const textEl = $('cpabText');
    if (textEl) {
      textEl.textContent = _pendingPostShare.text || (_pendingPostShare.mediaUrl ? 'Rasm/Video' : 'Post');
    }
    const thumbEl = $('cpabThumb');
    if (thumbEl) {
      if (_pendingPostShare.mediaUrl) {
        thumbEl.style.display = 'block';
        const isVid = _pendingPostShare.mediaType === 'video' || /\.(mp4|webm|mov)$/i.test(_pendingPostShare.mediaUrl);
        thumbEl.innerHTML = isVid
          ? `<video src="${esc(_pendingPostShare.mediaUrl)}"></video>`
          : `<img src="${esc(_pendingPostShare.mediaUrl)}" alt="thumb">`;
      } else {
        thumbEl.style.display = 'none';
        thumbEl.innerHTML = '';
      }
    }
  } else {
    bar.style.display = 'none';
    bar.classList.remove('active');
  }
  updateVoiceSendBtn();
}

export function parsePostShare(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && (parsed.__postShare === true || parsed.__postShare === 'true')) {
      return parsed;
    }
  } catch (_) {}
  return null;
}

export function formatLastMessageText(raw) {
  if (!raw) return '';
  const ps = parsePostShare(raw);
  if (ps) {
    if (ps.comment && ps.comment.trim()) {
      return `📌 ${ps.comment.trim()}`;
    }
    const name = ps.post?.authorName ? `${ps.post.authorName}` : 'Post';
    return `📌 Post: ${name}`;
  }
  return raw;
}

const _postExistenceMap = new Map(); // postId -> boolean (true: mavjud, false: o'chirilgan)
const _userExistenceMap = new Map(); // userId -> boolean (true: mavjud, false: o'chirilgan)

export function checkSharedPostExistence(msgs) {
  if (!msgs || !msgs.length || typeof sb === 'undefined') return;
  const pids = [];
  const uids = [];
  for (const m of msgs) {
    const ps = parsePostShare(m.text);
    if (ps?.post) {
      if (ps.post.id && !_postExistenceMap.has(ps.post.id)) pids.push(ps.post.id);
      if (ps.post.userId && !_userExistenceMap.has(ps.post.userId)) uids.push(ps.post.userId);
    }
  }
  if (!pids.length && !uids.length) return;

  const queries = [];
  if (pids.length) {
    queries.push(sb.from('posts').select('id').in('id', pids).then(({ data, error }) => {
      if (!error && data) {
        const found = new Set(data.map(x => x.id));
        pids.forEach(id => _postExistenceMap.set(id, found.has(id)));
      }
    }).catch(() => {}));
  }
  if (uids.length) {
    queries.push(sb.from('profiles').select('id').in('id', uids).then(({ data, error }) => {
      if (!error && data) {
        const found = new Set(data.map(x => x.id));
        uids.forEach(id => _userExistenceMap.set(id, found.has(id)));
      }
    }).catch(() => {}));
  }

  Promise.all(queries).then(() => {
    _updatePostCardsInDOM();
  });
}

function _updatePostCardsInDOM() {
  const cards = document.querySelectorAll('.chat-post-card[data-post-id]');
  cards.forEach(card => {
    const pid = card.dataset.postId;
    const uid = card.dataset.userId;
    const isPostDeleted = _postExistenceMap.get(pid) === false;
    const isUserDeleted = _userExistenceMap.get(uid) === false;

    if (isPostDeleted) {
      card.classList.add('post-deleted');
      const badge = card.querySelector('.cpc-badge');
      if (badge) {
        badge.classList.add('is-deleted');
        const span = badge.querySelector('span');
        if (span) span.textContent = "O'chirilgan post";
      }
      const caption = card.querySelector('.cpc-caption');
      if (caption) {
        caption.innerHTML = `<span class="cpc-deleted-text">Bu post o'chirilgan</span>`;
      }
      const media = card.querySelector('.cpc-media');
      if (media) media.style.display = 'none';

      const btn = card.querySelector('.cpc-open-btn');
      if (btn) {
        btn.classList.add('is-deleted');
        btn.innerHTML = `<span>Post o'chirilgan</span>`;
        btn.onclick = (e) => {
          e.stopPropagation();
          toast("Bu post o'chirilgan", 'error');
        };
      }
      const content = card.querySelector('.cpc-content');
      if (content) {
        content.classList.add('is-deleted');
        content.onclick = (e) => {
          e.stopPropagation();
          toast("Bu post o'chirilgan", 'error');
        };
      }
    }

    if (isUserDeleted) {
      card.classList.add('user-deleted');
      const avi = card.querySelector('.cpc-avi');
      if (avi) avi.classList.add('is-deleted');
      const authorName = card.querySelector('.cpc-author-name');
      if (authorName && !authorName.querySelector('.cpc-del-tag')) {
        authorName.classList.add('is-deleted');
        authorName.innerHTML += ` <span class="cpc-del-tag">(O'chirilgan hisob)</span>`;
      }
      const authorHandle = card.querySelector('.cpc-author-handle');
      if (authorHandle) authorHandle.classList.add('is-deleted');
    }
  });
}

export function renderChatPostCard(ps) {
  const p = ps.post || {};
  const comment = (ps.comment || '').trim();
  const authorName = esc(p.authorName || 'Foydalanuvchi');
  const authorUser = p.authorUsername ? `@${esc(p.authorUsername)}` : '';
  const authorAvi = p.authorAvatar ? esc(p.authorAvatar) : '';
  const postText = (p.text || '').trim();
  const mediaUrl = p.mediaUrl ? esc(p.mediaUrl) : '';
  const isVideo = p.mediaType === 'video' || /\.(mp4|webm|mov)$/i.test(p.mediaUrl || '');
  const postId = esc(p.id || '');
  const userId = esc(p.userId || '');

  const isPostDeleted = _postExistenceMap.get(p.id) === false;
  const isUserDeleted = _userExistenceMap.get(p.userId) === false;

  let mediaHtml = '';
  if (mediaUrl && !isPostDeleted) {
    if (isVideo) {
      mediaHtml = `
        <div class="cpc-media cpc-media--video">
          <video src="${mediaUrl}" controls playsinline preload="metadata"></video>
        </div>`;
    } else {
      mediaHtml = `
        <div class="cpc-media">
          <img src="${mediaUrl}" alt="Post media" loading="lazy">
        </div>`;
    }
  }

  const commentHtml = comment ? `
    <div class="cpc-comment">
      <div class="chat-bubble-text">${renderMarkdown(comment)}</div>
    </div>` : '';

  const captionHtml = isPostDeleted
    ? `<div class="cpc-caption"><span class="cpc-deleted-text">Bu post o'chirilgan</span></div>`
    : (postText ? `<div class="cpc-caption">${renderMarkdown(postText)}</div>` : '');

  const btnHtml = isPostDeleted
    ? `<button type="button" class="cpc-open-btn is-deleted" onclick="event.stopPropagation(); toast('Bu post o\\'chirilgan', 'error');">
         <span>Post o'chirilgan</span>
       </button>`
    : `<button type="button" class="cpc-open-btn" onclick="event.stopPropagation(); window._openPostFromChat && window._openPostFromChat('${postId}')">
         <span>Postni ko'rish</span>
         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
       </button>`;

  const badgeTitle = isPostDeleted ? "O'chirilgan post" : "Ulashilgan post";

  const cardClasses = [
    'chat-post-card',
    isPostDeleted ? 'post-deleted' : '',
    isUserDeleted ? 'user-deleted' : ''
  ].filter(Boolean).join(' ');

  const contentOnClick = isPostDeleted
    ? `toast('Bu post o\\'chirilgan', 'error')`
    : `window._openPostFromChat && window._openPostFromChat('${postId}')`;

  return `
    <div class="${cardClasses}" data-post-id="${postId}" data-user-id="${userId}">
      <div class="cpc-header">
        <div class="cpc-badge${isPostDeleted ? ' is-deleted' : ''}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <span>${badgeTitle}</span>
        </div>
      </div>
      <div class="cpc-content${isPostDeleted ? ' is-deleted' : ''}" onclick="${contentOnClick}">
        <div class="cpc-author-row">
          <div class="cpc-avi${isUserDeleted ? ' is-deleted' : ''}">
            ${authorAvi ? `<img src="${authorAvi}" alt="${authorName}" onerror="this.style.display='none'">` : `<div class="cpc-avi-placeholder">${authorName.charAt(0)}</div>`}
          </div>
          <div class="cpc-author-meta">
            <span class="cpc-author-name${isUserDeleted ? ' is-deleted' : ''}">${authorName}${isUserDeleted ? ' <span class="cpc-del-tag">(O\'chirilgan hisob)</span>' : ''}</span>
            ${authorUser ? `<span class="cpc-author-handle${isUserDeleted ? ' is-deleted' : ''}">${authorUser}</span>` : ''}
          </div>
        </div>
        ${captionHtml}
        ${mediaHtml}
        <div class="cpc-open-row">
          ${btnHtml}
        </div>
      </div>
      ${commentHtml}
    </div>
  `;
}

window._openPostFromChat = async function(postId) {
  if (!postId) return;
  if (_postExistenceMap.get(postId) === false) {
    toast("Bu post o'chirilgan", "error");
    return;
  }
  // Post mavjudligini bazadan tezkor tekshiramiz
  try {
    const { data } = await sb.from('posts').select('id').eq('id', postId).maybeSingle();
    if (!data) {
      _postExistenceMap.set(postId, false);
      _updatePostCardsInDOM();
      toast("Bu post o'chirilgan", "error");
      return;
    }
    _postExistenceMap.set(postId, true);
  } catch (_) {}

  try {
    closeChatThread();
  } catch (_) {}
  sessionStorage.setItem('target_post_id', postId);
  window.location.hash = '#post-' + postId;
  const { navigateTo } = await import('./router.js');
  navigateTo('home');
  const { scrollToPostFromHash } = await import('./feed.js');
  setTimeout(() => {
    scrollToPostFromHash();
  }, 100);
};

/** Xabar maydoni qatorlar soniga qarab balandlashadi (max ~7 qator, undan keyin ichida skroll). */
const _INPUT_MAX_H = 144;
export function autoGrowChatInput() {
  const el = $('chatThreadInput');
  if (!el) return;
  el.style.height = 'auto';
  const h = el.scrollHeight;
  if (!h) { el.style.height = ''; return; }   // modal yopiq (display:none) — o'lchab bo'lmaydi
  el.style.height = Math.min(h, _INPUT_MAX_H) + 'px';
  el.style.overflowY = h > _INPUT_MAX_H ? 'auto' : 'hidden';
}
window.addEventListener('resize', autoGrowChatInput);

export function updateVoiceSendBtn() {
  autoGrowChatInput();
  const inp  = $('chatThreadInput');
  const hasText = inp?.value?.trim().length > 0;
  const hasFile = !!_chatSelFile;
  const hasPost = !!_pendingPostShare;
  const showSend = hasText || hasFile || hasPost;
  const mic  = $('chatVoiceBtn').querySelector('.icon-mic');
  const send = $('chatVoiceBtn').querySelector('.icon-send');
  if (mic)  mic.style.display  = showSend ? 'none'  : '';
  if (send) send.style.display = showSend ? ''      : 'none';
}

async function sendChatFile(fileOverride = null, captionOverride = null) {
  const file = fileOverride || _chatSelFile;
  if (!file || !state.me) return;
  if (!rateOk('file', 5, 30000)) return;

  const caption = (captionOverride !== null && captionOverride !== undefined
    ? captionOverride
    : ($('chatThreadInput')?.value || '')
  ).trim();

  // Route to group file send if in group mode
  if (state.currentChatKind && state.currentChatKind !== 'dm') {
    clearChatFile();
    return sendGroupFile(file, caption);
  }
  if (!state.currentChatId) return;
  const chatId   = state.currentChatId;
  const otherUid = state.currentChatUid;

  clearChatFile();

  const pendingId = 'pending_file_' + Date.now();
  _showPendingBubble(pendingId, 'file', file.size, file.name, file.type);

  try {
    const result = await uploadViaControllerProgress(file, 'chat-files', pct => {
      _updatePendingProgress(pendingId, pct);
    });

    _removePendingBubble(pendingId);

    const { error } = await sb.from('messages').insert({
      chat_id: chatId, sender_id: state.me.uid, type: 'file',
      media_path: result.path, media_type: file.type || null,
      file_name: file.name, file_size: file.size,
      text: caption || null,
    });
    if (error) throw error;
    const previewText = caption ? ('📎 ' + caption) : ('📎 ' + (file.name || 'Fayl'));
    if (_latestChatMap[otherUid]) {
      _latestChatMap[otherUid].lastMessage = previewText.slice(0, 120);
      _latestChatMap[otherUid].lastMessageAt = Date.now();
      _latestChatMap[otherUid].lastSenderId = state.me.uid;
    }
    inboxSend(otherUid, { chatId, from: state.me.uid, id: pendingId, text: previewText.slice(0, 120), ts: Date.now() });
    _reloadThread && _reloadThread();

  } catch (err) {
    console.error('File send failed:', err);
    _removePendingBubble(pendingId);
    const inp = $('chatThreadInput');
    if (inp && caption) { inp.value = caption; updateVoiceSendBtn(); }
    toast('Fayl yuborilmadi', 'error');
  }
}


/* ── Optimistic voice bubble (0ms local blob → keyin Supabase) ───────── */
export function _showOptimisticVoiceBubble(id, localUrl, duration) {
  const box = $('chatThreadMessages');
  if (!box) return;
  const dur = duration ? fmtVoiceDur(duration) : '0:00';
  const barCount = _voiceBarCount(duration);
  const safeUrl = String(localUrl || '').replace(/"/g, '"');
  const time = fmtTime(Date.now());
  const _mpName = 'Siz';

  const el = document.createElement('div');
  el.className = 'chat-msg mine anim-in';
  el.id = id;
  el.dataset.optimistic = '1';
  el.innerHTML = `<div class="chat-bubble">
    <div class="chat-bubble-wrap">
      <div class="chat-voice-msg" data-url="${safeUrl}" data-dur="${Math.round(duration||0)}" data-bar-count="${barCount}" data-chat-id="${state.currentChatId||''}" data-chat-uid="${state.currentChatUid||''}" data-name="${_mpName}">
        <button class="cvm-play" onclick="window._chatPlayVoice(this)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <div class="cvm-waveform">${renderVoiceWave(0, barCount)}</div>
        <span class="cvm-dur">${dur}</span>
      </div>
      <span class="chat-msg-meta">
        <span class="chat-msg-time">${time}</span>
        ${renderTicks('sending')}
      </span>
    </div>
  </div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  // Waveformni darhol local blob dan hydrate qilish
  _hydrateVoiceWaveforms(box);
}

/* ── Pending bubble (upload progress) ───────────────────────────────── */
export function _showPendingBubble(id, type, size, name = '', mime = '') {
  const box = $('chatThreadMessages');
  if (!box) return;
  const szTxt = size ? fmtSz(size) : '';
  const isVoice = type === 'voice';
  const inner = isVoice
    ? `<div class="cpb-voice">
        <div class="cpb-mic-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" fill="none" stroke-width="2"/></svg>
        </div>
        <div class="cpb-info">
          <div class="cpb-label">Ovoz yuborilmoqda...</div>
          ${szTxt ? `<div class="cpb-size">${szTxt}</div>` : ''}
        </div>
      </div>`
    : `<div class="cpb-file">
        <div class="cpb-file-icon">${getChatFileIcon(name, mime)}</div>
        <div class="cpb-info">
          <div class="cpb-label">${esc(name || 'Fayl')}</div>
          ${szTxt ? `<div class="cpb-size">${szTxt}</div>` : ''}
        </div>
      </div>`;

  const el = document.createElement('div');
  el.className = 'chat-msg mine cpb-wrap';
  el.id = id;
  el.innerHTML = `<div class="chat-bubble cpb-bubble">
    <div class="chat-bubble-wrap">
      ${inner}
      <div class="cpb-progress-bar"><div class="cpb-progress-fill" id="${id}_fill"></div></div>
      <div class="cpb-pct" id="${id}_pct">0%</div>
    </div>
  </div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

export function _updatePendingProgress(id, pct) {
  const fill = document.getElementById(id + '_fill');
  const lbl  = document.getElementById(id + '_pct');
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent  = Math.round(pct) + '%';
}

export function _removePendingBubble(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/* ── XHR upload with progress (Supabase direct upload) ─────────────── */
export async function uploadViaControllerProgress(file, folder, onProgress) {
  const { data: { session } } = await sb.auth.getSession();
  const token = session?.access_token;
  if (!token || !state.me) throw new Error('Tizimga kirilmagan');

  const safeName = file.name.replace(/[^\w.\-]/g, '_').replace(/_+/g, '_');
  const path = `${state.me.uid}/${folder}/${Date.now()}_${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))}_${safeName}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
    };
    // Progress ishlamasa/xato bo'lsa — oddiy yuklashga o'tamiz (haqiqiy xato shu yerda chiqadi)
    const fallback = () => uploadViaController(file, folder)
      .then(res => { if (onProgress) onProgress(100); resolve(res); })
      .catch(reject);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve({ path, url: mediaPublicUrl(path) });
      } else fallback();
    };
    xhr.onerror = fallback;
    xhr.send(file);
  });
}

/* ── Wire static DOM (modal already exists in index.html on page load) ── */
$('chatThreadBack').onclick = closeChatThread;

// Xabar kontekst menyusi (o'ng tugma / mobilda bosib turish) — modules/msg-menu.js
initMsgMenu({
  box: $('chatThreadMessages'),
  getMsgs: () => _curMsgs,
  reload: () => { if (state.currentChatKind && state.currentChatKind !== 'dm') reloadGroupThread(); else if (_reloadThread) _reloadThread(); },
  // Optimistic delete: UI dan darhol olib tashlash (dissolve ishlashi uchun markDissolve oldindan chaqirilgan)
  applyLocalDelete: (ids) => {
    const set = new Set((ids || []).map(String));
    if (!set.size) return;
    ids.forEach(id => { try { _rtLocal.delete(id); } catch (_) {} });
    paintMessages(_curMsgs.filter(x => !set.has(String(x.id))));
  },
  syncInput: updateVoiceSendBtn,
  getUsers: async () => (_usersCache && _usersCache.length) ? _usersCache : await _fetchChatUsers(),
  chatIdFor: async uid => {
    const cached = _latestChatMap[uid]?.id;
    if (cached && _UUID_RE.test(cached)) return cached;
    const { data, error } = await sb.rpc('get_or_create_chat', { p_other: uid });
    return error ? null : data;
  },
});
$('chatThreadModal').addEventListener('click', e => {
  if (e.target === $('chatThreadModal')) closeChatThread();
});

// Groups DOM injection + "+" button
injectGroupsDOM();
state.currentChatKind = state.currentChatKind || 'dm';

const _chatsAddBtn = $('chatsAddBtn');
if (_chatsAddBtn) _chatsAddBtn.addEventListener('click', openCreateChoice);

// Input text changes — toggle mic/send icon + "yozmoqda..." holatini yuborish
$('chatThreadInput').addEventListener('input', updateVoiceSendBtn);
$('chatThreadInput').addEventListener('input', _onChatInputTyping);
$('chatThreadInput').addEventListener('keydown', e => {
  // Desktop: Enter = yuborish, Shift+Enter = yangi qator. Telefon (sensorli): Enter = yangi qator, yuborish tugma bilan.
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !window.matchMedia('(pointer: coarse)').matches) { e.preventDefault(); handleSendAction(); }
});

/* ── Composer emoji tugmasi — matn maydoni ichida chapda (Telegram
 * uslubi). Kompakt quick-picker: keng tarqalgan emojilardan iborat
 * ro'yxat, bosilganda kursor turgan joyga qo'shiladi. ── */
initEmojiPicker({ btn: $('chatEmojiBtn'), pop: $('chatEmojiQuickpick'), input: $('chatThreadInput') });

// Mikrofon / Yuborish tugmasi — Telegram uslubidagi "Bosib turib gapirish" (Push-to-Talk)
const _vBtn = $('chatVoiceBtn');
if (_vBtn) {
  _vBtn.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;

    const inp = $('chatThreadInput');
    const hasText = inp?.value?.trim().length > 0;
    const hasFile = !!_chatSelFile;
    const hasPost = !!_pendingPostShare;

    // Matn yoki fayl yoki post bo'lsa — bu yuborish tugmasi (click orqali ishlaydi)
    if (hasText || hasFile || hasPost) return;

    e.preventDefault();
    _activePointerId = e.pointerId;
    try { _vBtn.setPointerCapture(e.pointerId); } catch (_) {}

    _isHoldingVoice = true;
    _voiceCancelled = false;
    _voiceStartX = e.clientX;
    _voiceStartY = e.clientY;
    _voiceStartTime = Date.now();

    _vBtn.classList.add('recording');
    _vBtn.classList.remove('cancelling');
    _clearVoiceCancelVisuals();
    _applyVoiceCancelProgress(0);
    _showRecordBar();
    startRecording();
  });

  _vBtn.addEventListener('pointermove', e => {
    if (!_isHoldingVoice) return;
    const dx = e.clientX - _voiceStartX;
    // Chapga surish: 0..1 progress — rang silliq o'zgaradi, to'satdan qizarib ketmaydi
    const progress = dx >= 0 ? 0 : Math.min(1, (-dx) / _VOICE_CANCEL_DIST);
    const full = _applyVoiceCancelProgress(progress);
    _voiceCancelled = full;
    _vBtn.classList.toggle('cancelling', full);
  });

  const _finishVoiceHold = () => {
    if (!_isHoldingVoice) return;
    _isHoldingVoice = false;
    _voiceJustHandled = true;
    setTimeout(() => { _voiceJustHandled = false; }, 350);

    if (_activePointerId !== null) {
      try { _vBtn.releasePointerCapture(_activePointerId); } catch (_) {}
      _activePointerId = null;
    }

    _vBtn.classList.remove('recording', 'cancelling');
    _clearVoiceCancelVisuals();
    _hideRecordBar();

    const duration = Date.now() - _voiceStartTime;

    if (_voiceCancelled) {
      cancelRecording();
      toast('Ovozli xabar bekor qilindi');
    } else if (duration < 500) {
      // Juda qisqa bosish (tap)
      cancelRecording();
      toast('Ovoz yozish uchun mikrofoni bosib turing');
    } else {
      // Normal qo'yib yuborish: ovoz darhol ketadi!
      stopRecording();
    }
  };

  _vBtn.addEventListener('pointerup', _finishVoiceHold);
  _vBtn.addEventListener('pointercancel', () => {
    if (!_isHoldingVoice) return;
    _voiceCancelled = true;
    _finishVoiceHold();
  });

  _vBtn.addEventListener('click', e => {
    if (_voiceJustHandled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const hasText = $('chatThreadInput')?.value?.trim().length > 0;
    const hasFile = !!_chatSelFile;
    const hasPost = !!_pendingPostShare;
    if (hasText || hasFile || hasPost) {
      handleSendAction();
    } else {
      toast('Ovoz yozish uchun mikrofoni bosib turing');
    }
  });

  window.addEventListener('blur', () => {
    if (_isHoldingVoice) {
      _voiceCancelled = true;
      _finishVoiceHold();
    }
  });
}

/* ── Mobil klaviatura moslashuvi (keyboard inputni yopib qo'ymasligi uchun) ── */
function initKeyboardAdaptation() {
  const modal = $('chatThreadModal');
  const inp   = $('chatThreadInput');
  const msgs  = $('chatThreadMessages');
  if (!modal) return;

  const adapt = () => {
    if (!modal.classList.contains('show')) return;
    if (window.visualViewport) {
      const vv = window.visualViewport;
      // Klaviatura ochilgandagi balandlik farqi
      const offset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      if (offset > 20) {
        modal.style.bottom = `${offset}px`;
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      } else {
        modal.style.bottom = '0px';
      }
    }
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adapt);
    window.visualViewport.addEventListener('scroll', adapt);
  }

  if (inp) {
    inp.addEventListener('focus', () => {
      setTimeout(adapt, 120);
      setTimeout(adapt, 280);
      setTimeout(() => { if (msgs) msgs.scrollTop = msgs.scrollHeight; }, 300);
    });
    inp.addEventListener('blur', () => {
      setTimeout(() => {
        if (modal) modal.style.bottom = '0px';
      }, 100);
    });
  }
}
initKeyboardAdaptation();


// File attach
$('chatAttachBtn')?.addEventListener('click', () => $('chatFileInput')?.click());
$('chatFileInput')?.addEventListener('change', e => {
  const f = e.target.files?.[0];
  if (f) setChatFile(f);
});
$('cfpRemove')?.addEventListener('click', clearChatFile);
$('chatPostAttachClose')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  clearPendingPostShare();
});
// Ctrl+V / drag-drop (upload.js) — fayl suhbatga biriktiriladi (xuddi "skrepka" bilan tanlangandek), Enter/yuborish bilan ketadi
document.addEventListener('chat:attach-file', e => {
  const f = e.detail?.file;
  if (!f || !$('chatFilePreview')) return;
  setChatFile(f);
  $('chatThreadInput')?.focus({ preventScroll: true });
});

async function handleSendAction() {
  if (_chatSelFile) {
    const inp = $('chatThreadInput');
    const text = inp ? inp.value.trim() : '';
    if (inp) {
      inp.value = '';
      inp.style.height = '';
    }
    updateVoiceSendBtn();
    await sendChatFile(null, text);
  } else {
    await sendChatMessage();
  }
}

/* ── destroyChatsView: chat viewdan chiqqanda cleanup ─────────────────── */
export function destroyChatsView() {
  // Thread listener'ni to'xtatish
  if (_threadUnsub) { _threadUnsub(); _threadUnsub = null; }
  // Thread modal'ni yopish
  try { closeChatThread(); } catch (_) {}
  _searchQuery = '';
  const inp = document.getElementById('chatSearchInput');
  if (inp) inp.value = '';
  const clearBtn = document.getElementById('chatSearchClear');
  if (clearBtn) clearBtn.classList.add('d-none');
  const res = document.getElementById('chatSearchResult');
  if (res) res.classList.add('d-none');
  // chatsWatcher'ni to'xtatmaymiz — u background notification uchun kerak
  // (auth.js stopChatsWatcher logout paytida chaqiradi)
}

/* ── Chat thread header: avi/nom bosilganda profil ochish ────────────── */
// DM uchun: shu suhbatdagi media/musiqa/fayllar paneli (haqiqiy profil emas)
// Guruh/Kanal uchun: guruh info overlay
(function() {
  const aviEl  = document.getElementById('chatThreadAvi');
  const nameEl = document.getElementById('chatThreadName');

  async function openCurrentProfile() {
    const kind = state.currentChatKind || 'dm';
    if (kind === 'dm') {
      const uid = state.currentChatUid;
      if (!uid) return;
      const { openChatMedia } = await import('./chat-media.js');
      openChatMedia({ chatId: state.currentChatId, name: nameEl?.textContent, avatar: aviEl?.querySelector('img')?.src });
    } else {
      // guruh yoki kanal — group info overlay
      const { openGroupInfo } = await import('./groups.js');
      if (state.currentChatId || window._currentGroupId) {
        // currentGroupId groups.js ichida — openGroupThread da o'rnatiladi
        const gid = document.getElementById('chatThreadModal')?.dataset?.gid
          || window._currentGroupId;
        if (gid) openGroupInfo(gid);
      }
    }
  }

  if (aviEl)  aviEl.style.cursor  = 'pointer';
  if (nameEl) nameEl.style.cursor = 'pointer';
  if (aviEl)  aviEl.addEventListener('click',  openCurrentProfile);
  if (nameEl) nameEl.addEventListener('click', openCurrentProfile);
})();
