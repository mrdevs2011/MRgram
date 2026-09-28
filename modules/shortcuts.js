/**
 * Klaviatura shortcutlari (DIET F1: 91 → ~25 qator).
 * Faqat Eng keraklisi: Esc — eng ustki ochiq oyna/modalni yopadi.
 * Telefonda klaviatura yo'q; N// kabi harfli shortcutlar olib tashlandi.
 */
import { $, unlockScroll } from './utils.js';

const isOpen = el => !!el && (el.classList.contains('show') || el.classList.contains('open'));

/* Overlaylar: backdrop bosilganda yopiladi — shu funksiyani chaqirib yetadi */
const OVERLAY_IDS = [
  'confirmOverlay', 'zoomModal', 'grpCreateChoiceOverlay', 'grpAddUserOverlay',
  'grpCreateFormOverlay', 'grpJoinLinkOverlay', 'grpInfoOverlay', 'grpEditOverlay',
  'uploadOverlay', 'cmtModal', 'reelCapSheet', 'profileEditOverlay',
  'settingsOverlay', 'searchOverlay', 'chatThreadModal',
];

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.isComposing) return;
  for (const id of OVERLAY_IDS) {
    const el = $(id);
    if (isOpen(el)) {
      el.click(); // mavjud yopilish handler'ini ishga tushiradi
      if (isOpen(el)) { el.classList.remove('show', 'open'); unlockScroll(); }
      e.preventDefault();
      return;
    }
  }
});
