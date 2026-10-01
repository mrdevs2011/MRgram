/* ── rt-chat.js — DM xabarlari uchun tezkor yo'l ─────────────────────────
 * Xabar yuborilganda DB'ni (postgres_changes + qayta yuklash) kutmaymiz:
 *   1) WebRTC DataChannel (peer-to-peer, server aylanmaydi) — asosiy yo'l
 *   2) DataChannel hali ulanmagan bo'lsa — Supabase Realtime broadcast (WebSocket)
 * Baza (messages jadvali) baribir haqiqat manbai bo'lib qoladi: bu modul faqat
 * "ko'rsatish"ni tezlashtiradi. Signalizatsiya: `rt-<chatId>` broadcast kanali.
 * Dedup: xabar ID'si klientda yaratiladi va DB'ga ham xuddi shu ID bilan yoziladi.
 */
import { sb, state } from './config.js';

const STUN = [{ urls: 'stun:stun.l.google.com:19302' }];
let _ice = { iceServers: STUN };
let _iceAt = 0;
let _icePromise = null;

/** TURN kredensialini /api/turn dan oladi (call.js bilan bir xil manba); bo'lmasa faqat STUN. */
function ensureIce() {
  if (Date.now() - _iceAt < 6 * 3600e3) return Promise.resolve(_ice);
  if (_icePromise) return _icePromise;
  _icePromise = (async () => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const r = await fetch('/api/turn', { headers: { Authorization: 'Bearer ' + token } });
        if (r.ok) {
          const j = await r.json();
          if (Array.isArray(j.iceServers) && j.iceServers.length) {
            _ice = { iceServers: [...STUN, ...j.iceServers] };
            _iceAt = Date.now();
          }
        }
      }
    } catch (_) { /* STUN bilan davom etamiz */ }
    _icePromise = null;
    return _ice;
  })();
  return _icePromise;
}

const _rid = () => Math.random().toString(36).slice(2, 10);
const MAX_TEXT = 4000;

/**
 * @param {string} chatId
 * @param {string} peerUid
 * @param {{onMsg:(m:{id:string,text:string})=>void, onRead?:(ids:string[])=>void, onRetract?:(id:string)=>void}} h
 * @returns {{send:(id:string,text:string)=>string|null, sendRead:(ids:string[])=>void, retract:(id:string)=>void, isP2P:()=>boolean, close:()=>void}|null}
 */
