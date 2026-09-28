/* ═══════════════════════════════════════════════════════════════════════
   MEDIA SIQISH (DIET F7.2) — Supabase Free 1 GB storage kvotasi uchun
   Rasm: canvas orqali ~1600px gacha kichraytirish + JPEG qayta siqish.
   Video: brauzerda haqiqiy transkod yo'q — faqat hajm limiti (MAX_FILE).
   Xato bo'lsa originalni qaytaradi (hech qachon yuklashni buzmaydi).
   ═══════════════════════════════════════════════════════════════════════ */

const IMG_MAX_DIM = 1600;   // eng uzun tomoni
const IMG_QUALITY = 0.8;    // JPEG sifati
const IMG_MIN_SAVE = 0.85;  // siqish 15% dan kam tejasa — original qoladi

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
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close && bitmap.close();

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', IMG_QUALITY));
    if (!blob) return file;
    // Siqish foydasiz bo'lsa (kichik/kam presslangan rasm) — originalni qaytar
    if (blob.size >= file.size * IMG_MIN_SAVE) return file;

    const name = (file.name || 'photo').replace(/\.[^.]*$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (e) {
    console.warn('[compress] rasm siqilmadi, original ishlatiladi:', e?.message || e);
    return file;
  }
}
