/* chat-media.js — DM ichida "Media / Musiqa / Fayllar" paneli.
   Chat sarlavhasidagi avatar/nom bosilganda ochiladi: haqiqiy profil emas,
   aynan shu suhbatda yuborilgan video, rasm, musiqa va fayllar. */
import { sb, mapMessage } from './config.js';
import { esc, fmtSz, defAvi } from './utils.js';
import { toast } from './toast.js';

const IMG_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
const VID_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const AUD_EXT = ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'aac', 'flac', 'opus', 'wma'];
const LIMIT = 300;

const ICON_PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const ICON_PAUSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const ICON_FILE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const ICON_DL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

let _el = null;
let _audio = null;
let _tab = 'media';
let _data = { media: [], audio: [], file: [] };
let _token = 0;

function _kind(m) {
  const mime = (m.mediaType || '').toLowerCase();
  const ext = (m.fileName || '').toLowerCase().split('.').pop() || '';
  if (mime.startsWith('audio')) return 'audio';
  if (mime.startsWith('video')) return 'video';
  if (mime.startsWith('image')) return 'image';
  if (AUD_EXT.includes(ext)) return 'audio';
  if (VID_EXT.includes(ext)) return 'video';
  if (IMG_EXT.includes(ext)) return 'image';
  return 'file';
}

const _url = m => (m.mediaUrl || '').replace(/"/g, '&quot;');
const _date = m => {
  try { return new Date(m.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch (_) { return ''; }
};
const _sub = m => [m.fileSize ? fmtSz(m.fileSize) : '', _date(m)].filter(Boolean).join(' · ');

function _ensure() {
  if (_el) return _el;
  _el = document.createElement('div');
  _el.id = 'chatMediaOverlay';
  _el.innerHTML = `
    <div class="cm-hdr">
      <button class="cm-back" id="cmBack" aria-label="Orqaga">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m7-7-7 7 7 7"/></svg>
      </button>
      <div class="cm-avi" id="cmAvi"></div>
      <div class="cm-titles">
        <div class="cm-name" id="cmName"></div>
        <div class="cm-hint">Media, musiqa va fayllar</div>
      </div>
    </div>
    <div class="cm-tabs" id="cmTabs"></div>
    <div class="cm-body" id="cmBody"></div>
    <div class="cm-viewer" id="cmViewer"></div>`;
  document.body.appendChild(_el);

  _el.querySelector('#cmBack').onclick = closeChatMedia;
  _el.querySelector('#cmTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    _tab = b.dataset.tab;
    _render();
  });
  _el.querySelector('#cmBody').addEventListener('click', e => {
    const cell = e.target.closest('[data-open]');
    if (cell) return _openViewer(+cell.dataset.open);
    const row = e.target.closest('[data-audio]');
    if (row) return _toggleAudio(+row.dataset.audio);
  });
  _el.querySelector('#cmViewer').addEventListener('click', e => {
    if (e.target.closest('video, img')) return;
    _closeViewer();
  });
  document.addEventListener('chatmedia:close', closeChatMedia);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !_el.classList.contains('show')) return;
    if (_el.querySelector('#cmViewer').classList.contains('show')) _closeViewer();
    else closeChatMedia();
  });
  return _el;
}

function _render() {
  const tabs = [
    ['media', 'Media', _data.media.length],
    ['audio', 'Musiqa', _data.audio.length],
    ['file', 'Fayllar', _data.file.length],
  ];
  _el.querySelector('#cmTabs').innerHTML = tabs.map(([k, label, n]) =>
    `<button class="cm-tab${_tab === k ? ' on' : ''}" data-tab="${k}">${label}${n ? `<span class="cm-cnt">${n}</span>` : ''}</button>`).join('');

  const body = _el.querySelector('#cmBody');
  const list = _data[_tab];
  if (!list.length) {
    const txt = { media: 'Hali video yoki rasm yuborilmagan', audio: 'Hali musiqa yuborilmagan', file: 'Hali fayl yuborilmagan' }[_tab];
    body.innerHTML = `<div class="cm-empty">${txt}</div>`;
    return;
  }
  if (_tab === 'media') {
    body.innerHTML = `<div class="cm-grid">${list.map((m, i) => m.kind === 'video'
      ? `<button class="cm-cell" data-open="${i}"><video src="${_url(m)}#t=0.1" preload="metadata" muted playsinline></video><span class="cm-vbadge">${ICON_PLAY}</span></button>`
      : `<button class="cm-cell" data-open="${i}"><img src="${_url(m)}" loading="lazy" alt=""></button>`).join('')}</div>`;
  } else if (_tab === 'audio') {
    body.innerHTML = list.map((m, i) => `
      <div class="cm-row" data-audio="${i}">
        <div class="cm-ico cm-aplay">${ICON_PLAY}</div>
        <div class="cm-info"><div class="cm-fn">${esc(m.fileName || 'Audio')}</div><div class="cm-sub">${esc(_sub(m))}</div></div>
      </div>`).join('');
    _syncAudioUI();
  } else {
    body.innerHTML = list.map(m => `
      <a class="cm-row" href="${_url(m)}" target="_blank" rel="noopener" download="${esc(m.fileName || 'file')}">
        <div class="cm-ico">${ICON_FILE}</div>
        <div class="cm-info"><div class="cm-fn">${esc(m.fileName || 'Fayl')}</div><div class="cm-sub">${esc(_sub(m))}</div></div>
        <div class="cm-dl">${ICON_DL}</div>
      </a>`).join('');
  }
}