export function openRt(chatId, peerUid, h = {}) {
  const me = state.me?.uid;
  if (!me || !peerUid || !chatId || typeof RTCPeerConnection === 'undefined') return null;

  const sid = _rid();               // shu sahifa nusxasining sessiya belgisi
  const initiator = me < peerUid;   // ikkala tomon bir xil qoida bilan hal qiladi
  let dead = false, ready = false;
  let pc = null, dc = null, peerSid = null;
  let pendingIce = [];
  let retries = 0, failT = null, retryT = null;

  const ch = sb.channel('rt-' + chatId, { config: { broadcast: { self: false } } });

  const sig = (kind, data) => {
    if (!ready || dead) return;
    ch.send({ type: 'broadcast', event: 'sig', payload: { from: me, sid, kind, data } });
  };

  /* ── kelgan xabarni qayta ishlash (DC ham, broadcast ham shu yerga keladi) ── */
  const handle = (o) => {
    if (!o || o.from !== peerUid) return;
    if (o.t === 'm') {
      if (typeof o.id === 'string' && typeof o.text === 'string' && o.id.length <= 64) {
        h.onMsg?.({ id: o.id, text: o.text.slice(0, MAX_TEXT) });
      }
    } else if (o.t === 'r') {
      if (Array.isArray(o.ids)) h.onRead?.(o.ids.filter(x => typeof x === 'string').slice(0, 100));
    } else if (o.t === 'x') {
      if (typeof o.id === 'string') h.onRetract?.(o.id);
    }
  };

  const sendRaw = (obj) => {
    obj.from = me;
    if (dc && dc.readyState === 'open') {
      try { dc.send(JSON.stringify(obj)); return 'p2p'; } catch (_) { /* zaxiraga o'tamiz */ }
    }
    if (ready && !dead) {
      ch.send({ type: 'broadcast', event: 'rt', payload: obj });
      return 'ws';
    }
    return null;
  };

  const bindDc = (d) => {
    dc = d;
    d.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch (_) {} };
    d.onopen = () => { retries = 0; };
  };

  const teardownPc = () => {
    clearTimeout(failT);
    pendingIce = [];
    try { if (dc) { dc.onmessage = dc.onopen = null; dc.close(); } } catch (_) {}
    try { if (pc) { pc.onicecandidate = pc.onconnectionstatechange = pc.ondatachannel = null; pc.close(); } } catch (_) {}
    dc = null; pc = null;
  };

  const scheduleRetry = () => {
    if (dead || retries >= 5) return;      // 5 urinishdan keyin broadcast zaxirasi yetarli
    retries++;
    clearTimeout(retryT);
    retryT = setTimeout(() => {
      if (dead) return;
      if (initiator) start();
      else { teardownPc(); sig('hello', { force: true }); }
    }, 800 * retries);
  };

  const mkPc = () => {
    const p = new RTCPeerConnection(_ice);
    p.onicecandidate = (e) => { if (e.candidate && p === pc) sig('ice', e.candidate.toJSON()); };
    p.ondatachannel = (e) => { if (p === pc) bindDc(e.channel); };
    p.onconnectionstatechange = () => {
      if (p !== pc || dead) return;
      const s = p.connectionState;
      clearTimeout(failT);
      if (s === 'failed' || s === 'closed') { teardownPc(); scheduleRetry(); }
      else if (s === 'disconnected') {
        failT = setTimeout(() => { if (p === pc && p.connectionState !== 'connected') { teardownPc(); scheduleRetry(); } }, 4000);
      }
    };
    return p;
  };

  /* ── tashabbuskor (uid kichik) tomon: offer yaratadi ── */
  const start = async () => {
    if (dead) return;
    teardownPc();
    await ensureIce();
    if (dead) return;
    const p = pc = mkPc();
    bindDc(p.createDataChannel('chat', { ordered: true }));
    try {
      const offer = await p.createOffer();
      if (p !== pc) return;
      await p.setLocalDescription(offer);
      sig('offer', p.localDescription.toJSON());
    } catch (e) { console.warn('[rt] offer:', e?.message || e); scheduleRetry(); }
  };

  const flushIce = () => {
    const q = pendingIce; pendingIce = [];
    q.forEach(c => pc?.addIceCandidate(c).catch(() => {}));
  };

  const onOffer = async (desc) => {
    teardownPc();                       // sinxron — shundan keyin kelgan ICE navbatga tushadi
    await ensureIce();
    if (dead) return;
    const p = pc = mkPc();
    try {
      await p.setRemoteDescription(desc);
      flushIce();
      const ans = await p.createAnswer();
      if (p !== pc) return;
      await p.setLocalDescription(ans);
      sig('answer', p.localDescription.toJSON());
    } catch (e) { console.warn('[rt] answer:', e?.message || e); scheduleRetry(); }
  };

  ch.on('broadcast', { event: 'sig' }, ({ payload: o }) => {
    if (dead || !o || o.from !== peerUid) return;
    switch (o.kind) {
      case 'hello': {
        const fresh = o.sid !== peerSid;
        peerSid = o.sid;
        if (initiator) { if (fresh || o.data?.force) start(); }
        else if (!o.data?.re) sig('hello', { re: true });
        break;
      }
      case 'offer':
        if (!initiator) { peerSid = o.sid; onOffer(o.data); }
        break;
      case 'answer':
        if (initiator && pc && pc.signalingState === 'have-local-offer') {
          pc.setRemoteDescription(o.data).then(flushIce).catch(() => {});
        }
        break;
      case 'ice':
        if (pc && pc.remoteDescription) pc.addIceCandidate(o.data).catch(() => {});
        else pendingIce.push(o.data);
        break;
    }
  });
  ch.on('broadcast', { event: 'rt' }, ({ payload }) => handle(payload));
  ch.subscribe((st) => {
    if (dead) return;
    ready = st === 'SUBSCRIBED';
    if (ready) sig('hello', {});
  });

  ensureIce();   // TURN'ni oldindan isitib qo'yamiz

  return {
    send: (id, text) => sendRaw({ t: 'm', id, text }),
    sendRead: (ids) => { if (ids?.length) sendRaw({ t: 'r', ids }); },
    retract: (id) => sendRaw({ t: 'x', id }),
    isP2P: () => !!(dc && dc.readyState === 'open'),
    close: () => {
      dead = true;
      clearTimeout(retryT);
      teardownPc();
      try { sb.removeChannel(ch); } catch (_) {}
    },
  };
}
