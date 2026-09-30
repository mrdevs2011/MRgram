/* emoji-picker.js — telefon klaviaturasi (Gboard) uslubidagi emoji paneli.
   Tepada: qidiruv tugmasi + kategoriya ikonlari (SVG). Pastda: "Oxirgilar" va kategoriyalar
   bo'yicha sahifalar: tablar orasida gorizontal surish, sahifa ichida vertikal skroll. Ma'lumot mahalliy (emoji-data.js), birinchi ochilganda yuklanadi. */

const RECENT_KEY = 'mrspace_emoji_recent';
const RECENT_MAX = 24;

const svg = d => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  recent:     svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>'),
  smileys:    svg('<circle cx="12" cy="12" r="9"/><path d="M8.2 14.2c1 1.3 2.3 2 3.8 2s2.8-.7 3.8-2"/><path d="M9 9.6v.2M15 9.6v.2"/>'),
  people:     svg('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3-6 7-6s7 2.1 7 6"/>'),
  animals:    svg('<circle cx="6.5" cy="11" r="1.8"/><circle cx="10" cy="6.5" r="1.8"/><circle cx="14" cy="6.5" r="1.8"/><circle cx="17.5" cy="11" r="1.8"/><path d="M12 12.5c-3 0-5.5 2.5-5.5 4.8 0 1.6 1.4 2.2 3 2.2 1 0 1.6-.4 2.5-.4s1.5.4 2.5.4c1.6 0 3-.6 3-2.2 0-2.3-2.5-4.8-5.5-4.8z"/>'),
  food:       svg('<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H15.5"/><path d="M8 3.5c-.8 1 .8 1.8 0 2.8M12 3.5c-.8 1 .8 1.8 0 2.8"/>'),
  activities: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3c2.6 3 2.6 15 0 18M3 12c3 2.6 15 2.6 18 0"/>'),
  travel:     svg('<path d="M4 15l1.6-5a2 2 0 0 1 1.9-1.4h9a2 2 0 0 1 1.9 1.4L20 15v3.5h-2.6V17H6.6v1.5H4z"/><path d="M7.5 13.2h.01M16.5 13.2h.01"/>'),
  objects:    svg('<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1.1 1.2 1.1 2.2h5c0-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>'),
  symbols:    svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  flags:      svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  search:     svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  close:      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function loadRecent() {
  try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.slice(0, RECENT_MAX) : []; }
  catch { return []; }
}
function saveRecent(list) { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); } catch {} }

const grid = list => list.map(e => `<button type="button" class="ep-e" data-e="${esc(e)}">${e}</button>`).join('');

