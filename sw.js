/**
 * sw.js — SpaceMR Service Worker (cache + Web Push)
 * Standart Web Push ('push' hodisasi). Firebase yo'q.
 * Payload Edge Function'dan keladi: { title, body, type, fromUid, chatId, groupId }
 * Android: sayt yopiq bo'lsa ham ishlaydi. Desktop: brauzer ochiq bo'lsa.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { body: event.data ? event.data.text() : '' }; }

  const isCall = data.type === 'call';

  event.waitUntil((async () => {
    // Ilova ochiq va ko'rinib turgan bo'lsa (qo'ng'iroqdan tashqari) bildirishnoma ko'rsatmaymiz —
    // xabarni foydalanuvchi allaqachon ilovada ko'rib turibdi.
    if (!isCall) {
      const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (wins.some((c) => c.visibilityState === 'visible')) return;
    }

    await self.registration.showNotification(data.title || 'SpaceMR', {
      body:  data.body || '',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   isCall ? 'spacemr-call' : (data.chatId || data.groupId || data.fromUid || 'spacemr'),
      renotify: !isCall,
      data:  { url: '/', ...data },
      // Qo'ng'iroqda kuchli tebranish pattern
      vibrate: isCall
        ? [500, 200, 500, 200, 500, 200, 500, 200, 500]
        : [200, 100, 200],
      requireInteraction: isCall, // Qo'ng'iroq bildirishnomasi o'z-o'zidan yopilmaydi
      silent: false,
      actions: isCall ? [
        { action: 'accept', title: "Qabul qilish" },
        { action: 'reject', title: "Rad etish" },
      ] : [],
    });
  })());
});

// Notification bosilganda saytni ochish
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data   = event.notification.data || {};
  const action = event.action; // 'accept' | 'reject' | ''
  const url    = '/';

  // URL ga action ni parametr sifatida qo'shamiz — sayt ochilganda qayta ishlaydi
  let openUrl = url;
  if (data.type === 'call' && data.fromUid) {
    openUrl = action === 'reject'
      ? `/?call_action=reject&from=${data.fromUid}`
      : `/?call_action=accept&from=${data.fromUid}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'CALL_ACTION', action, data });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(openUrl);
    })
  );
});


/* ── Cache versiyasi ── */
// Statik fayllarga o'zgartirish kiritsangiz, PWA o'zi eskisini yangilashi uchun
// bu raqamni oshiring (v1 -> v2 -> v3 ...).
const CACHE_VERSION  = 't-1790943430942'; /* BUILD_VERSION_LINE */
const STATIC_CACHE   = `spacemr-static-${CACHE_VERSION}`;
const RUNTIME_CACHE  = `spacemr-runtime-${CACHE_VERSION}`;

// PWA birinchi o'rnatilganda oldindan yuklab, cache'ga solib qo'yiladigan
// "ilova qobig'i" fayllari — tez ochilishi va OFFLINE'da ishlashi uchun.
//
// MUHIM: bu yerga ilovaning BARCHA modul fayllari kiritilishi shart —
// aks holda foydalanuvchi hali ochmagan sahifaga (masalan chat) offline
// paytida o'tsa, o'sha modul cache'da topilmay, import xatosi bilan
// BUTUN ilova ishdan chiqadi (ES module import — bittasi qulasa, hammasi
// qulaydi, chunki modullar bir-birini chain qilib import qiladi).
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.css',
  '/manifest.json',
  // Barcha JS modullari (modules/ papkasi to'liq)
  '/modules/script.js',
  '/modules/router.js',
  '/modules/config.js',
  '/modules/vendor-supabase.js',
  '/modules/env.js',
  '/modules/ui.js',
  '/modules/utils.js',
  '/modules/auth.js',
  '/modules/bar.js',
  '/modules/toast.js',
  '/modules/feed.js',
  '/modules/chat.js',
  '/modules/chat-media.js',
  '/modules/error-log.js',
  '/modules/no-autocomplete.js',
  '/modules/admin-storage.js',
  '/modules/rate-limit.js',
  '/modules/call.js',
  '/modules/comments.js',
  '/modules/groups.js',
  '/modules/local-cache.js',
  '/modules/explore.js',
  '/modules/profile.js',
  '/modules/push.js',
  '/modules/upload.js',
  '/modules/admin-badge.js',
  '/modules/view-actions.js',
  '/modules/view-chats.js',
  '/modules/view-home.js',
  '/modules/view-login.js',
  '/modules/view-profile.js',
  '/modules/view-users.js',
  '/modules/admin-reset-password.js',
  '/modules/chats-x.js',
  '/modules/rt-chat.js',
  '/modules/compress.js',
  '/modules/right-rail.js',
  '/modules/shortcuts.js',
  '/modules/sidebar.js',
  '/modules/stories.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/svg/SpaceMR.png',
  '/svg/favicon.png',
  '/svg/splash.png',
];

// Qaysi so'rovlarga tegmaymiz: jonli backend (Supabase), tashqi CDN va /api/ —
// ular hech qachon keshlanmaydi, to'g'ridan-to'g'ri tarmoqqa ketadi.
function _isBypassed(url) {
  return (
    url.includes('supabase.co') ||
    url.includes('/api/') ||
    !url.startsWith(self.location.origin)
  );
}

// Statik resurs turini aniqlaymiz (CSS/JS/rasm/font) — bularga cache-first qo'llanadi
function _isStaticAsset(request) {
  const dest = request.destination; // 'style' | 'script' | 'image' | 'font' | ...
  return dest === 'style' || dest === 'script' || dest === 'image' || dest === 'font';
}

/* ── 0% KESH (Hech narsa keshlanmaydi) ── */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 0% cache: barcha mavjud kesh xotiralarni to'liq tozalash
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await clients.claim();
    })()
  );
});

// Barcha tarmoq so'rovlari bevosita serverdan keshsiz olinadi
self.addEventListener('fetch', () => {
  return;
});

