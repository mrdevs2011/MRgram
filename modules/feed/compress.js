/* ═══════════════════════════════════════════════════════════════════════
   MEDIA SIQISH (DIET F7.2) — Supabase Free 1 GB storage kvotasi uchun
   Rasm: canvas orqali ~1600px gacha kichraytirish + JPEG/PNG qayta siqish.
   Shaffof (transparent) rasmlar — PNG sifatida saqlanadi, fon qo'shilmaydi.
   Video: brauzerda haqiqiy transkod yo'q — faqat hajm limiti (MAX_FILE).
   Xato bo'lsa originalni qaytaradi (hech qachon yuklashni buzmaydi).
   ═══════════════════════════════════════════════════════════════════════ */

const IMG_MAX_DIM = 1600;   // eng uzun tomoni
const IMG_QUALITY = 0.8;    // JPEG sifati
const IMG_MIN_SAVE = 0.85;  // siqish 15% dan kam tejasa — original qoladi

/** Canvasda alpha kanali bor-yo'qligini tekshiradi (shaffof piksel bormi). */
function _hasTransparency(ctx, w, h) {
  try {
    // Katta rasmlarda hammasini o'qimaslik uchun sampling
    const step = Math.max(1, Math.floor(Math.min(w, h) / 64));
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] < 255) return true;
      }
    }
    return false;
  } catch (_) {
    return false; // getImageData ishlamasa — shaffof deb hisoblamaymiz
  }
}

/** Rasm faylni siqib qaytaradi. Siqish kerakmas/mumkin bo'lmasa — original. */
export async function compressImage(file) {
  try {
    if (!file || !file.type.startsWith('image/')) return file;
    // GIF (animatsiya) va SVG ni tegma
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, IMG_MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: true });

    // Avval hech qanday fon to'ldirmasdan chizamiz — shaffoflikni saqlash uchun
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close && bitmap.close();

    const transparent = _hasTransparency(ctx, w, h);

    let blob, mime, ext;
    if (transparent) {
      // Shaffof rasm — PNG (fon qo'shilmaydi)
      blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      mime = 'image/png';
      ext = '.png';
    } else {
      // Oddiy rasm — JPEG (kichikroq)
      blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', IMG_QUALITY));
      mime = 'image/jpeg';
      ext = '.jpg';
    }

    if (!blob) return file;
    // Siqish foydasiz bo'lsa (kichik/kam presslangan rasm) — originalni qaytar
    if (blob.size >= file.size * IMG_MIN_SAVE) return file;

    const name = (file.name || 'photo').replace(/\.[^.]*$/, '') + ext;
    return new File([blob], name, { type: mime, lastModified: Date.now() });
  } catch (e) {
    console.warn('[compress] rasm siqilmadi, original ishlatiladi:', e?.message || e);
    return file;
  }
}
/* ═══════════════════════════════════════════════════════════════════════
   VIDEO SIQISH — "hisoblagich": soniyasiga necha bayt tushayotganini o'lchaydi.
   Zamonaviy telefon (masalan S21, 4K/60fps/HDR) 6 soniyada ~38 MB beradi
   (~50 Mbit/s) — bunday video ko'rishga hojat yo'q darajada og'ir.
   Qoida:
     1) bit/soniya = fayl_hajmi*8 / davomiylik. VID_TRIGGER_BPS dan oshmasa yoki
        fayl kichik bo'lsa — TEGILMAYDI (WhatsApp/Telegram videolari shunday qoladi).
     2) Oshsa — brauzerda qayta kodlanadi: eng uzun tomoni ≤1280 (yoki 960),
        nishon bitreyt = min(2.5 Mbit/s, limitga sig'adigan bitreyt, asl*0.8).
     3) Natija maxBytes dan oshsa yoki siqish foyda bermasa — original/xato.
   Usul: <video> → <canvas>.captureStream + MediaRecorder (haqiqiy vaqtda, ya'ni
   10 soniyalik video ~10 soniya siqiladi). Sahifani yopmang/boshqa tabga o'tmang.
   mp4 (H.264) qo'llab-quvvatlansa shuni, bo'lmasa webm tanlanadi.
   ═══════════════════════════════════════════════════════════════════════ */
export const VID_TRIGGER_BPS = 3.5e6;  // shundan past bitreytli video tegilmaydi
const VID_BASE_BPS  = 2.5e6;           // odatiy nishon (≈720p/30fps)
const VID_MIN_BPS   = 500e3;           // bundan past sifat bo'lmaydi
const VID_AUDIO_BPS = 96e3;
const VID_FPS       = 30;
const VID_FILL      = 0.9;             // limitning 90% igacha rejalashtiramiz (zaxira)

function _pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
  const list = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
  ];
  return list.find(m => MediaRecorder.isTypeSupported(m)) || null;
}

function _loadVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'auto'; v.playsInline = true; v.src = url;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('Video o\'qilmadi'));
  });
}

