/**
 * MRspace — Dashboard Summary (tezkor umumiy ko'rinish)
 * actionsView boshida — bitta qatorli statistika:
 * jami foydalanuvchilar, bugungi yangilar, kutayotganlar, bloklanganlar. Scroll qilmasdan holatni darhol ko'rsatadi.
 */

import { sb, state, mapProfile, fetchAllRows } from './config.js';

let _usersUnsub = null;

let _usersSnapCache = null; // oxirgi users snapshot natijasi

/* ── CSS ── */
function _injectCSS() {
  if (document.getElementById('dash-summary-css')) return;
  const s = document.createElement('style');
  s.id = 'dash-summary-css';
  s.textContent = `
.dash-bar { display: flex; flex-wrap: wrap; gap: 4px 16px; padding: 10px 12px; font-size: 13px; color: var(--text2); }
.dash-item b { color: var(--text); font-weight: 700; }
.dash-item--warn b { color: var(--red,#ef4444); }
.dash-card-loading { opacity: 0.5; }
`;
  document.head.appendChild(s);
}

function _startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function _render(containerId) {
  const section = document.getElementById(containerId);
  if (!section) return;

  const loading = !_usersSnapCache;
  const users = _usersSnapCache || [];

  const total   = users.length;
  const todayStart = _startOfToday();
  const newToday = users.filter(u => {
    const t = u.createdAt?.toDate ? u.createdAt.toDate() : null;
    return t && t >= todayStart;
  }).length;
  const pending = users.filter(u => u.approved === false && !u.blocked).length;
  const blocked = users.filter(u => u.blocked === true).length;

  const cards = [
    { label: "Jami", value: total, cls: '' },
    { label: "Bugun yangi", value: newToday, cls: 'info' },
    { label: "Kutayotgan", value: pending, cls: pending > 0 ? 'warn' : 'ok' },
    { label: "Bloklangan", value: blocked, cls: blocked > 0 ? 'warn' : '' },
  ];

  section.innerHTML = `
    <div class="dash-bar${loading ? ' dash-card-loading' : ''}">
      ${cards.map(c => `<span class="dash-item${c.cls ? ' dash-item--' + c.cls : ''}">${c.label}: <b>${loading ? '…' : c.value}</b></span>`).join('')}
    </div>
  `;
}

/* ── initDashboardSummary ── */
export function initDashboardSummary(containerId) {
  _injectCSS();
  _render(containerId);

  if (_usersUnsub) { _usersUnsub(); _usersUnsub = null; }

  let dead = false, timer = null;
  const load = async () => {
    try {
      const rows = await fetchAllRows('profiles', 'id,approval,blocked,created_at');
      if (dead) return;
      _usersSnapCache = rows.map(mapProfile).filter(u => u.uid !== state.me?.uid);
      _render(containerId);
    } catch (e) { console.warn('[dashboard-summary]', e?.message || e); }
  };
  // presence (last_seen) yangilanishlari ko'p — UPDATE'larni siyraklashtiramiz
  const schedule = ev => { clearTimeout(timer); timer = setTimeout(load, ev === 'UPDATE' ? 5000 : 400); };
  load();
  const ch = sb.channel('admin-dash')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, p => schedule(p.eventType))
    .subscribe();
  _usersUnsub = () => { dead = true; clearTimeout(timer); sb.removeChannel(ch); };
}

export function destroyDashboardSummary() {
  if (_usersUnsub) { _usersUnsub(); _usersUnsub = null; }
  _usersSnapCache = null;
}