export function initEmojiPicker({ btn, pop, input }) {
  if (!btn || !pop || !input) return;
  let built = false, cats = [], recent = loadRecent();
  let tabs, body, searchRow, searchInp, tabRow;

  async function build() {
    if (built) return; built = true;
    pop.innerHTML = '<div class="ep-loading">Yuklanmoqda…</div>';
    try { ({ EMOJI_CATS: cats } = await import('./emoji-data.js')); }
    catch { pop.innerHTML = '<div class="ep-loading">Emoji yuklanmadi</div>'; built = false; return; }

    const tabDefs = [{ id: 'recent' }, ...cats.map(c => ({ id: c.id, name: c.name }))];
    pop.innerHTML = `
      <div class="ep-top">
        <button type="button" class="ep-tab ep-search-btn" data-act="search" title="Qidirish">${ICONS.search}</button>
        <div class="ep-tabs">${tabDefs.map(t => `<button type="button" class="ep-tab" data-tab="${t.id}" title="${esc(t.name || 'Oxirgilar')}">${ICONS[t.id]}</button>`).join('')}</div>
      </div>
      <div class="ep-search" hidden>
        <div class="ep-search-wrap">
          <input type="text" class="ep-search-inp" placeholder="Qidirish (inglizcha: heart, cat...)" autocomplete="off" spellcheck="false">
          <button type="button" class="ep-clear" data-act="closesearch" title="Yopish">${ICONS.close}</button>
        </div>
      </div>
      <div class="ep-body">
        <section data-sec="recent"><h4>Oxirgilar</h4><div class="ep-grid" data-grid="recent"></div></section>
        ${cats.map(c => `<section data-sec="${c.id}"><h4>${esc(c.name)}</h4><div class="ep-grid">${grid(c.list.map(x => x[0]))}</div></section>`).join('')}
        <section data-sec="results" hidden><h4>Natijalar</h4><div class="ep-grid" data-grid="results"></div></section>
      </div>`;
    tabs = [...pop.querySelectorAll('[data-tab]')];
    body = pop.querySelector('.ep-body');
    searchRow = pop.querySelector('.ep-search');
    searchInp = pop.querySelector('.ep-search-inp');
    tabRow = pop.querySelector('.ep-top');
    paintRecent();
    body.addEventListener('scroll', spy, { passive: true });
    searchInp.addEventListener('input', onSearch);
    setActive(recent.length ? 'recent' : cats[0].id);
  }

  function paintRecent() {
    const sec = pop.querySelector('[data-sec="recent"]');
    sec.hidden = !recent.length;
    sec.querySelector('.ep-grid').innerHTML = grid(recent);
    const t = pop.querySelector('[data-tab="recent"]'); if (t) t.hidden = !recent.length;
  }
  function setActive(id) {
    tabs.forEach(t => t.classList.toggle('on', t.dataset.tab === id));
    const t = tabs.find(x => x.dataset.tab === id), row = t && t.parentElement;
    if (row && row.scrollWidth > row.clientWidth) {
      const tr = t.getBoundingClientRect(), rr = row.getBoundingClientRect();
      row.scrollBy({ left: (tr.left - rr.left) - (rr.width - tr.width) / 2, behavior: 'smooth' });
    }
  }
  /* Gorizontal scroll (surish) bo'yicha qaysi sahifa ochiqligini aniqlaydi va tab ikonkasini yangilaydi */
  function spy() {
    if (searchRow && !searchRow.hidden && searchInp.value) return;
    const secs = [...body.querySelectorAll('section[data-sec]:not([hidden]):not([data-sec="results"])')];
    const i = Math.round(body.scrollLeft / (body.clientWidth || 1));
    if (secs[i]) setActive(secs[i].dataset.sec);
  }
  function goTo(id) {
    const s = body.querySelector(`[data-sec="${id}"]`);
    if (s) body.scrollTo({ left: s.offsetLeft, behavior: 'smooth' });
  }
  function onSearch() {
    const q = searchInp.value.trim().toLowerCase();
    const res = pop.querySelector('[data-sec="results"]');
    const others = body.querySelectorAll('section[data-sec]:not([data-sec="results"])');
    if (!q) { res.hidden = true; others.forEach(s => { if (s.dataset.sec !== 'recent') s.hidden = false; }); paintRecent(); body.scrollLeft = 0; return; }
    const words = q.split(/\s+/);
    const hits = [];
    for (const c of cats) for (const [e, kw] of c.list) if (words.every(w => kw.includes(w))) hits.push(e);
    others.forEach(s => { s.hidden = true; });
    res.hidden = false;
    res.querySelector('.ep-grid').innerHTML = hits.length ? grid(hits.slice(0, 200)) : '<div class="ep-empty">Topilmadi</div>';
    body.scrollLeft = 0; res.scrollTop = 0;
  }
  function toggleSearch(on) {
    searchRow.hidden = !on; tabRow.hidden = on;
    if (on) searchInp.focus();
    else { searchInp.value = ''; onSearch(); }
  }
  function insert(emoji) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
    const caret = start + emoji.length;
    input.focus(); input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    recent = [emoji, ...recent.filter(x => x !== emoji)].slice(0, RECENT_MAX);
    saveRecent(recent);
    if (searchRow?.hidden !== false) paintRecent();
  }

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const open = pop.classList.toggle('show');
    if (open) { await build(); recent = loadRecent(); if (built && body) { paintRecent(); } }
  });
  pop.addEventListener('mousedown', e => { if (!e.target.closest('.ep-search-inp')) e.preventDefault(); });
  pop.addEventListener('click', (e) => {
    const em = e.target.closest('.ep-e'); if (em) { insert(em.dataset.e); return; }
    const tab = e.target.closest('[data-tab]'); if (tab) { goTo(tab.dataset.tab); setActive(tab.dataset.tab); return; }
    const act = e.target.closest('[data-act]');
    if (act?.dataset.act === 'search') toggleSearch(true);
    else if (act?.dataset.act === 'closesearch') toggleSearch(false);
  });
  document.addEventListener('click', (e) => {
    if (!pop.classList.contains('show')) return;
    if (btn.contains(e.target) || pop.contains(e.target)) return;
    pop.classList.remove('show');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.classList.remove('show'); });
}
