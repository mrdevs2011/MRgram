/**
 * chat-storage.js — chat pins / recent searches / localStorage yordamchilari
 * chat.js dan ajratilgan (sifat: monolitni yengillashtirish).
 */
import { state } from './config.js';

export function getPins() {
  if (!state.me?.uid) return { dms: [], groups: [] };
  try {
    const raw = localStorage.getItem(`chat_pins_${state.me.uid}`);
    if (!raw) return { dms: [], groups: [] };
    const p = JSON.parse(raw);
    return {
      dms: Array.isArray(p.dms) ? p.dms : [],
      groups: Array.isArray(p.groups) ? p.groups : [],
    };
  } catch {
    return { dms: [], groups: [] };
  }
}

export function isPinned(type, id) {
  const pins = getPins();
  return type === 'dm' ? pins.dms.includes(id) : pins.groups.includes(id);
}

export function togglePin(type, id) {
  const pins = getPins();
  const list = type === 'dm' ? pins.dms : pins.groups;
  const idx = list.indexOf(id);
  let isNowPinned = false;
  if (idx >= 0) {
    list.splice(idx, 1);
    isNowPinned = false;
  } else {
    list.unshift(id);
    isNowPinned = true;
  }
  if (type === 'dm') pins.dms = list;
  else pins.groups = list;
  try {
    localStorage.setItem(`chat_pins_${state.me.uid}`, JSON.stringify(pins));
  } catch (_) {}
  return isNowPinned;
}

export function getRecents() {
  if (!state.me?.uid) return [];
  try {
    const raw = localStorage.getItem(`chat_recent_searches_${state.me.uid}`);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveRecent(item) {
  if (!state.me?.uid || !item || !item.id) return;
  const list = getRecents().filter(x => x.id !== item.id);
  list.unshift(item);
  try {
    localStorage.setItem(`chat_recent_searches_${state.me.uid}`, JSON.stringify(list.slice(0, 10)));
  } catch (_) {}
}

export function removeRecent(id) {
  if (!state.me?.uid) return;
  const list = getRecents().filter(x => x.id !== id);
  try {
    localStorage.setItem(`chat_recent_searches_${state.me.uid}`, JSON.stringify(list));
  } catch (_) {}
}

export function clearAllRecents() {
  if (!state.me?.uid) return;
  try {
    localStorage.removeItem(`chat_recent_searches_${state.me.uid}`);
  } catch (_) {}
}

export function markChatDeletedLocal(uid) {
  if (!state.me?.uid || !uid) return;
  try {
    localStorage.setItem(`deleted_chat_${state.me.uid}_${uid}`, String(Date.now()));
  } catch (_) {}
}

export function clearChatDeletedLocal(uid) {
  if (!state.me?.uid || !uid) return;
  try {
    localStorage.removeItem(`deleted_chat_${state.me.uid}_${uid}`);
  } catch (_) {}
}

export function getChatDeletedAt(uid) {
  try {
    const raw = localStorage.getItem(`deleted_chat_${state.me?.uid}_${uid}`);
    if (!raw) return null;
    return Number(raw) || null;
  } catch {
    return null;
  }
}
