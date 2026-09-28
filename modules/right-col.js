/**
 * O'ng ustun (≥1260px): qidiruv tugmasi + "Kimlar bor" kartasi.
 * Ma'lumot olinmasa karta yashirin qoladi — boshqa hech narsa buzilmaydi.
 */
import { sb, state, mapProfile } from './config.js';
import { $, esc, defAvi } from './utils.js';

const wide = window.matchMedia('(min-width: 1260px)');
let _done = false;

$('rcSearch')?.addEventListener('click', () => $('sbSearchToggle')?.click());

function render(users) {
  const list = $('rcUsersList');
  const card = $('rcUsers');
  if (!list || !card) return;
  if (!users.length) { card.hidden = true; return; }
  list.innerHTML = users.map(u => {
    const name = u.fullName || u.username || 'Foydalanuvchi';
    const av = u.avatar || defAvi(name);
    return `<button type="button" class="rc-row" data-uid="${esc(u.uid)}">
      <span class="rc-avi"><img src="${esc(av)}" alt="" onerror="this.style.display='none'"></span>
      <span class="rc-meta"><span class="rc-name">${esc(name)}</span>${u.username ? `<span class="rc-user">@${esc(u.username)}</span>` : ''}</span>
    </button>`;
  }).join('');
  card.hidden = false;
}

list_click();
function list_click() {
  $('rcUsersList')?.addEventListener('click', e => {
    const row = e.target.closest('.rc-row');
    if (!row) return;
    import('./profile.js').then(m => m.openUserProfileModal?.(row.dataset.uid)).catch(() => {});
  });
}

async function load() {
  const me = state.me;
  if (_done || !me?.uid || !wide.matches) return;
  _done = true;
  try {
    const { data, error } = await sb.from('profiles').select('*')
      .eq('approval', 'approved').order('created_at', { ascending: false }).limit(8);
    if (error) throw error;
    render((data || []).map(mapProfile).filter(u => u.uid !== me.uid && !u.blocked).slice(0, 5));
  } catch (err) {
    console.warn('[RightCol]', err.message);
  }
}

const t = setInterval(() => { load(); if (_done) clearInterval(t); }, 1200);
wide.addEventListener?.('change', () => { if (wide.matches && !_done) load(); });
