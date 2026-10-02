/**
 * MRdatabase — Bosh sahifa View Controller
 * Handles feed rendering and home view specific logic
 */

import { state } from '../core/config.js';
import { renderFeed, setupPullToRefresh, setupFeedScrollSensitivity } from '../feed/feed.js';
import { initStories, loadStories } from '../feed/stories.js';

let _homeReady = false;

export function initView() {

  // Pull-to-refresh va scroll sensitivity faqat bir marta o'rnatiladi
  if (!_homeReady) {
    setupPullToRefresh();
    setupFeedScrollSensitivity();
    _homeReady = true;
  }

  // Feed + stories — me hali kelmagan bo'lsa ham keyinroq uriniladi
  const boot = () => {
    if (!state.me) return false;
    state.visibleN = 10;
    initStories();
    renderFeed();
    return true;
  };
  if (!boot()) {
    // Auth kechikishi: 200ms oralatib 15 marta (3s) urinib ko'ramiz
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (boot() || n >= 15) clearInterval(t);
    }, 200);
  }
}

export function destroyView() {
  // Scroll listener'ni o'chirish — boshqa view'da trigger bo'lmasin
  window.onscroll = null;
}
