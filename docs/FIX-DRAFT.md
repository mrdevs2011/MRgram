# FIX-DRAFT: 2 qurilma sinovidan topilgan kamchiliklar (QORALAMA)

Sana: 2026-09-29 ~20:37. Sinov: mrspace.vercel.app, 2 brauzer (chap: Brave, akkaunt M; o'ng: Chromium, akkaunt admin).
Holat (2026-09-29 22:50): KOD TUZATILDI, MR TASDIQI KUTILYAPTI (branch fix/draft-f1-f4, push qilinmagan).
- F1: doimiy typing broadcast kanali (3cc57be).
- F2: sarlavha statusi `.chat-thread-typing` height:0/opacity:0 bilan yashirilgan edi -> ko'rinadigan qilindi; ro'yxat nuqtalari uchun `_refreshUsersPresence` (last_seen kesh eskirishi); heartbeat fon/yopiq oynada ham ketadi; ONLINE_THRESHOLD 70s->100s.
- F3: ASOSIY SABAB topildi: `--tg-blue` aniqlanmagan -> `.nav-badge`/`.chat-row-badge` fon OQ + matn OQ (ko'rinmas). Fon `var(--blue)` qilindi (matn oq).
- F4: ism ustidan halqa (ism z-index), avatar KVADRAT (border-radius 50% child/isolation). call.js tegilmadi. Taymer farqi tekshirilmadi (skrin vaqti farqi bo'lishi mumkin).
- Qora rasm preview (2026-09-30): sabab ikki qatlam: compress.js shaffof PNG ni JPEG ga o'tkazganda fon QORA bo'lardi (oq fon qo'shildi) va .cfm-img-preview fon --pal-gray-900 edi (transparent qilindi). Taymer 00:00 vs 00:02: har tomon o'z ulanish vaqtidan sanaydi, xato emas (call.js tegilmadi).
- Qo'shimcha: ko'k pufakdagi fayl izohi kontrasti oshirildi. Qora rasm preview: sababi aniqlanmadi (3 KB rasm o'zi bo'sh/qora bo'lishi mumkin) -- qayta sinash kerak.
Tasdiq: Qoida 8 -- 2 qurilmada MR ko'zi bilan.

Ishlaydi: realtime xabar (matn, ovozli, rasm) ikki tomonga darhol keladi.

## F1. "Yozmoqda..." ko'rinmaydi
- Belgi: bir telefon/brauzerda yozilganda ikkinchisining chat sarlavhasida "yozmoqda..." chiqmayapti.
- Kod: `modules/chat.js` ~686-705 (`_setTyping`, `_onChatInputTyping`), ~672 (`_paintPeerStatus`, `_peerTyping`).
- Gumon (tekshirilmagan):
  1. `_setTyping` har chaqiruvda YANGI `sb.channel('typing-bc-<chatId>')` ochadi va hech qachon `removeChannel` qilmaydi (oqish + har safar qayta subscribe).
  2. Qabul qiluvchi tomonda shu kanal nomiga `.on('broadcast', {event:'typing'})` bilan obuna bormi va `_peerTyping = true` qilib `_paintPeerStatus` chaqiradimi, tekshirish kerak. Kommentda "typing_until diet patch da olib tashlangan, realtime broadcast" deyilgan, ya'ni mexanizm yaqinda almashtirilgan, qabul qiluvchi qismi tushib qolgan bo'lishi mumkin.
  3. Izoh (kod tepasida) hali Firestore haqida gapiradi, eskirgan.
- Tuzatish g'oyasi: chat ochilganda bitta doimiy kanal (`typing-bc-<chatId>`), ikki tomon ham shunga obuna; yuboruvchi shu kanaldan `send` qiladi; chat yopilganda `removeChannel`. Faqat DM.

## F2. Onlayn holati noto'g'ri / to'liq emas
- Belgi 1: chat sarlavhasida (ikkala oynada ham) ismning tagida "onlayn" yoki "oxirgi faollik" matni ko'rinmayapti (skrin 1).
- Belgi 2: chatlar ro'yxatida bir tomonlama: M oynasida admin yonida yashil nuqta bor, admin oynasida M yonida yo'q, holbuki M oynasi ochiq (skrin 2).
- Kod: `modules/chat.js` ~223 (`isOnline(u.lastSeenAt)`), ~663-700 (`#chatTypingStatus`), ~775-791; heartbeat `modules/auth.js` ~868-879 (`profiles.last_seen` ~25s).
- Gumon (tekshirilmagan):
  1. M heartbeat yozmayapti yoki fon-tab throttle (brauzer ochiq, lekin fokus boshqa oynada).
  2. `isOnline` chegarasi heartbeat oralig'idan qisqa, nuqta o'chib qolyapti.
  3. admin akkaunti `profiles.last_seen` ni o'qiy olmayaptimi (RLS / `_usersCache` eskirgan).
  4. `#chatTypingStatus` elementi sarlavhada yo'q yoki CSS bilan yashirilgan (mono/x-design !important?).
- Tekshirish: DevTools > Network: heartbeat har ~25s ketyaptimi; `profiles.last_seen` qiymati Supabase'da yangilanyaptimi; elementni Elements'da qidirish.

## F3. Chatlar ikonkasida o'qilmagan son (nav-badge) ko'rinmayapti
- Belgi: MR fikricha son chiqmayapti.
- OGOHLANTIRISH: skrin 2 vaqtida qabul qiluvchi chatni allaqachon ochgan edi (skrin 1), xabarlar "o'qilgan" bo'lgan, shuning uchun son yo'qligi o'zi dalil emas. QAYTA SINASH kerak: qabul qiluvchi Lenta yoki Profilda tursin, ikkinchi tomon 2-3 xabar yuborsin.
- Kod: `modules/chat.js` ~440-470 (`loadChats` > `updateChatBadge(total)`, `chat_members.unread_count`, realtime `chat_members` filter `user_id=eq.me`), ~818 (chat ochilganda `unread_count: 0`).
- Gumon: (1) `unread_count` DB triggerda oshmayapti (supabase/), (2) realtime `chat_members` UPDATE eventi kelmayapti (Realtime publication), (3) `updateChatBadge` element/CSS (`.nav-badge`, mono'da qora matn) ko'rinmas qilyapti. Roadmap Q11: `.nav-badge` MR ko'z testini kutgan.

## Qo'shimcha kuzatuvlar (skrin 1, tekshirilmagan)
- "Pasted image.png · 3 KB" xabarida rasm oldindan ko'rinishi qora/bo'sh.
- Ko'k pufakda shu fayl izohi ("Pasted image.png · 3 KB") juda xira, kontrast past.

## Tartib (taklif)
1. F3 ni toza qayta sinash (ehtimol fix kerak emas).
2. F2 (diagnostika: heartbeat + sarlavha elementi).
3. F1 (typing kanalini qayta yozish).
Qoida 8: har biri brauzerda 2 qurilmada MR ko'zi bilan tasdiqlanadi. Tegilmaydigan zona: `chat.js` asosiy yozishma logikasi, shuning uchun faqat typing/presence/badge qismlariga tegiladi.

## F4. Qo'ng'iroq oynasi (9-qadam, skrinlardan, 2026-09-29 20:40) — kichik kuzatuvlar
Ishlaydi: chaqiruv kelish oynasi chiqadi ("MRSPACE QO'NG'IROG'I", Rad etish / Qabul qilish), qabul qilgach ikki tomon "Ulandi" holatiga o'tadi, mikrofon ishlatilyapti.
- Kiruvchi qo'ng'iroq oynasida yashil halqa animatsiyasi ism matnining ustidan o'tadi ("Muhammadrasul Qosimov" chiziq bilan kesilgan ko'rinadi). Ehtimol halqa/avatar o'lchami yoki ism `z-index`/joylashuvi.
- Qabul qilgandan keyin chaqiruvchi tomonda avatar (yashil "A") doiradan KVADRATga aylanib qolgan, ikkinchi tomonda doira. Ehtimol `border-radius` yo'qolgan yoki gapirish animatsiyasi holati.
- Taymer: chaqiruvchi tomonda 00:00, qabul qiluvchida 00:02 (bir vaqtdagi skrinlarda). Skrin vaqti farqi bo'lishi mumkin, tekshirilmagan.
- Hali tekshirilmagan: ovoz eshitilishi, tugatish ikki tomonga yopilishi, video, Wi-Fi <-> mobil.
- Tegilmaydigan zona: `call.js` mantig'iga tegilmaydi, faqat CSS/ko'rinish.
- Yangilanish (2026-09-29): ovoz ikki tomonda eshitilyapti (MR tasdiqladi). VIDEO TEKSHIRILMAGAN: noutbukda kamera yo'q, telefonda sinash kerak. Push, "Yangi versiya bor", Wi-Fi <-> mobil ham telefon kerak, keyinga qoldirildi.
