# GYS 85+ · Şube Müdürü (Teknik)

ÇŞİDB 2027 sınavı için mobil öncelikli hazırlık uygulaması. **Durum: İlk MVP çalışır / kısmi içerik.** 657 konu bankasında 18 onaylı hazırlık sorusu vardır. 5.400 soru hedefi ve nihai kabul tamamlanmadı.

Mevcut `Celal84/gys-app` uygulamasının Alpine motoru korundu. CDN bağımlılıkları Vite derlemesine taşındı; TypeScript kaynak doğrulama ve IndexedDB kayıt katmanları eklendi.

## Çalıştırma

Node.js 24, npm ve kaynak denetimi için Python 3 gereklidir.

```sh
npm ci
npm run dev
```

Vite çıktısındaki yerel adresi açın. Üretim ve çevrimdışı deneme için:

```sh
npm run build
npm run preview
```

Service worker üretim derlemesinde çalışır; ilk başarılı çevrimiçi açılış gerekir. Telefonda HTTPS gerekir (`localhost` geliştirme istisnasıdır). Gerçek iPhone Safari kabulü yapılmadı. Kullanıcının açık onayı olmadan canlı yayın yapılmaz.

## Doğrulama

```sh
npm run lint
npm run typecheck
npm run verify:content
npm run test:sources
npm run test
npm run build
npm run audit:content
npm run test:e2e
```

Yerel E2E `/usr/bin/chromium` kullanır; farklı sistemde tarayıcı yolunu ayarlayın. CI, Playwright Chromium'u kurar. [Taslak PR #1](https://github.com/Celal84/gys-app/pull/1) üzerinde uzak CI başlatıldı; sonucu ayrıca gözlenmeden başarılı sayılmaz.

## İçerik ve kaynak

Eski dosyalardaki 24 gömülü ve 26 JSON kaydı, **50 özgün veya onaylı soru değildir**. İnceleme beklerler. Yeni pakette 18 özgün soru üretildi; üretimden ayrı model destekli inceleme ve deterministik resmî kaynak kontrolleriyle 18'i onaylandı. Bu süreç insan hukuk uzmanı onayı olarak gösterilmez.

`npm run verify:content`, gerçek resmî HTML baytlarını, alıntıyı ve dipnotu, kalıcı cevap/çeldirici kimliklerini, hedef/madde sınırını ve değişmemiş bağımsız inceleme hash'lerini kontrol eder. Sonuç `data/approved-content.json` ve konu parçalarına yazılır. Küçük manifest başlangıçta, soru metinleri konu açılırken yüklenir.

657 konu çalışması açıktır. Diğer konular onaylı paket bekler. Tam deneme, korunan soru havuzu ve 100 soru/150 dakika Strict Mode tamamlanmadan başlamaz. Test fixture'ları gerçek içerik sayılmaz. İçe aktarılan JSON içindeki `Approved` alanı yayın yetkisi oluşturmaz.

Mevzuat **hazırlık sürümüdür**. 01.01.2027 kesimi gelecekte; nihai sınav sürümü kesinleşmedi. 23 mevzuat kaynağının snapshot'ı ve 24 konu için 176 hedef taslağı bulunması, bütün kapsamın ve hukuki yürürlük/geçiş incelemesinin tamamlandığı anlamına gelmez.

## İlerleme ve yedek

Eski `gys_duo_state_v1` / `gys_duo_questions_v1` anahtarlarına yazılmaz veya silinmez. Eski kayıtlar ve ayarlar sürümlü localStorage zarfında; yeni çalışmalar IndexedDB'de saklanır. Cevap ve sayaç güncellemesi atomiktir; eski sekme revizyonu reddedilir. Soru/cevap/kaynak sürümleri ve geçmiş sonuçlar korunur. Yenileme ve çevrimdışı açılışta devam edilir.

Yeni çalışma günlüğü tam JSON olarak dışa aktarılır ve kayıt silmeden, çakışma denetimiyle birleştirilir. Eski kayıt/ayar yedeği ayrıdır; **tam koruma için iki dosyayı birlikte saklayın**. Tek dosyalı atomik bütün veri restore'u sonraki iştir. Bozuk yedek aktif kaydı kısmen değiştirmez. Tarayıcı depolaması temizlenebilir; düzenli yedek alın. Farklı origin veya cihazdan otomatik taşıma yapılmaz.

## Çıkmış kaynaklar

Katalog 9 resmî MEB kitapçığına bağlanır. 480 tarihî anahtar eşleşti; 580 pozisyonun benzersizlik, 2027 kapsamı, güncel hukuk ve kullanım hakkı incelemesi sürer. Kabul edilen çıkmış soru **0**, uygun benzersiz N bilinmiyor. Kitapçıkların tam soru metinleri uygulamada yeniden yayımlanmaz.

## Raporlar ve devam

- [Güncel devam raporu](docs/CONTINUATION_REPORT.md)
- [Testler ve açık kabul işleri](docs/QA_REPORT.md)
- [Kayıtlı proje durumu](docs/PROJECT_STATE.json)
- [Kaynaklı soru incelemesi](docs/FIRST_PACKAGE_REVIEW.md)
- [Resmî kaynak kaydı](docs/OFFICIAL_SOURCE_REGISTRY.md)
- [Çıkmış arşiv denetimi](docs/HISTORICAL_ARCHIVE_REPORT.md)
- [Faz 0 başlangıç bulguları](docs/PHASE_0_REPORT.md)
- [V4 sözleşmesi özeti](docs/IMPLEMENTATION_CONTRACT_V4.md)

Özel Drive ham dosyaları ve ayrıntılı envanter `.local-sources/` içinde, Git dışında tutulur. Bu dizin uzak yedek değildir; ortam kaybolursa yetkili bağlantıdan yeniden alınır. İstemciye erişim sırrı eklenmez. İlerleme klasörü ID ile dışlanır; Drive dosyaları değiştirilmez.
