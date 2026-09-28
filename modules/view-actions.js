/**
 * MRspace — Admin Actions Panel
 * Statistika, Foydalanuvchilar va Broadcast birlashtirilgan panel
 * Faqat admin (ADMIN_UID) uchun
 */

import { sb, state, isAdmin, ts } from './config.js';
import { toast } from './toast.js';
import { esc } from './utils.js';
import { initAuditLog, destroyAuditLog, logAdminAction } from './admin-audit.js';
import { initDashboardSummary, destroyDashboardSummary } from './dashboard-summary.js';

let _initialized = false;
let _noticeUnsub    = null;
let _bcHistoryUnsub = null;

/* ── CSS ── */
function _injectCSS() {
  if (document.getElementById('actions-view-css')) return;
  const s = document.createElement('style');
  s.id = 'actions-view-css';
  s.textContent = `
#actionsView { background: var(--bg); }

.actions-divider {
  display: flex; align-items: center; gap: 10px;
  padding: 20px 16px 10px; margin-top: 4px;
}
.actions-divider::before, .actions-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--line);
}
.actions-divider-label {
  font-size: 12px; font-weight: 700; color: var(--text2);
  letter-spacing: 0.3px; white-space: nowrap; padding: 0 4px;
}

/* ── Broadcast UI ── */
.bc-wrap {
  margin: 0 16px 8px;
  background: var(--bg2);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bc-row {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
}
.bc-input {
  flex: 1; min-width: 0;
  background: var(--bg3);
  border: 1px solid var(--line2);
  border-radius: 8px;
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  padding: 9px 12px;
  outline: none;
  transition: border-color 0.15s;
}
.bc-input:focus { border-color: var(--blue); }
.bc-input::placeholder { color: var(--text3); }
.bc-select {
  background: var(--bg3);
  border: 1px solid var(--line2);
  border-radius: 8px;
  color: var(--text2);
  font-family: var(--font);
  font-size: 12px;
  padding: 9px 10px;
  outline: none;
  cursor: pointer;
}
.bc-send-btn {
  display: flex; align-items: center; gap: 6px;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 9px 16px;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.bc-send-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.bc-send-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
.bc-result {
  font-size: 12px;
  color: var(--text3);
  min-height: 16px;
}
.bc-result.ok  { color: var(--green); }
.bc-result.err { color: var(--red); }

/* ── Bo'sh holat ── */
.bc-empty {
  background: var(--bg2);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px 16px;
  text-align: center;
  color: var(--text3);
  font-size: 13px;
}
`;
  document.head.appendChild(s);
}

/* ── initView ── */
export async function initView() {
  if (!isAdmin()) return;
  _injectCSS();

  _initDashboardSummary();
  _initAuditLog();
  _initBroadcast();
  await _initUsers();

  _initialized = true;
}

/* ── Dashboard Summary: tezkor umumiy ko'rinish ── */
function _initDashboardSummary() {
  if (!document.getElementById('actionsDashboardSection')) return;
  initDashboardSummary('actionsDashboardSection');
}

/* ── Audit Log: "So'nggi amallar" ── */
function _initAuditLog() {
  let section = document.getElementById('actionsAuditSection');
  if (!section) {
    // HTML da yo'q bo'lsa ham ishlashi uchun dinamik yaratamiz (usersAdminList dan oldin)
    section = document.createElement('div');
    section.id = 'actionsAuditSection';
    const hdr = document.querySelector('.users-admin-hdr');
    if (hdr && hdr.parentElement) {
      const divider = document.createElement('div');
      divider.className = 'actions-divider';
      divider.innerHTML = '<span class="actions-divider-label">So\'nggi amallar</span>';
      hdr.parentElement.insertBefore(divider, hdr);
      hdr.parentElement.insertBefore(section, hdr);
    } else {
      document.getElementById('actionsView')?.prepend(section);
    }
  }
  initAuditLog('actionsAuditSection');
}

