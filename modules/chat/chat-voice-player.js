/**
 * chat-voice-player.js — waveform hydrate, playback, mini-player
 * Ehtiyotkor ajratish: paintMessages/closeChatThread chat.js da qoladi.
 */
import { state } from '../core/config.js';
import { $ } from '../core/utils.js';

let _openChatCb = null;

/* ── Voice waveform bars ──────────────────────────────────────────────
 * Boshlanishida — tekis (flat) past bar'lar (real ma'lumot hali yo'q).
 * Audio fayl fonda decode qilingach, har bir bar shu segmentdagi
 * HAQIQIY ovoz amplitudasiga (RMS) qarab balandligini oladi —
 * `_hydrateVoiceWaveforms()` orqali. Shu tufayli baland ovoz — baland
 * bar, past/jim joy — past bar bo'ladi (sun'iy sinus emas). */
const CVM_MIN_BARS  = 50;  // eng qisqa xabar uchun bar soni
const CVM_MAX_BARS  = 80;  // eng uzun xabar uchun bar soni
const CVM_BAR_COUNT = CVM_MIN_BARS; // fallback (davomiylik noma'lum bo'lganda)
const CVM_MIN_H = 3;   // tekis bazaviy balandlik (px)
const CVM_MAX_H = 24;  // eng baland pik (px) — ingichka, zich barlar bilan muvozanatli

/* Telegram — bar sonini xabar davomiyligiga qarab dinamik hisoblaydi:
 * qisqa ovozli xabar ~50 ta ingichka bar, uzunrog'i (≈20s+) esa ~80
 * tagacha bar bilan chiziladi — natijada wave zich va aniq ko'rinadi. */
function _voiceBarCount(duration) {
  const d = Number(duration) || 0;
  if (d <= 0) return CVM_MIN_BARS;
  const count = Math.round(d * 4); // ≈4 bar/soniya
  return Math.max(CVM_MIN_BARS, Math.min(CVM_MAX_BARS, count));
}

/* Allaqachon decode qilingan waveform ma'lumotlari (sinxron o'qiladi).
 * Repaint bo'lganda barlar darhol to'g'ri balandlikda chiziladi — "tekis → qayta
 * to'lqin" miltillashi yo'q. Kalit: URL (query'siz) + bar soni. */
const _waveResolved = new Map();
const _wfKey = (url, count) => `${String(url || '').split('?')[0]}::${count}`;

/* O'z yuborgan ovozimizning local blob URL'i (id -> blob:). Server xabari kelganda
 * ham shu URL ishlatiladi — tarmoqdan qayta yuklanmaydi, waveform o'zgarmaydi. */
const _localVoiceUrls = new Map();
function registerLocalVoiceUrl(id, url) { if (id && url) _localVoiceUrls.set(String(id), url); }
function getLocalVoiceUrl(id) { return id ? (_localVoiceUrls.get(String(id)) || '') : ''; }

function renderVoiceWave(seed = 0, count = CVM_BAR_COUNT, url = '') {
  const data = url ? _waveResolved.get(_wfKey(url, count)) : null;
  let bars = '';
  for (let i = 0; i < count; i++) {
    const h = data ? CVM_MIN_H + (data[i] ?? 0) * (CVM_MAX_H - CVM_MIN_H) : CVM_MIN_H;
    bars += `<span class="cvm-bar" style="height:${h.toFixed(1)}px"></span>`;
  }
  return bars;
}

function _applyWave(waveEl, data) {
  const bars = waveEl.querySelectorAll('.cvm-bar');
  bars.forEach((b, i) => {
    const v = data[i] ?? 0;
    b.style.height = `${(CVM_MIN_H + v * (CVM_MAX_H - CVM_MIN_H)).toFixed(1)}px`;
  });
  waveEl.dataset.hydrated = '1';
}

/* url → Promise<number[] | null> (har bir qiymat 0..1, normalizatsiya
 * qilingan RMS amplituda). Bir xil xabar ikki marta decode qilinmasin
 * deb keshlaymiz. */