/**
 * Videoni kerak bo'lsa siqadi. Qaytaradi: { file, changed, note }.
 * Xatolik tashlaydi faqat: video limitga sig'maydigan darajada uzun/og'ir bo'lsa.
 * Boshqa har qanday muammoda original qaytadi (agar maxBytes ga sig'sa).
 */
export async function compressVideo(file, { maxBytes, onProgress } = {}) {
  if (!file || !file.type.startsWith('video/')) return { file, changed: false };
  const fits = file.size <= maxBytes;
  const keep = note => {
    if (!fits) throw new Error(note || 'Video limitdan katta va siqib bo\'lmadi');
    return { file, changed: false, note };
  };

  const url = URL.createObjectURL(file);
  let video;
  try {
    try { video = await _loadVideo(url); } catch (e) { return keep('video o\'qilmadi'); }
    const dur = video.duration;
    if (!isFinite(dur) || dur <= 0) return keep('davomiylik noma\'lum');

    // ── Hisoblagich ──
    const bps = file.size * 8 / dur;
    if (bps <= VID_TRIGGER_BPS && fits) return { file, changed: false, note: 'yengil' };

    const mime = _pickRecorderMime();
    if (!mime || !HTMLCanvasElement.prototype.captureStream) return keep('brauzer siqa olmaydi');

    // ── Nishon bitreyt: limitga sig'sin ──
    const capBps = (maxBytes * VID_FILL * 8) / dur - VID_AUDIO_BPS;
    let target = Math.min(VID_BASE_BPS, capBps, bps * 0.8);
    if (target < VID_MIN_BPS) {
      if (!fits) throw new Error(`Video juda uzun (${Math.round(dur)} soniya) — qisqaroq video tanlang`);
      return keep('siqish kerakmas');
    }
    const longSide = target < 1.2e6 ? 960 : 1280;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return keep('o\'lcham noma\'lum');
    const scale = Math.min(1, longSide / Math.max(vw, vh));
    const w = Math.max(2, Math.round(vw * scale / 2) * 2);
    const h = Math.max(2, Math.round(vh * scale / 2) * 2);

    // ── Canvas + audio ──
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(VID_FPS);
    let actx = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        actx = new AC();
        const dest = actx.createMediaStreamDestination();
        actx.createMediaElementSource(video).connect(dest);   // dinamikka ulanmaydi — jim
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        if (actx.state === 'suspended') await actx.resume();
      }
    } catch (_) { /* audio'siz davom etadi */ }

    const rec = new MediaRecorder(stream, {
      mimeType: mime, videoBitsPerSecond: Math.round(target), audioBitsPerSecond: VID_AUDIO_BPS,
    });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { rec.onstop = res; });

    const draw = () => { try { ctx.drawImage(video, 0, 0, w, h); } catch (_) {} };
    const timer = setInterval(() => {
      draw();
      if (onProgress) onProgress(Math.min(99, (video.currentTime / dur) * 100));
    }, 1000 / VID_FPS);

    const finished = new Promise((resolve, reject) => {
      video.onended = resolve;
      video.onerror = () => reject(new Error('Video siqishda uzildi'));
      setTimeout(resolve, dur * 1000 * 2 + 15000);           // xavfsizlik: osilib qolmasin
    });

    draw();
    rec.start(1000);
    video.muted = false;
    try { await video.play(); }
    catch (_) { clearInterval(timer); try { rec.stop(); } catch (_) {} actx && actx.close().catch(() => {}); return keep('video ijro etilmadi'); }

    try { await finished; }
    catch (e) { clearInterval(timer); try { rec.stop(); } catch (_) {} actx && actx.close().catch(() => {}); return keep(e.message); }
    clearInterval(timer);
    video.pause();
    try { rec.stop(); } catch (_) {}
    await stopped;
    actx && actx.close().catch(() => {});

    const type = mime.split(';')[0];
    const blob = new Blob(chunks, { type });
    if (!blob.size) return keep('siqish natijasi bo\'sh');
    if (fits && blob.size >= file.size * 0.9) return { file, changed: false, note: 'foyda yo\'q' };
    if (blob.size > maxBytes) {
      if (fits) return { file, changed: false, note: 'natija katta' };
      throw new Error('Video siqilgandan keyin ham limitdan katta — qisqaroq video tanlang');
    }
    const ext  = type === 'video/mp4' ? 'mp4' : 'webm';
    const name = (file.name || 'video').replace(/\.[^.]*$/, '') + '.' + ext;
    if (onProgress) onProgress(100);
    return { file: new File([blob], name, { type, lastModified: Date.now() }), changed: true, note: `${Math.round(bps / 1e6 * 10) / 10} → ${Math.round(blob.size * 8 / dur / 1e6 * 10) / 10} Mbit/s` };
  } finally {
    URL.revokeObjectURL(url);
  }
}