/* ── Broadcast / Admin Notice ── */
function _initBroadcast() {
  const section = document.getElementById('actionsBroadcastSection');
  if (!section || section.dataset.ready) return;
  section.dataset.ready = '1';

  section.innerHTML = `
    <div class="bc-wrap">
      <div class="bc-row">
        <textarea class="bc-input bc-textarea" id="bcBody" placeholder="Xabar matni… (maslan: Bugun vaqtim yo'q, ertaga ochib qo'yaman)" maxlength="300" rows="3"></textarea>
      </div>
      <div class="bc-row">
        <select class="bc-select" id="bcTarget">
          <option value="all">Barchaga (chat + kutayotganlar)</option>
          <option value="approved">Faqat tasdiqlanganlarga (chat)</option>
          <option value="pending">Faqat kutayotganlarga (ularning ekranida)</option>
        </select>
        <button class="bc-send-btn" id="bcSendBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          E'lon qilish
        </button>
      </div>
      <div class="bc-result" id="bcResult"></div>
    </div>
    <div class="bc-current-wrap" id="bcCurrentWrap" style="display:none;">
      <div class="bc-current-label">Faol e'lon:</div>
      <div class="bc-current-card" id="bcCurrentCard"></div>
      <button class="bc-del-btn" id="bcDelBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        E'lonni o'chirish
      </button>
    </div>
    <div class="bc-history-wrap">
      <div class="bc-history-label">E'lonlar tarixi</div>
      <div id="bcHistoryList"><div class="bc-empty">Yuklanmoqda…</div></div>
    </div>
  `;

  // Extra CSS
  if (!document.getElementById('bc-notice-css')) {
    const s = document.createElement('style');
    s.id = 'bc-notice-css';
    s.textContent = `
.bc-textarea { resize: vertical; min-height: 70px; }
.bc-current-wrap {
  margin: 0 16px 12px;
  background: color-mix(in srgb, var(--blue) 10%, var(--bg2));
  border: 1px solid color-mix(in srgb, var(--blue) 30%, transparent);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.bc-current-label { font-size: 11px; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.4px; }
.bc-current-card { font-size: 13px; color: var(--text); line-height: 1.45; word-break: break-word; }
.bc-current-target { font-size: 11px; color: var(--blue); margin-top: 4px; }
.bc-del-btn {
  display: flex; align-items: center; gap: 6px;
  align-self: flex-start;
  background: color-mix(in srgb, var(--red,#ef4444) 15%, transparent);
  color: var(--red,#ef4444);
  border: 1px solid color-mix(in srgb, var(--red,#ef4444) 35%, transparent);
  border-radius: 8px;
  font-family: var(--font); font-size: 12px; font-weight: 600;
  padding: 6px 12px; cursor: pointer;
  transition: opacity 0.15s;
}
.bc-del-btn:hover { opacity: 0.75; }
.bc-history-wrap {
  margin: 0 16px 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.bc-history-label { font-size: 11px; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.4px; }
.bc-history-item {
  background: var(--bg2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12.5px;
  color: var(--text);
  line-height: 1.4;
}
.bc-history-text { word-break: break-word; }
.bc-history-meta { font-size: 11px; color: var(--text3); margin-top: 4px; }
`;
    document.head.appendChild(s);
  }

  const bodyEl   = document.getElementById('bcBody');
  const targetEl = document.getElementById('bcTarget');
  const sendBtn  = document.getElementById('bcSendBtn');
  const resultEl = document.getElementById('bcResult');
  const currentWrap = document.getElementById('bcCurrentWrap');
  const currentCard = document.getElementById('bcCurrentCard');
  const delBtn   = document.getElementById('bcDelBtn');

  const TARGET_LABELS = {
    all: 'Barchaga (chat + kutayotganlar)',
    approved: 'Faqat tasdiqlanganlarga',
    pending: 'Faqat kutayotganlarga',
  };

  // Real-time: faol e'lonni ko'rsat
  if (_noticeUnsub) { _noticeUnsub(); _noticeUnsub = null; }
  let _noticeDead = false;
  const _paintNotice = d => {
    if (d) {
      currentWrap.style.display = 'flex';
      currentCard.innerHTML = `
        <div>${(d.text || '').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div>
        <div class="bc-current-target"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg> ${TARGET_LABELS[d.target] || d.target}</div>
      `;
    } else {
      currentWrap.style.display = 'none';
      currentCard.innerHTML = '';
    }
  };
  const _loadNotice = async () => {
    const { data } = await sb.from('admin_notice').select('*').eq('id', 'global').maybeSingle();
    if (!_noticeDead) _paintNotice(data || null);
  };
  _loadNotice();
  const _noticeCh = sb.channel('admin-notice-panel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_notice' }, () => _loadNotice())
    .subscribe();
  _noticeUnsub = () => { _noticeDead = true; sb.removeChannel(_noticeCh); };

  // Real-time: e'lonlar tarixi (oxirgi 20 ta)
  if (_bcHistoryUnsub) { _bcHistoryUnsub(); _bcHistoryUnsub = null; }
  const historyList = document.getElementById('bcHistoryList');
  let _histDead = false;
  const _paintHistory = rows => {
    if (!historyList) return;
    if (!rows.length) {
      historyList.innerHTML = `<div class="bc-empty">Hozircha e'lon yuborilmagan</div>`;
      return;
    }
    historyList.innerHTML = rows.map(h => {
      const dt = ts(h.created_at)?.toDate().toLocaleString('uz-UZ') || '';
      return `
        <div class="bc-history-item">
          <div class="bc-history-text">${esc(h.text || '')}</div>
          <div class="bc-history-meta">${TARGET_LABELS[h.target] || h.target || ''} · ${dt}</div>
        </div>`;
    }).join('');
  };
  const _loadHistory = async () => {
    const { data, error } = await sb.from('broadcast_history').select('*')
      .order('created_at', { ascending: false }).limit(20);
    if (_histDead) return;
    if (error) { if (historyList) historyList.innerHTML = `<div class="bc-empty">Tarixni yuklab bo'lmadi</div>`; return; }
    _paintHistory(data || []);
  };
  _loadHistory();
  const _histCh = sb.channel('admin-bc-history')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcast_history' }, () => _loadHistory())
    .subscribe();
  _bcHistoryUnsub = () => { _histDead = true; sb.removeChannel(_histCh); };

  // Yuborish
  sendBtn.addEventListener('click', async () => {
    const body   = bodyEl.value.trim();
    const target = targetEl.value;

    if (!body) { bodyEl.focus(); return; }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Saqlanmoqda…';
    resultEl.textContent = '';
    resultEl.className = 'bc-result';

    try {
      const { error: noticeErr } = await sb.from('admin_notice')
        .upsert({ id: 'global', text: body, target, admin_id: state.me.uid, created_at: new Date().toISOString() });
      if (noticeErr) throw noticeErr;
      sb.from('broadcast_history').insert({ text: body, target, admin_id: state.me.uid }).then(() => {}, () => {});
      bodyEl.value = '';
      resultEl.textContent = 'E\'lon muvaffaqiyatli chop etildi';
      resultEl.className = 'bc-result ok';
      toast('E\'lon chop etildi', 'success');
      logAdminAction({
        action: 'broadcastSend',
        details: `[${TARGET_LABELS[target] || target}] ${body.slice(0, 80)}${body.length > 80 ? '…' : ''}`,
      });
    } catch (err) {
      resultEl.textContent = `Xatolik: ${err.message}`;
      resultEl.className = 'bc-result err';
      toast('Xatolik: ' + err.message, 'error');
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        E'lon qilish`;
    }
  });

  // O'chirish
  delBtn.addEventListener('click', async () => {
    if (!confirm('E\'lonni o\'chirasizmi?')) return;
    try {
      const { error: delErr } = await sb.from('admin_notice').delete().eq('id', 'global');
      if (delErr) throw delErr;
      toast('E\'lon o\'chirildi', 'success');
      logAdminAction({ action: 'broadcastDelete' });
    } catch (err) {
      toast('O\'chirishda xatolik: ' + err.message, 'error');
    }
  });

}

/* ── Users ── */
async function _initUsers() {
  try {
    const { initView: usersInit } = await import('./view-users.js');
    usersInit();
  } catch (err) {
    console.error('[Actions] Users init error:', err);
  }
}

export function destroyView() {
  _initialized = false;
  const section = document.getElementById('actionsBroadcastSection');
  if (section) delete section.dataset.ready;
  destroyAuditLog();
  destroyDashboardSummary();
  if (_noticeUnsub) { _noticeUnsub(); _noticeUnsub = null; }
  if (_bcHistoryUnsub) { _bcHistoryUnsub(); _bcHistoryUnsub = null; }
}
