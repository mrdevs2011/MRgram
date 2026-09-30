# Smoke test — har deploydan oldin (~5 daqiqa)

Preview'da (yoki lokal) o'tkaziladi. Bitta qizil xato bo'lsa — `main` ga merge qilinmaydi.
Avtomatik qismi: `node tests/smoke.mjs` (Playwright, 2 viewport; `BASE_URL=<preview>` bilan Preview'ga ham). Quyidagi qo'lda punktlar shunga qo'shimcha.
Vizual CSS o'zgarishi bo'lsa: dark/light va mobil/desktop'ni **ko'z bilan** ko'r (roadmap qoida 8).

## Auth
- [ ] Yangi user ro'yxatdan o'tadi → "kutish" ekrani
- [ ] Admin tasdiqlaydi → user ilovaga kiradi
- [ ] Admin rad etadi → "rad etildi" ekrani
- [ ] Bloklangan user kira olmaydi; blok tugagach kiradi

## Lenta
- [ ] Rasm/video post yuklanadi (≤ 25 MB), lentada ko'rinadi
- [ ] 25 MB dan katta fayl rad etiladi
- [ ] Like, izoh ishlaydi; markdown (qalin/egik) chiqadi

## Chat
- [ ] Yozma, ovozli xabar, fayl yuboriladi
- [ ] Reply, qidiruv, o'qildi belgisi
- [ ] "Yozmoqda..." va onlayn/oxirgi faollik (2 qurilmada)
- [ ] Push bildirishnoma (telefon yopiq holda) keladi

## Guruh
- [ ] Guruh yaratiladi, a'zo qo'shiladi, xabar keladi
- [ ] Faqat-adminlar rejimi (ex-kanal) ishlaydi

## Qo'ng'iroq
- [ ] Audio va video qo'ng'iroq Wi-Fi ↔ mobil tarmoqda ulanadi

## Admin
- [ ] E'lon yuboriladi va hamma ko'radi
- [ ] Parol reset: vaqtinchalik parol beriladi, user shu bilan kiradi
- [ ] O'chirilgan user ma'lumoti ketadi

## Texnik
- [ ] Konsolda qizil xato yo'q
- [ ] Yangi deploydan keyin ochiq ilovada "Yangi versiya bor · Yangilash" paneli chiqadi
- [ ] Dark/light va mobil/desktop tartib buzilmagan