const _waveformCache = new Map();

function _getWaveformData(url, count = CVM_BAR_COUNT) {
  if (!url) return Promise.resolve(null);
  const cacheKey = _wfKey(url, count);
  if (_waveformCache.has(cacheKey)) return _waveformCache.get(cacheKey);

  const promise = (async () => {
    try {
      // cache: 'no-store' — brauzer HTTP keshida (yoki avval boshqa joyda
      // <audio> orqali Range so'rov bilan olingan qisman/206 javobda)
      // qolib ketgan noto'liq baytlarni QAYTA ISHLATMASLIK uchun. Har
      // safar to'liq, yangi oqim so'raladi — shu orqali "Unable to
      // decode audio data" xatosining eng keng tarqalgan sababi
      // (keshdagi buzuq/qisman fayl) bartaraf etiladi.
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrBuf = await res.arrayBuffer();
      if (!arrBuf || arrBuf.byteLength === 0) throw new Error('Bo\'sh audio bufer');
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const audioBuf = await ctx.decodeAudioData(arrBuf.slice(0));
      const raw = audioBuf.getChannelData(0); // 1-kanal yetarli
      const blockSize = Math.max(1, Math.floor(raw.length / count));
      const peaks = [];
      for (let i = 0; i < count; i++) {
        const start = i * blockSize;
        const end = Math.min(raw.length, start + blockSize);
        let sumSq = 0, n = 0;
        for (let j = start; j < end; j++) { sumSq += raw[j] * raw[j]; n++; }
        // RMS — segmentning haqiqiy energiya/chastota darajasi
        peaks.push(n ? Math.sqrt(sumSq / n) : 0);
      }
      try { ctx.close(); } catch (_) {}
      const max = Math.max(...peaks, 0.0001);
      const norm = peaks.map(v => Math.min(1, v / max));
      _waveResolved.set(cacheKey, norm);
      return norm;
    } catch (e) {
      // e?.message || e — Error obyektining o'z xususiyatlari (message,
      // stack) enumerable emas, shuning uchun ba'zi konsollarda to'g'ridan
      // to'g'ri Error obyektini chop etsak "Error {}" (bo'sh) ko'rinadi va
      // haqiqiy sabab (masalan "Failed to fetch" — odatda CORS yoki
      // noto'g'ri/eskirgan Supabase Storage URL) yashirinib qoladi.
      console.warn('Waveform ajratib olishda xato:', e?.message || e?.name || e, '| url:', url);
      // MUHIM (flat-forever fix): agar shu (muvaffaqiyatsiz) natijani
      // keshda saqlab qo'ysak, chat ro'yxati Firestore yangilanishi bilan
      // qayta chizilganda (bu tez-tez sodir bo'ladi) HAR SAFAR shu keshdagi
      // "null"ni qaytarib, xabar ABADIY tekis (flat) ko'rinib qolardi —
      // hatto vaqtinchalik tarmoq xatosi tuzalgan bo'lsa ham. Xato holatini
      // keshdan o'chiramiz — shunda keyingi qayta chizilishda (re-render)
      // qaytadan haqiqiy urinish (retry) qilinadi.
      _waveformCache.delete(cacheKey);
      return null; // xato bo'lsa — tekis holat saqlanib qoladi
    }
  })();

  _waveformCache.set(cacheKey, promise);
  return promise;
}

/* Bir vaqtning o'zida ko'p ovozli xabar fon fonida dekod qilinsa,
 * server/tarmoqqa haddan tashqari ko'p parallel so'rov ketib, hatto
 * <audio> elementining o'zi ham yuklanishida muammo tug'dirishi mumkin
 * (masalan "no supported source" xatosi). Shu sabab — navbat orqali
 * bir vaqtda faqat 2 tasi dekod qilinadi, qolganlari navbatda kutadi. */
const CVM_MAX_CONCURRENT = 2;
let _cvmActiveDecodes = 0;
const _cvmQueue = [];

