/* rate-limit.js — 7.6: mijoz tomonidagi oddiy yuborish tezligi cheklovi.
   Maqsad: tasodifiy spam/bosib qolish (Enter ushlab turish, qayta-qayta bosish) — xavfsizlik chegarasi EMAS
   (u RLS/serverda). Sirpanuvchi oyna: `windowMs` ichida `max` tadan ko'p bo'lsa rad etadi. */
import { toast } from '../ui/toast.js';

const _hits = Object.create(null);

export function rateOk(bucket, max, windowMs, silent = false) {
  const now = Date.now();
  const list = (_hits[bucket] = (_hits[bucket] || []).filter(t => now - t < windowMs));
  if (list.length >= max) {
    if (!silent) {
      const oldest = list[0];
      const remaining = Math.ceil((windowMs - (now - oldest)) / 1000);
      toast(`Juda tez yuboryapsiz, ${remaining}s kuting`, 'error');
    }
    return false;
  }
  list.push(now);
  return true;
}
