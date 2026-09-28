# MRgram — platforma haqida to'liq ma'lumot

MRgram — Telegram va Instagram'ning eng yaxshi jihatlarini birlashtirgan
zamonaviy ijtimoiy tarmoq / messenjer PWA (Progressive Web App) ilovasi.

## 1. Ro'yxatdan o'tish va kirish (Auth) — aniq qadamlar

- Kirish (login) oynasida FAQAT 2 maydon bor: "Foydalanuvchi nomi" va
  "Parol". Email SO'RALMAYDI — tizim username asosida ichki email yaratadi
  (foydalanuvchi buni ko'rmaydi/kiritmaydi).
- Ro'yxatdan o'tish (signup) oynasida ANIQ 4 maydon bor, boshqa hech narsa
  YO'Q: 1) To'liq ism, 2) Foydalanuvchi nomi (username), 3) Parol (kamida
  6 ta belgi), 4) Parolni tasdiqlash (bir xil bo'lishi kerak). YOSH va
  EMAIL maydonlari MAVJUD EMAS.
- Platforma "yopiq" tizim: parolni unutgan taqdirda uni QAYTA TIKLASH
  IMKONI YO'Q (parol tiklash funksiyasi umuman mavjud emas) — shuning
  uchun ro'yxatdan o'tishda parolni xavfsiz joyga yozib qo'yish tavsiya
  etiladi. Hech qanday "parolni tiklash" havolasi yoki jarayoni yo'q,
  faqat administratorga murojaat qilish mumkin.
- **Ro'yxatdan o'tgandan keyin hisob DARHOL ochilmaydi.** U avtomatik
  ravishda "tasdiq kutilmoqda" (`approved=false`) holatiga o'tadi. Bu
  vaqtda foydalanuvchi maxsus "Kutish" ekranini ko'radi va ilovadan
  to'liq foydalana olmaydi — ADMIN uni tasdiqlashini (yoki rad etishini)
  kutishi kerak. "Muvaffaqiyatli ro'yxatdan o'tdingiz" xabari faqat
  arizaning qabul qilinganini bildiradi, to'liq kirish huquqini emas.
- Admin tasdiqlagach (`approved=true`) — ilova to'liq ochiladi. Admin rad
  etsa (`approved="rejected"`) — foydalanuvchiga "arizangiz rad etildi"
  ekrani chiqadi.
- Admin foydalanuvchini istalgan payt BLOKLASHI mumkin — vaqtinchalik
  (muddat bilan, orqaga sanoq ko'rsatiladi) yoki doimiy. Bloklangan
  foydalanuvchi ilovaga kira olmaydi, blok tugagach avtomatik ochiladi.

## 2. Post yuklash (Feed'ga rasm/video/fayl joylash)

- Pastki navigatsiyadagi (yoki header'dagi mobil) "+" / "Yaratish" tugmasi
  bosilganda yuklash oynasi (overlay) ochiladi.
- Fayl tanlash (rasm, video yoki istalgan boshqa fayl turi: hujjat, zip
  va h.k.), ixtiyoriy tavsif (caption) matni yozish mumkin.
- Ko'rinish darajasi — 2 ta variant (post yaratishda albatta tanlanadi):
  - **Shaxsiy** (standart) — faqat post egasining o'zi ko'radi.
  - **Ommaviy** — barcha foydalanuvchilar lentada ko'radi.
- Fayl hajmi cheklovi: maksimum 50 MB.

## 3. Lenta / postlar bilan o'zaro ta'sir (Feed)

- Har bir post ostida: like, izoh qoldirish, ulashish imkoniyatlari bor.
- Post tavsiflari va izohlarda Markdown belgilari ishlaydi: `**qalin**`,
  `*egik*`, `` `kod` ``, `# sarlavha`, `- ro'yxat`.

## 4. Suhbatlar (Chats)

- Har bir tasdiqlangan (approved) foydalanuvchi bilan shaxsiy (1v1)
  yozishmalar.
- Matnli xabarlar, ovozli xabarlar (mikrofon orqali), istalgan turdagi
  fayllar yuborish mumkin.
- Xabarga javob berish (reply), xabar qidirish (chat ichida qidiruv) bor.
- Xabar holati: bitta belgi = yuborildi, ikkita ko'k belgi = o'qildi.
- "Yozmoqda..." indikatori va oxirgi ko'rilgan/onlayn holati real vaqtda
  ko'rinadi.
- Har bir suhbatda push-bildirishnoma (FCM) orqali xabar beriladi.
- Matnda Markdown belgilari har bir foydalanuvchi xabari uchun ham
  ishlaydi.

## 5. Guruhlar va kanallar

- **Guruh** — bir nechta odam birga yozishishi mumkin bo'lgan jamoa
  suhbati.
- **Kanal** — ma'muri(lar) xabar joylaydi, a'zolar o'qiydi.
- Yaratishda 2 xillik: "Maxfiy" (faqat taklif kodi/havola orqali
  qo'shiladi) yoki "Ochiq" (hammaga ko'rinadi/qidirib topiladi).
- Yaratuvchi avtomatik "Egasi" va "Admin" bo'ladi. Egasi/adminlar
  a'zolarni chiqarishi (kick) mumkin.
- Havola/kod orqali qo'shilish mumkin.

## 6. Qo'ng'iroqlar

- WebRTC orqali audio/video qo'ng'iroqlar, Firestore orqali
  signalizatsiya.
- Chat oynasida yuqorida ovozli va videoli qo'ng'iroq tugmalari bor.
- Kiruvchi qo'ng'iroqda qabul qilish (yashil) / rad etish (qizil)
  tugmalari.
- Faol qo'ng'iroqda: mikrofonni ovozsiz qilish va dinamik/quloqcha
  rejimini almashtirish tugmalari bor.

## 7. Profil

- Ism, username, avatar, muqova rasmi, bio, veb-sayt va joylashuvni
  "Profilni sozlash" orqali tahrirlash mumkin.
- Rasmlarni kesish (crop) imkoniyati bor.
- Profilda postlar, yoqtirishlar, obunachilar va obunalar soni ko'rinadi.

## 8. Admin panel (faqat administratorlarga ko'rinadi)

- Foydalanuvchilarni boshqarish: arizalarni tasdiqlash/rad etish,
  bloklash/blokdan chiqarish, o'chirish.
- Ommaviy xabar (broadcast) yuborish.
- Statistika: foydalanuvchilar soni, faollik va boshqa ko'rsatkichlar.

## 9. Texnik asos

- Frontend: vanilla JavaScript (modul asosida), PWA (manifest, service
  worker, offline keshlash).
- Backend: Firebase (Authentication + Firestore) va fayllar uchun
  Supabase Storage.
- Push-bildirishnomalar: Firebase Cloud Messaging (FCM).
- Domen: mrgram.vercel.app (Vercel'da joylashtirilgan).

## 10. Interfeys tuzilishi — UI xaritasi

**Umumiy kataklar (barcha sahifada doim ko'rinadi):**

- **Yuqori header** (ekran tepasida, doim qotib turadi):
  - Chap burchakda: MRgram logotipi + nomi (Bosh sahifaga qaytaradi).
  - O'ng tomonda: "+" Yangi post (faqat mobil) → Qidiruv (lupa) → ovozni
    yoqish/o'chirish (kerak bo'lganda).
- **Pastki navigatsiya** (mobilda ekran tagida gorizontal, desktopda chap
  tomonda vertikal sidebar):
  1. Bosh sahifa (uy belgisi) — Lentaga o'tadi.
  2. Qidiruv (lupa) — foydalanuvchi/post qidirish.
  3. "Yaratish" (o'rtadagi katta doira) — yangi post yuklash oynasini
     ochadi.
  4. Suhbatlar (xabar bulutchasi) — Chats sahifasi; o'qilmagan xabar
     bo'lsa qizil badge chiqadi.
  5. Profil (odam siluet) — o'z profilga o'tadi.
  6. Boshqaruv/Admin (faqat administratorlarga ko'rinadi).

**Sahifalar:**

- **Bosh sahifa / Lenta** — header ostida darhol boshlanadigan, to'liq
  ekranli vertikal skroll qilinadigan postlar oqimi.
- **Profil** — tepada muqova rasmi, uning ustiga chiqib turgan avatar,
  yonida statistikalar (postlar/yoqtirishlar/obunachilar/obunalar),
  pastda ism/username/bio/"Profilni sozlash" tugmasi, eng pastda postlar
  panjarasi (3 ustunli). "Profilni sozlash" bosilsa alohida oyna ochiladi.
- **Suhbatlar** — yuqorida sarlavha + "+" (yangi guruh/kanal), pastida
  ro'yxat. Suhbat bosilsa to'liq ekranli
  chat oynasi ochiladi.
- **Boshqaruv/Admin panel** — "Foydalanuvchilar" → "Broadcast" →
  "Statistika" tartibida.

**Muhim overlay/oynalar:**

- Yuklash oynasi: fayl tanlash, tavsif matni, ko'rinish darajasi
  tugmalari, "Yuklash" tugmasi.
- Izohlar oynasi: pastdan chiqadigan ro'yxat + izoh yozish maydoni.
- Rasm/video kattalashtirish oynasi: to'liq ekran, yopish tugmasi
  yuqori burchakda.
- Qo'ng'iroq oynalari: markazda ism/avatar + qabul qilish/rad etish
  tugmalari; faol qo'ng'iroqda to'liq ekran video/audio ko'rinishi.

<!-- redeploy: 1790562229 -->
# test
# test
# test
# test