function _cvmRunQueue() {
  while (_cvmActiveDecodes < CVM_MAX_CONCURRENT && _cvmQueue.length) {
    const job = _cvmQueue.shift();
    _cvmActiveDecodes++;
    job().finally(() => {
      _cvmActiveDecodes--;
      _cvmRunQueue();
    });
  }
}

function _cvmEnqueue(job) {
  _cvmQueue.push(job);
  _cvmRunQueue();
}

/* Faqat foydalanuvchi haqiqatan ko'rayotgan (viewportga yaqin) ovozli
 * xabarlar uchun waveform yuklaymiz — chat ochilishi bilanoq o'nlab
 * xabarning to'liq audio faylini fon fonida yuklab yubormaymiz. */
let _cvmObserver = null;
function _cvmGetObserver() {
  if (_cvmObserver) return _cvmObserver;
  _cvmObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const waveEl = entry.target;
      _cvmObserver.unobserve(waveEl);
      _cvmStartHydrate(waveEl);
    });
  }, { root: null, rootMargin: '200px', threshold: 0.01 });
  return _cvmObserver;
}

function _cvmStartHydrate(waveEl) {
  const wrap = waveEl.closest('.chat-voice-msg');
  const url = wrap?.dataset.url;
  // Bar soni renderVoiceWave() chizganidagi son bilan bir xil bo'lishi kerak
  // (aks holda haqiqiy amplituda qiymatlari bar'lar bilan mos kelmay qoladi).
  const count = parseInt(wrap?.dataset.barCount, 10) || CVM_BAR_COUNT;
  if (!url || waveEl.dataset.hydrated === '1' || waveEl.dataset.hydrated === 'pending') return;
  const known = _waveResolved.get(_wfKey(url, count));
  if (known) { waveEl.dataset.hydrated = "1"; return; }
  waveEl.dataset.hydrated = 'pending';
  _cvmEnqueue(() => _getWaveformData(url, count).then(data => {
    if (!waveEl.isConnected) return;
    if (!data) { waveEl.dataset.hydrated = ''; return; }
    waveEl.dataset.hydrated = '1';
    const bars = waveEl.querySelectorAll('.cvm-bar');
    bars.forEach((b, i) => {
      const v = data[i] ?? 0;
      const h = CVM_MIN_H + v * (CVM_MAX_H - CVM_MIN_H);
      b.style.height = `${h.toFixed(1)}px`;
    });
  }));
}

/* Berilgan konteyner ichidagi hali "hydrate" qilinmagan barcha voice
 * xabarlarni kuzatuvga (IntersectionObserver) qo'shadi — har biri
 * faqat ekranga yaqinlashganda navbat orqali dekod qilinadi. */
function _hydrateVoiceWaveforms(container) {
  if (!container) return;
  const observer = _cvmGetObserver();
  const wraps = container.querySelectorAll('.chat-voice-msg[data-url]');
  wraps.forEach(wrap => {
    const waveEl = wrap.querySelector('.cvm-waveform');
    if (!waveEl || waveEl.dataset.hydrated === '1' || waveEl.dataset.hydrated === 'pending') return;
    const cnt = parseInt(wrap.dataset.barCount, 10) || CVM_BAR_COUNT;
    const known = _waveResolved.get(_wfKey(wrap.dataset.url, cnt));
    if (known) { waveEl.dataset.hydrated = "1"; return; }   // sinxron — miltillamaydi
    observer.observe(waveEl);
  });
}

