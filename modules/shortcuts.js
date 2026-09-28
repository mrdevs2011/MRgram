/**
 * Klaviatura shortcutlari.
 *  Esc            — eng ustki ochiq oyna/modalni yopadi
 *  Enter          — composer'da postni yuboradi (Shift+Enter = yangi qator,
 *                   faqat sichqonchali qurilmada; telefonda Enter = yangi qator)
 *  Ctrl/Cmd+Enter — composer'da har doim yuboradi
 *  Enter          — izoh inputida izohni yuboradi
 *  N              — yangi post (composer)
 *  /              — qidiruv
 */
import { $, unlockScroll } from './utils.js';
import { state } from './config.js';
import { closeChatThread } from './chat.js';

const isOpen = el => !!el && (el.classList.contains('show') || el.classList.contains('open'));

/* Backdrop bosilganda yopiladigan overlaylar uchun */
const backdrop = id => () => {
  const el = $(id);
  if (!el) return;
  el.click();
  if (isOpen(el)) { el.classList.remove('show', 'open'); unlockScroll(); }
};

/* Yuqoridan pastga: birinchi ochiq topilgani yopiladi */
const CLOSERS = [
  ['confirmOverlay',         () => $('confirmCancelBtn')?.click()],
  ['zoomModal',              () => $('zoomClose')?.click()],
  ['grpAddUserOverlay',      backdrop('grpAddUserOverlay')],
  ['grpCreateFormOverlay',   backdrop('grpCreateFormOverlay')],
  ['grpInfoOverlay',         backdrop('grpInfoOverlay')],
  ['grpEditOverlay',         backdrop('grpEditOverlay')],
  ['uploadOverlay',          () => $('cancelUpload')?.click()],
  ['cmtModal',               () => $('cmtModalClose')?.click()],
  ['reelCapSheet',           backdrop('reelCapSheet')],
  ['profileEditOverlay',     backdrop('profileEditOverlay')],
  ['settingsOverlay',        backdrop('settingsOverlay')],
  ['searchOverlay',          () => $('searchOverlayClose')?.click()],
  ['chatThreadModal',        () => closeChatThread()],
];

function closeTopmost() {
  for (const [id, close] of CLOSERS) {
    if (isOpen($(id))) { close(); return true; }
  }
  return false;
}

const anyOpen = () => CLOSERS.some(([id]) => isOpen($(id)));
const isTyping = t => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
const hasMouse = () => window.matchMedia?.('(pointer: fine)').matches ?? true;

/* ── Esc + bir harfli shortcutlar ────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.isComposing) return;

  if (e.key === 'Escape') {
    if (closeTopmost()) e.preventDefault();
    return;
  }

  if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
  if (!state.me?.uid || anyOpen()) return;

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    ($('createBtn') || $('hdrNewPostBtn'))?.click();
  } else if (e.key === '/') {
    e.preventDefault();
    $('hdrSearchBtn')?.click();
  }
});

/* ── Composer: Enter = Post ──────────────────────────────────────────── */
$('captionInput')?.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing) return;
  const force = e.ctrlKey || e.metaKey;
  if (!force && (e.shiftKey || !hasMouse())) return; // yangi qator
  e.preventDefault();
  const btn = $('uploadBtn');
  if (btn && !btn.disabled) btn.click();
});

/* ── Izoh: Enter = yuborish ──────────────────────────────────────────── */
$('cmtModalInput')?.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  $('cmtModalSend')?.click();
});
