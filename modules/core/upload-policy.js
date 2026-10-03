/**
 * SpaceMR yuklash siyosati: VIDEO taqiqlangan, qolgan hamma fayl ruxsat
 * (barcha rasm formatlari, PDF/Word/Excel/ZIP, audio, ovozli xabar...).
 * Istisno: story, profil avatari va guruh avatari — faqat RASM.
 * Istisno 2: chat/guruhga FAYL sifatida (chat-files, group-files) video ham ruxsat (057).
 * (Baza tomoni: supabase/migrations/056_block_video_only.sql, 057_allow_video_as_chat_file.sql)
 */
export const UPLOAD_DENIED_MSG = 'Video yuklash mumkin emas';
export const STORY_DENIED_MSG = "Storyga faqat rasm qo'yish mumkin";
export const IMAGE_ONLY_MSG = "Bu yerga faqat rasm qo'yish mumkin";
export const ALLOWED_UPLOAD_ACCEPT = ''; // cheklovsiz (video JS orqali rad etiladi)

const VIDEO_EXT = /\.(mp4|mov|mkv|avi|m4v|wmv|flv|3gp|mpg|mpeg|ogv|webm)$/;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|heic|heif|bmp)$/;
const IMAGE_ONLY_FOLDERS = ['stories', 'avatars', 'group-avatars'];
// Chat/guruhga FAYL sifatida yuborilganda video (mp4...) ham ruxsat: oddiy fayl kartochkasi, pleyer yo'q.
const FILE_ANY_FOLDERS = ['chat-files', 'group-files'];

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

/** Chat/guruh fayl biriktirish: hamma narsa (video ham, fayl sifatida). */
export function isAllowedChatFile(file) {
  return !!file;
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
  if (FILE_ANY_FOLDERS.includes(folder)) return;
  if (isVideoFile(file)) throw new Error(UPLOAD_DENIED_MSG);
  if (folder === 'stories') {
    if (!isImageFile(file)) throw new Error(STORY_DENIED_MSG);
  } else if (IMAGE_ONLY_FOLDERS.includes(folder) && !isImageFile(file)) {
    throw new Error(IMAGE_ONLY_MSG);
  }
}