/* ── Musiqa ─────────────────────────────────────────────────────────── */
function _syncAudioUI() {
  if (!_el) return;
  _el.querySelectorAll('[data-audio]').forEach(r => {
    const on = !!_audio && !_audio.paused && +r.dataset.audio === _audio._i;
    r.classList.toggle('playing', on);
    r.querySelector('.cm-aplay').innerHTML = on ? ICON_PAUSE : ICON_PLAY;
  });
}
function _stopAudio() {
  if (!_audio) return;
  try { _audio.pause(); } catch (_) {}
  _audio = null;
  _syncAudioUI();
}
function _toggleAudio(i) {
  const m = _data.audio[i];
  if (!m) return;
  if (_audio && _audio._i === i) {
    _audio.paused ? _audio.play().catch(() => {}) : _audio.pause();
    return;
  }
  _stopAudio();
  const a = new Audio(m.mediaUrl);
  a._i = i;
  a.onplay = a.onpause = _syncAudioUI;
  a.onended = () => { if (_audio === a) _audio = null; _syncAudioUI(); };
  a.onerror = () => { toast('Musiqa ijro etilmadi', 'error'); if (_audio === a) _audio = null; _syncAudioUI(); };
  _audio = a;
  a.play().catch(() => {});
}

/* ── Rasm/video ko'rish ─────────────────────────────────────────────── */
function _openViewer(i) {
  const m = _data.media[i];
  if (!m) return;
  const v = _el.querySelector('#cmViewer');
  v.innerHTML = m.kind === 'video'
    ? `<video src="${_url(m)}" controls autoplay playsinline></video>`
    : `<img src="${_url(m)}" alt="">`;
  v.classList.add('show');
}
function _closeViewer() {
  const v = _el.querySelector('#cmViewer');
  v.querySelector('video')?.pause();
  v.classList.remove('show');
  v.innerHTML = '';
}

/* ── Ochish / yopish ────────────────────────────────────────────────── */
export async function openChatMedia({ chatId, name, avatar } = {}) {
  if (!chatId) return;
  _ensure();
  const my = ++_token;
  _tab = 'media';
  _data = { media: [], audio: [], file: [] };
  _stopAudio();
  _el.querySelector('#cmName').textContent = name || 'Suhbat';
  _el.querySelector('#cmAvi').innerHTML = `<img src="${(avatar || defAvi(name || 'U')).replace(/"/g, '&quot;')}" alt="">`;
  _el.querySelector('#cmTabs').innerHTML = '';
  _el.querySelector('#cmBody').innerHTML = '<div class="spin-wrap pt-60px"><div class="spinner"></div></div>';
  _el.classList.add('show');

  const { data, error } = await sb.from('messages').select('*')
    .eq('chat_id', chatId).eq('type', 'file')
    .order('created_at', { ascending: false }).limit(LIMIT);
  if (my !== _token) return;
  if (error) {
    console.warn('[ChatMedia]', error.message);
    _el.querySelector('#cmBody').innerHTML = '<div class="cm-empty">Yuklanmadi</div>';
    return;
  }
  for (const r of (data || [])) {
    const m = mapMessage(r);
    if (!m || !m.mediaUrl) continue;
    m.kind = _kind(m);
    if (m.kind === 'video' || m.kind === 'image') _data.media.push(m);
    else if (m.kind === 'audio') _data.audio.push(m);
    else _data.file.push(m);
  }
  if (!_data.media.length) _tab = _data.audio.length ? 'audio' : (_data.file.length ? 'file' : 'media');
  _render();
}

export function closeChatMedia() {
  if (!_el) return;
  _token++;
  _stopAudio();
  _closeViewer();
  _el.classList.remove('show');
}
