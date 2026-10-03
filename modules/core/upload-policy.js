/**
 * SpaceMR yuklash siyosati: VIDEO taqiqlangan, qolgan hamma fayl ruxsat
 * (barcha rasm formatlari, PDF/Word/Excel/ZIP, audio, ovozli xabar...).
 * Istisno: story, profil avatari va guruh avatari — faqat RASM.
 * (Baza tomoni: supabase/migrations/056_block_video_only.sql)
 */
export const UPLOAD_DENIED_MSG = 'Video yuklash mumkin emas';
export const STORY_DENIED_MSG = "Storyga faqat rasm qo'yish mumkin";
export const IMAGE_ONLY_MSG = "Bu yerga faqat rasm qo'yish mumkin";
export const ALLOWED_UPLOAD_ACCEPT = ''; // cheklovsiz (video JS orqali rad etiladi)

const VIDEO_EXT = /\.(mp4|mov|mkv|avi|m4v|wmv|flv|3gp|mpg|mpeg|ogv|webm)$/;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|heic|heif|bmp)$/;
const IMAGE_ONLY_FOLDERS = ['stories', 'avatars', 'group-avatars'];

function _t(file) { return String(file?.type || '').toLowerCase(); }
function _n(file) { return String(file?.name || '').toLowerCase(); }

export function isVideoFile(file) {
  if (!file) return false;
  const t = _t(file);
  if (t.startsWith('video/')) return true;
  if (t.startsWith('audio/')) return false; // audio/mp4, audio/webm — video emas
  return VIDEO_EXT.test(_n(file));
}

export function isImageFile(file) {
  if (!file) return false;
  const t = _t(file);
  return t.startsWith('image/') || (!t && IMAGE_EXT.test(_n(file)));
}

/** Umumiy yuklash: video bo'lmasa bo'ldi. */
export function isAllowedUpload(file) {
  return !!file && !isVideoFile(file);
}

export function isAllowedVoice(file) {
  return !!file && _t(file).startsWith('audio/');
}

export function assertAllowedUpload(file, folder = '') {
  if (!file) throw new Error(UPLOAD_DENIED_MSG);
  if (folder === 'chat-voice' && isAllowedVoice(file)) return;
  if (isVideoFile(file)) throw new Error(UPLOAD_DENIED_MSG);
  if (folder === 'stories') {
    if (!isImageFile(file)) throw new Error(STORY_DENIED_MSG);
  } else if (IMAGE_ONLY_FOLDERS.includes(folder) && !isImageFile(file)) {
    throw new Error(IMAGE_ONLY_MSG);
  }
}