/* ── Xabar pufakchalari uchun "bounce" (pop-in) animatsiyasi qaysi
 * xabarlarga tegishli ekanini ANIQ, ID asosida kuzatamiz.
 *
 * ESKI USUL MUAMMOSI: oldin `idx >= prevCount` (ya'ni "avvalgi chizishda
 * nechta .chat-msg bor edi") solishtirilardi. Lekin "...yozmoqda"
 * pufakchasi HAM `.chat-msg` klassiga ega va u paintMessages()
 * dan TASHQARIDA, to'g'ridan-to'g'ri box.appendChild() bilan qo'shiladi/
 * o'chiriladi. Natijada `box.querySelectorAll('.chat-msg').length` real
 * Firestore xabarlar soniga har doim mos kelmasdi (goh ortiq, goh kam) —
 * xabar yuborilganda yoki xabar yangilanganda (bularning har biri messages'ga alohida
 * onSnapshot signalini qo'zg'atadi) `prevCount` noto'g'ri chiqib, ko'p
 * hollarda BARCHA xabarlar "yangi" deb hisoblanib, hammasi bir vaqtda
 * "bounce" bo'lib qolardi.
 *
 * YECHIM: har bir xabarning barqaror Firestore ID'si orqali — "shu ID
 * avval chizilganmi?" — tekshiramiz. Faqat HAQIQIY yangi (hali hech
 * qachon chizilmagan) xabar bounce bo'ladi; status/audioUrl kabi
 * maydonlar yangilanib qayta chizilganda eski xabarlar tegilmaydi. */
let _seenMsgIds = new Set();
let _seenMsgIdsChatId = null;
// Telegram uslubidagi "yangi xabar keldi" animatsiyasi:
// chat ilk ochilganda (baseline) animatsiya YO'Q — faqat chatda o'tirganda kelgan xabarga.
let _seenBaselineDone = false;
const _msgAnimStart = new Map();      // msgId -> animatsiya boshlangan vaqt (repaint bo'lsa ham davom etishi uchun)
const MSG_ANIM_MS = 360;
// O'chirilgan xabar "qum bo'lib sochilib ketishi" (MRdrive animatsiyasi) — jarayondagilar repaint'dan omon qoladi
const _dissolving = new Map();   // msgId -> { id, el, nextId }


function fmtVoiceDur(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}


/* ── Voice player ────────────────────────────────────────────────────
 * Progress requestAnimationFrame bilan chiziladi (timeupdate ~4Hz edi — qotib
 * ko'rinardi). MediaRecorder webm'larida audio.duration = Infinity bo'ladi, shuning
 * uchun davomiylik dataset'dagi (yozilgan) qiymatdan olinadi. Repaint bo'lsa, faol
 * tugma/waveform yangi DOM'ga qayta bog'lanadi. */
let _activeAudio    = null;
let _activeBtn      = null;
let _activeUrl      = '';
let _activeTotal    = 0;
let _activeChatId   = null;
let _activeChatUid  = null;
let _activeName     = '';
let _activeLoading  = false;
let _activeBars     = null;
let _activeBarsWrap = null;
let _lastFilled     = -1;
let _progRaf        = null;

function _setBtnState() {
  if (!_activeBtn) return;
  if (_activeLoading) {
    _activeBtn.innerHTML = LOADING_ICON;
    _activeBtn.classList.add('cvm-play--loading');
  } else {
    _activeBtn.classList.remove('cvm-play--loading');
    _activeBtn.innerHTML = (_activeAudio && !_activeAudio.paused) ? PAUSE_ICON : PLAY_ICON;
  }
}

function _curDur() {
  const d = _activeAudio ? _activeAudio.duration : 0;
  return (isFinite(d) && d > 0) ? d : (_activeTotal || 0);
}

function _paintProgress(force) {
  if (!_activeAudio || !_activeBtn) return;
  const wrap = _activeBtn.closest('.chat-voice-msg');
  if (!wrap) return;
  if (_activeBarsWrap !== wrap) {
    _activeBarsWrap = wrap;
    _activeBars = wrap.querySelectorAll('.cvm-bar');
    _lastFilled = -1;
    force = true;
  }
  const dur = _curDur() || 1;
  const cur = _activeAudio.currentTime || 0;
  const pct = Math.max(0, Math.min(1, cur / dur));
  const n = _activeBars.length;
  const filled = Math.floor(pct * n);
  if (force || filled !== _lastFilled) {
    const from = force ? 0 : Math.min(filled, _lastFilled);
    const to   = force ? n : Math.max(filled, _lastFilled);
    for (let i = from; i < to; i++) _activeBars[i].classList.toggle('played', i < filled);
    _lastFilled = filled;
  }
  const durEl = wrap.querySelector('.cvm-dur');
  if (durEl) { const t = fmtVoiceDur(cur); if (durEl.dataset.cur !== t) { durEl.textContent = t; durEl.dataset.cur = t; } }
  _updateMiniPlayerProgress(pct);
}

