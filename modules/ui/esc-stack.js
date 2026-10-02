/* esc-stack.js — "Esc" tugmasi uchun yagona navbat (butun ilova bo'yicha).
   Ochiq oynalar (overlay/modal) shortcuts.js da ro'yxatda, ularning z-index'i ish vaqtida o'qiladi.
   Oynasi bo'lmagan ichki holatlar (ochiq menyu, tanlash rejimi, emoji panel, tahrirlash, hikoya ko'rgich...)
   shu yerda ro'yxatdan o'tadi: onEsc(z, fn) — z ularning ekrandagi qatlami (kattasi — ustida), fn holatni yopsa true qaytaradi.
   Esc bosilganda hammasi z bo'yicha tartiblanadi va faqat ENG USTKI holat yopiladi. */
const locals = [];

export function onEsc(z, fn) {
  locals.push({ z, fn });
}

export function escLocals() {
  return locals;
}
