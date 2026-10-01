# AI Context — .

## Oxirgi holat
- Sana:
- Nima qilindi:
- Hozirgi muammo/blocker:
- Keyingi qadam:

## Muhim fayllar
-

## Eslatmalar (arxitektura, qarorlar, "buni qilma" kabi)
-

---
### 2026-09-29 22:45
- Qilindi: F1-F4 draft fixlari kodda tuzatildi va commit qilindi (1480a7d, branch fix/draft-f1-f4, push qilinmagan). MR ko'zi bilan 2 qurilmada tasdiqlashi kerak
- Keyingi qadam: MR tasdiqlasa main ga merge/push; rasm preview qora muammosi va qo'ng'iroq taymeri qayta sinash
- Git holati: 1480a7d fix(F2-F4): sarlavha status ko'rinadi, presence yangilanishi, badge fon (--tg-blue), qo'ng'iroq oynasi halqa/avatar, fayl izohi kontrasti

---
### 2026-09-30 07:32 (Claude-2, mantiq/infra)
- Qilindi (lokal commitlar, PUSH QILINMAGAN): 4ed6171 chat.js skeleton/${} tuzatish; c8d493c 7.7 `error-log.js` + 014 SQL; dccb5e5 7.2 `admin-storage.js` + 015 SQL; 9c3e412 Playwright `tests/smoke.mjs` (14/14) + docs.
- Boshqa Claude (UI/CSS) bilan kelishuv: `~/Claude/.messages/`; CSS/F4 unda, mantiq/infra menda. `git add -A` yo'q.
- MR ishi qoldi: Vercel Preview + TURN_* env; contract SQL 007–013 (eng erta 2026-10-06); 014/015 (expand, istalgan vaqtda); 3.6 so'rov natijasi; `000_schema` dump; qarorlar Q2/Q4/Q5/Q8/Q9/Q10/Q11; `main` ga merge/push.
- Keyingi qadam: MR tasdiqlasa `main` ga merge; F4 (4.2/4.6/4.8) — CSS Claude'da.

---
### 2026-09-30 17:15 (Claude-4, CSS/DB/docs)
- Qilindi: 014/015 -> migrations/ (2c190cd); 000_schema jonli dump (ed8c6a3); 010/011 no-op ekani tekshirildi (20bfa82); 4.6 !important audit: 127 -> 12 (6e8342d, 04d6ec6, 5e40387, 666b5d0). Hammasi origin/main da (666b5d0).
- 4.6 usuli: har flag alohida olib tashlanib, headless Chromium (1280 va 390) da ~4500 element computed-style asl holat bilan solishtirildi. Control = xuddi shu usuldagi base (fresh --user-data-dir; profilsiz base bilan solishtirma, u ~66-74 shovqin beradi). 115 ta flag 0/0 -> olib tashlandi; 12 tasi farq berdi -> qoldi (.view.on, .vc-mute, .inc-call-btn, .c-red, .chat-voice-btn va h.k.).
- Blocker/ogohlik: harness faqat statik holat; hover, dark tema, boshqa view'lar o'lchanmagan. MR brauzerda tekshirishi kerak. Buzilsa: tegishli commit'ni git revert (har fayl alohida).
- Keyingi qadam (MR): Vercel deploy "Ready" + docs/SMOKE.md telefonda; TURN sinovi (Wi-Fi -> mobil); 2026-10-06 dan keyin zaxira olib 013; 007-012 ni migrations/ ga ko'chirish yoki o'chirish; Q9, Q11.
- Harness (vaqtincha): /tmp/h (perflag2.mjs, apply2.mjs, ver.sh); asl nusxa ~/Claude/tools/css-regress.

## Muhim fayllar
- docs/MR-QOLGAN.md (MR ishlari), supabase/unfulfilled/CHECKLIST.md (contract SQL tartibi), CSS/*.css -> `node scripts/build-css.mjs` -> app.css (qo'lda tahrirlanmaydi)

## Eslatmalar
- Contract SQL'ni kod bilan bir vaqtda yurgizma (roadmap 3-qoida). 013: eng erta 2026-10-06, zaxiradan keyin.

---
### 2026-10-01 16:00
- Qilindi: realtime <=0.3s: guruh mesh, rt-bus, presence, inbox, like/izoh/post broadcast
- Keyingi qadam: MR 2 qurilmada sinaydi, keyin main ga merge/push
- Git holati: 145b58e feat(realtime): <=0.3s — guruh WebRTC mesh, global broadcast shina (like/izoh/post), presence, kirish qutisi (DM/guruh ro'yxati), P2P typing, eventsPerSecond 60

---
### 2026-10-01 16:03
- Qilindi: guruh UI/logika DM bilan bir xil
- Keyingi qadam: MR sinaydi; 016 SQL; keyin main
- Git holati: 1db9e0f feat(groups): guruh thread DM bilan bir xil painter/menyu/yozmoqda/fayl/ovoz; yagona farq — pufak sarlavhasida yuboruvchi ismi