function _startProgressLoop() {
  if (_progRaf) return;
  const frame = () => {
    _progRaf = null;
    if (!_activeAudio) return;
    _paintProgress(false);
    if (!_activeAudio.paused && !_activeAudio.ended) _progRaf = requestAnimationFrame(frame);
  };
  _progRaf = requestAnimationFrame(frame);
}

function _resetActiveVisual() {
  if (_activeBtn) {
    _activeBtn.classList.remove('cvm-play--loading');
    _activeBtn.innerHTML = PLAY_ICON;
    const wrap = _activeBtn.closest('.chat-voice-msg');
    if (wrap) {
      wrap.querySelectorAll('.cvm-bar.played').forEach(b => b.classList.remove('played'));
      wrap.querySelector('.cvm-waveform')?.classList.remove('playing');
      const durEl = wrap.querySelector('.cvm-dur');
      if (durEl) durEl.textContent = fmtVoiceDur(_activeTotal || 0);
    }
  }
  _activeBars = null; _activeBarsWrap = null; _lastFilled = -1;
}

function _stopActive() {
  if (_activeAudio) {
    const a = _activeAudio;
    a.onwaiting = a.onplaying = a.onpause = a.onended = a.onerror = null;
    try { a.pause(); } catch (_) {}
  }
  _resetActiveVisual();
  _activeAudio = null; _activeBtn = null; _activeUrl = ''; _activeLoading = false;
}

function _reattachActiveVoiceUI(box) {
  if (!_activeAudio || !_activeBtn) return;
  if (box.contains(_activeBtn)) return;
  const key = String(_activeUrl || '').split('?')[0];
  if (!key) return;
  const newWrap = Array.from(box.querySelectorAll('.chat-voice-msg'))
    .find(w => String(w.dataset.url || '').split('?')[0] === key);
  if (!newWrap) return;
  const newBtn = newWrap.querySelector('.cvm-play');
  if (!newBtn) return;
  _activeBtn = newBtn;
  _activeBarsWrap = null;
  _setBtnState();
  newWrap.querySelector('.cvm-waveform')?.classList.toggle('playing', !_activeAudio.paused);
  _paintProgress(true);
  if (!_activeAudio.paused) _startProgressLoop();
}

window._chatPlayVoice = function(btn) {
  const wrap = btn.closest('.chat-voice-msg');
  const url  = wrap?.dataset?.url;
  if (!url) {
    console.warn('Voice: URL topilmadi', wrap?.dataset);
    toast('Audio URL topilmadi', 'error');
    return;
  }

  // Bir xil xabar — pause/resume
  if (_activeAudio && _activeBtn === btn) {
    if (_activeAudio.paused) {
      _activeAudio.play().catch(e => { if (e?.name === 'AbortError') return; console.error('Resume xatosi:', e); toast('Ijro etilmadi', 'error'); });
      _startProgressLoop();
    } else {
      _activeAudio.pause();
    }
    _setBtnState();
    _syncMiniPlayer();
    return;
  }

  // Boshqa xabar o'ynayotgan bo'lsa — to'liq to'xtatib, vizualini tozalaymiz
  if (_activeAudio) _stopActive();

  _activeBtn     = btn;
  _activeUrl     = url;
  _activeTotal   = parseFloat(wrap.dataset.dur || '0') || 0;
  _activeChatId  = wrap.dataset.chatId || state.currentChatId || null;
  _activeChatUid = wrap.dataset.chatUid || state.currentChatUid || null;
  _activeName    = wrap.dataset.name || 'Ovozli xabar';

  const audio = new Audio();
  audio.preload = 'auto';
  _activeAudio = audio;
  _activeLoading = true;          // yuklanish tugaguncha tugma ichida spinner aylanadi
  _setBtnState();
  wrap.querySelector('.cvm-waveform')?.classList.add('playing');

  audio.onwaiting = () => { if (_activeAudio !== audio) return; _activeLoading = true; _setBtnState(); };
  audio.onplaying = () => {
    if (_activeAudio !== audio) return;
    _activeLoading = false; _setBtnState(); _syncMiniPlayer(); _startProgressLoop();
  };
  audio.onpause = () => {
    if (_activeAudio !== audio || audio.ended) return;
    _setBtnState(); _syncMiniPlayer(); _paintProgress(false);
  };
  audio.onended = () => {
    if (_activeAudio !== audio) return;
    _stopActive();
    _syncMiniPlayer();
  };
  audio.onerror = (e) => {
    if (_activeAudio !== audio) return;
    console.error('Audio xatosi:', e, 'URL:', url);
    toast('Audio yuklanmadi', 'error');
    _stopActive();
    _syncMiniPlayer();
  };

  audio.src = url;
  audio.play().catch(e => {
    if (e?.name === 'AbortError') return;   // tez almashtirish — kutilgan holat
    if (_activeAudio !== audio) return;
    console.error('Audio play xatosi:', e, 'URL:', url);
    toast('Audio ijro etilmadi', 'error');
    _stopActive();
    _syncMiniPlayer();
  });

  _syncMiniPlayer();
};

