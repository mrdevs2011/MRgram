/**
 * MRgram — Admin Audit Log
 * Har bir muhim admin amalini 'admin_actions' jadvaliga yozadi
 * va actions sahifasida "So'nggi amallar" ro'yxatini render qiladi.
 */

import { sb, state, ts } from './config.js';
import { esc } from './utils.js';

const MAX_ITEMS = 30;

/* ── Amal turlari uchun label/icon ── */
const ACTION_META = {
  userBlock:        'Bloklandi',
  userUnblock:      'Blokdan chiqarildi',
  userDelete:       "O'chirildi",
  userApprove:      'Tasdiqlandi',
  userReject:       'Rad etildi',
  broadcastSend:    "E'lon chop etildi",
  broadcastDelete:  "E'lon o'chirildi",
};

/* ── Yozish ──
 * action: yuqoridagi kalitlardan biri
 * targetUid/targetName: amal qaysi foydalanuvchi/postga tegishli (ixtiyoriy)
 * details: qisqa qo'shimcha matn (ixtiyoriy)
 */
export async function logAdminAction({ action, targetUid = null, targetName = '', details = '' } = {}) {
  try {
    const { error } = await sb.from('admin_actions').insert({
      action,
      target_uid:  targetUid,
      target_name: targetName,
      details,
      admin_id:    state.me?.uid || null,
      admin_name:  state.me?.displayName || state.me?.email || 'Admin',
    });
    if (error) throw error;
  } catch (err) {
    // Audit log yozilmasa ham asosiy amal to'xtamasin — faqat konsolga chiqaramiz
    console.warn('[AdminAudit] Yozib bo\'lmadi:', err.message);
  }
}

/* ── CSS ── */
function _injectCSS() {
  if (document.getElementById('admin-audit-css')) return;
  const s = document.createElement('style');
  s.id = 'admin-audit-css';
  s.textContent = `
.audit-wrap { max-height: 300px; overflow-y: auto; }
.audit-empty { padding: 12px; color: var(--text3); font-size: 13px; }
.audit-item { display: flex; flex-wrap: wrap; gap: 2px 10px; padding: 6px 12px; border-bottom: 1px solid var(--line); font-size: 12.5px; }
.audit-title { font-weight: 700; color: var(--text); }
.audit-sub { color: var(--text2); word-break: break-word; }
.audit-meta { color: var(--text3); font-family: var(--mono); font-size: 11.5px; }
`;
  document.head.appendChild(s);
}

let _unsub = null;

/* ── Render: real-vaqt "So'nggi amallar" ro'yxati ── */
export function initAuditLog(containerId) {
  const section = document.getElementById(containerId);
  if (!section) return;
  _injectCSS();

  section.innerHTML = `<div class="audit-wrap" id="auditWrap"><div class="audit-empty">Yuklanmoqda…</div></div>`;
  const wrap = document.getElementById('auditWrap');

  if (_unsub) { _unsub(); _unsub = null; }

  let dead = false;
  const load = async () => {
    const { data, error } = await sb.from('admin_actions').select('*')
      .order('created_at', { ascending: false }).limit(MAX_ITEMS);
    if (dead) return;
    if (error) { wrap.innerHTML = `<div class="audit-empty">Xatolik: ${esc(error.message)}</div>`; return; }
    _render(data || []);
  };
  const _render = (rows) => {
    if (!rows.length) {
      wrap.innerHTML = `<div class="audit-empty">Hozircha hech qanday amal qayd etilmagan</div>`;
      return;
    }

    wrap.innerHTML = rows.map(r => {
      const label = ACTION_META[r.action] || r.action || 'Amal';
      const ta = ts(r.created_at);
      const dt = ta?.toDate ? ta.toDate().toLocaleString('uz-UZ') : 'hozir';
      const what = [r.target_name, r.details].filter(Boolean).join(' — ');
      return `
        <div class="audit-item">
          <span class="audit-meta">[${dt}]</span>
          <span class="audit-title">${esc(label)}</span>
          ${what ? `<span class="audit-sub">${esc(what)}</span>` : ''}
          <span class="audit-meta">${esc(r.admin_name || 'Admin')}</span>
        </div>`;
    }).join('');
  };

  load();
  const ch = sb.channel('admin-audit')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_actions' }, () => load())
    .subscribe();
  _unsub = () => { dead = true; sb.removeChannel(ch); };
}

export function destroyAuditLog() {
  if (_unsub) { _unsub(); _unsub = null; }
}
