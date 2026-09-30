/* no-autocomplete.js — brauzerning "yordamchi" takliflari (avval yozilgan matnlar ro'yxati, autofill) MRspace
   ichidagi hech bir maydonda chiqmasin. Barcha input/textarea'ga autocomplete="off" qo'yiladi (dinamik yaratilganlarga ham).
   Istisno: parol/login maydonlari (username, current-password, new-password, one-time-code) — parol menejeri ishlashda qoladi. */
const SKIP_TYPES = new Set(['checkbox', 'radio', 'file', 'hidden', 'button', 'submit', 'reset', 'range', 'color', 'image']);
const KEEP_AC = new Set(['username', 'current-password', 'new-password', 'one-time-code']);

function fix(el) {
  if (el.tagName === 'INPUT') {
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    if (SKIP_TYPES.has(t) || t === 'password') return;
  } else if (el.tagName !== 'TEXTAREA') return;
  const ac = (el.getAttribute('autocomplete') || '').trim().toLowerCase();
  if (KEEP_AC.has(ac)) return;
  if (ac !== 'off') el.setAttribute('autocomplete', 'off');
}
function scan(root) {
  if (root.nodeType !== 1) return;
  if (root.matches?.('input, textarea')) fix(root);
  root.querySelectorAll?.('input, textarea').forEach(fix);
}

scan(document.documentElement);
new MutationObserver(muts => {
  for (const m of muts) m.addedNodes.forEach(scan);
}).observe(document.documentElement, { childList: true, subtree: true });