/* ── Voice mini-player — chatdan chiqib ketilsa ham ijro davom etadi ── */
function _isVoiceOwnerChatOpen() {
  const threadOpen = $('chatThreadModal')?.classList.contains('show');
  return !!(threadOpen && state.currentChatId && state.currentChatId === _activeChatId);
}

function _syncMiniPlayer() {
  const bar = $('voiceMiniPlayer');
  if (!bar) return;
  const shouldShow = !!_activeAudio && !_isVoiceOwnerChatOpen();
  if (!shouldShow) { bar.classList.remove('show'); return; }

  bar.classList.add('show');
  const titleEl = $('vmpTitle');
  if (titleEl) titleEl.textContent = _activeName || 'Ovozli xabar';
  const playBtn = $('vmpPlay');
  if (playBtn) playBtn.innerHTML = (_activeAudio && !_activeAudio.paused) ? PAUSE_ICON : PLAY_ICON;
}

function _updateMiniPlayerProgress(pct) {
  const fill = $('vmpFill');
  if (fill) fill.style.width = `${Math.max(0, Math.min(1, pct)) * 100}%`;
}

$('vmpPlay')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!_activeAudio) return;
  if (_activeAudio.paused) { _activeAudio.play().catch(() => {}); _startProgressLoop(); }
  else _activeAudio.pause();
  _setBtnState();
  _syncMiniPlayer();
});

$('vmpClose')?.addEventListener('click', (e) => {
  e.stopPropagation();
  _stopActive();
  _activeChatId  = null;
  _activeChatUid = null;
  _syncMiniPlayer();
});

// Bar bosilganda — ovoz chiqayotgan chatga qaytamiz
$('voiceMiniPlayer')?.addEventListener('click', () => {
  if (_activeChatUid && typeof _openChatCb === 'function') _openChatCb(_activeChatUid);
});

const PLAY_ICON  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const PAUSE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
// Fayl hali yuklanayotganda (buferlanmoqda) ko'rsatiladigan aylanuvchi spinner —
// CSS animatsiyasi uchun .cvm-play--loading klassi (CSS/chat.css) bilan birga ishlaydi.
const LOADING_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="cvm-spin"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="42 14"/></svg>`;


export function initVoicePlayer(opts = {}) {
  _openChatCb = opts.openChat || null;
}

export {
  fmtVoiceDur,
  renderVoiceWave,
  _voiceBarCount as voiceBarCount,
  _hydrateVoiceWaveforms as hydrateVoiceWaveforms,
  _reattachActiveVoiceUI as reattachActiveVoiceUI,
  registerLocalVoiceUrl,
  getLocalVoiceUrl,
};
