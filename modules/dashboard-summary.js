/**
 * MRgram — Dashboard Summary (tezkor umumiy ko'rinish)
 * actionsView boshida — barcha bo'limlardan oldin — kichik "stat card"lar:
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
.dash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
  gap: 8px;
  margin: 12px 16px 4px;
}
.dash-card {
  background: var(--bg2);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.dash-card-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.1;
}
.dash-card-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text3);
  line-height: 1.25;
}
.dash-card--warn  .dash-card-value { color: var(--red,#ef4444); }
.dash-card--info  .dash-card-value { color: var(--blue,#ffffff); }
.dash-card--ok    .dash-card-value { color: var(--green,#22c55e); }
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
    { label: "Jami foydalanuvchilar", value: total, cls: '' },
    { label: "Bugungi yangilar", value: newToday, cls: 'info' },
    { label: "Kutayotganlar", value: pending, cls: pending > 0 ? 'warn' : 'ok' },
    { label: "Bloklanganlar", value: blocked, cls: blocked > 0 ? 'warn' : '' },
  ];

  section.innerHTML = `
    <div class="dash-grid${loading ? ' dash-card-loading' : ''}">
      ${cards.map(c => `
        <div class="dash-card${c.cls ? ' dash-card--' + c.cls : ''}">
          <div class="dash-card-value">${loading ? '…' : c.value}</div>
          <div class="dash-card-label">${c.label}</div>
        </div>
      `).join('')}
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
    } catch (_) {}
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
