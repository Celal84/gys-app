# GYS 85+ · Şube Müdürü (Teknik)

ÇŞİDB 27 Şubat 2027 sınavı için Türkçe, mobil öncelikli PWA. **Durum: çalışan uygulama / kısmi doğrulanmış içerik.** Mevcut Alpine uygulaması korundu; Vite, TypeScript çekirdeği ve native IndexedDB kayıt katmanlarıyla geliştirildi.

**400 onaylı özgün hazırlık sorusu** kullanılabilir: O01 (1 sayılı CBK), O02 (657), O03 (Anayasa) ve T01 (5543) bankalarında 100'er soru. Toplam 648 özgün adayın kalan 248'i korunan deneme havuzunda inceleme/yayın kapısını bekler. **5.400 onaylı soru hedefine kalan 5.000; hazır tam deneme 0/30.** Eski 50 incelemesiz kayıt ve tarihî cevap pozisyonları bu sayılara eklenmez. Güncel makine envanteri: [content-inventory.json](docs/content-inventory.json).

## Çalıştırma

Node.js 24, npm ve kaynak denetimleri/sunucu için Python 3 gerekir.

```sh
npm ci
npm run dev:full
```

Bu komut içerik kanıtlarını doğrular, Vite'ı ve yerel mevzuat kontrol API'sini başlatır. Vite'ın gösterdiği adresi açın. Yalnız arayüz geliştirmek için `npm run dev` kullanılabilir; API ayrıca çalışmıyorsa yeni çevrimiçi mevzuat kontrolü yapılamaz.

Üretim derlemesini yerelde uygulama ve API ile çalıştırmak için:

```sh
npm run build
npm run serve
```

Varsayılan adres `http://127.0.0.1:8787`; sunucu `HOST` ve `PORT` ortam değişkenlerini destekler. Yalnız statik derlemeyi incelemek için `npm run preview` kullanılabilir. Vite geliştirme/önizleme `/api` isteklerini yerel 8787 portuna yönlendirir.

Service worker üretim derlemesinde çalışır. İlk başarılı çevrimiçi açılış ve kaynakların önbelleğe alınması gerekir; telefonda kurulum için HTTPS gerekir (`localhost` geliştirme istisnasıdır). **Canlı yayın yapılmadı.** Uzak HTTPS yayını için kullanıcının açık onayı gerekir.

## Kullanılabilen özellikler

- Konu, kaynak madde/alt başlık ve zorluk seçimi; 5/10/20/25/50/100 soruluk çalışma tercihi, beş kalıcı seçenek kimliği, kaynak bağlantılı açıklama, sonuç kaydı ve yanlış defteri.
- Kaldığı yerden devam, değişmez soru/cevap/kaynak sürümleri, ilk/tekrar ayrımı ve muhafazakâr ön plan süre ölçümü. Arka plan veya ölçülemeyen kapalı süre düşünme süresi sayılmaz.
- Onaylı çalışma sorularından kaynaklı kartlar ve uyarlanmış SM-2: manuel 0–5 kalite, ilk başarılı aralıklar 1/3/7/14/30 gün. Kartlar yeni soru sayılmaz; korunan A soruları kartlara veya konu bankasına aktarılmaz.
- İsteğe bağlı hata nedeni ve öz-açıklama; çeldirici kavramları, kaynaklı karşılaştırmalar, çalışma istatistikleri, değiştirilebilir haftalık 480 dakikalık plan ve odak sayacı.
- Yetersiz veride puan tahminini kapatan deneysel tahmin motoru. Her 24 konuda örneklem/çeşitlilik eşiği gerekir; tekrarlar ve tarihî sorular bağımsız ölçüm sayılmaz. Mevcut dört konu bankası tüm sınav için güvenilir puan tahmini sağlamaz. Kapsam paydası kesinleşmeden kapsam/hâkimiyet yüzdesi verilmez.
- Açık/koyu tema, çevrimdışı uygulama kabuğu ve içerik parçaları, PWA güncelleme bildirimi, tek JSON tam yedek ve okunabilir Türkçe PDF raporu.

**Strict Mode motoru ve arayüzü uygulanmıştır; başlatılabilir gerçek tam deneme henüz yoktur.** Motor yalnız 24 konunun tam ağırlığıyla 100 onaylı, bağımsız Havuz A sorusunu kabul eder. 150 dakika, duraklatmasız sayaç, serbest geçiş/cevap değişimi, sonuç öncesi cevap ve açıklama gizleme, otomatik bitiş, kalıcı oturum ve sonuç sürümleri test edilir. Eksik deneme konu bankası sorularıyla doldurulmaz. Cihaz kapalıyken saat değiştirilmesini yalnız çevrimdışı cihazla kesin doğrulamak mümkün değildir; yerel cevap anahtarlarının mutlak gizliliği iddia edilmez. Ayrıntılar: [STRICT_MODE.md](docs/STRICT_MODE.md).

## Kaynak, içerik ve mevzuat

`npm run verify:content`, [açık parti listesindeki](data/publication-batches.json) adaylar için gerçek resmî HTML dosyalarının hash'ini, alıntı/dipnotu, ayrı kural dosyasını, kalıcı cevap/çeldirici bağını, öğrenme hedefini, madde/kapsam sınırını ve bağımsız incelemeden sonra değişmemiş aday hash'ini denetler. 400 soruluk paket 166 kaynak artifact kontrolünden geçer. Bağımsız süreç model desteklidir; insan hukuk uzmanı kabulü olarak gösterilmez. Listede olmayan veya incelemesi eksik aday yayımlanmaz. İçe alınan JSON'daki `Approved` değeri yayın yetkisi vermez.

Küçük manifest başlangıçta; soru metinleri konu açılırken, hash kontrolüyle yüklenir. Aynı kanıtlar tekrar denetlendiğinde yayımlanmış soru ve manifest hash'leri değişmez. Çalışma sorularına erişim, son doğrulanmış kaynak değişikliği kaydı varsa yeniden inceleme durumunu dikkate alır; geçmiş sonuçlar korunur.

Mevzuat **hazırlık sürümüdür**. 01.01.2027 kesimi henüz gelmedi; nihai sınav sürümü, bütün yürürlük/geçiş hükümleri ve 24 konunun tam kapsam paydası kesinleşmedi. 24 konu/166 alt konu/176 başlangıç hedef taslağı ile dört bankanın ayrı kaynaklı hedefleri bulunur. Her mevzuatın tamamı otomatik sınav kapsamında sayılmaz.

Paketle gelen son başarılı tam resmî kaynak kontrolü **06.11.2026 14:12:22 UTC / 17:12:22 Europe/Istanbul**: 23 mevzuat kaynağı gerçek HTTP/kimlik/metin doğrulamasından geçti; çözümlenmiş içerik veya teknik sürüm değişikliği bulunmadı. Bu kontrol hukuki yürürlük veya nihai sınav sürümü kabulü değildir. Kanıt: [legal-watch.json](public/content/legal-watch.json).

Arayüzde yeni kontrol, aynı origin üzerindeki `POST /api/legal-watch` üzerinden Python denetleyicisini çalıştırır; yalnız kayıtlı 23 konu kabul edilir, keyfî URL veya kullanıcı ilerlemesi gönderilmez. Başarılı rapor en çok altı saat önbellekten gelebilir; gerçek gözlem tarihi korunur. Çevrimdışı/ağ hatası yeni başarı olarak yazılmaz. [Günlük GitHub Actions kontrolü](.github/workflows/legal-watch.yml) tanımlıdır; varsayılan dala alınmadan günlük çalıştığı iddia edilmez. PWA kapalıyken sürekli tarama yapmaz. Ayrıntılar: [LEGAL_WATCH.md](docs/LEGAL_WATCH.md).

## İlerleme, tam yedek ve PDF

Özgün `gys_duo_state_v1` / `gys_duo_questions_v1` anahtarlarına yazılmaz ve bu anahtarlar silinmez. Yeni kayıtlar sürümlü localStorage ve IndexedDB alanlarında tutulur; cevap/sayaç işlemleri kendi transaction'larında, revizyon/çakışma kontrolüyle kaydedilir.

**Veri yönetimi → Tam JSON yedek** ayarları, çalışma günlüğünü, tekrarları, Strict kayıtlarını, planı, odağı ve mevzuat gözlemlerini tek dosyada dışa aktarır. Geri yükleme önce şema, hash ve çakışmaları denetler; inceleme ve açık kullanıcı onayından sonra ayrı bir profile hazırlanır. Bütün alanlar başarılıysa etkin profil işaretçisi atomik olarak değiştirilir. Eski profil korunur. Ayrı localStorage/IndexedDB veritabanlarının tek ortak transaction'ı olduğu iddia edilmez. Bozuk veya çakışan yedek mevcut etkin veriyi kısmen değiştirmez; diğer sekmelerde profil değişimi denetlenir.

PDF, yerel Türkçe font gömen okunabilir ilerleme/sonuç/plan raporudur; **geri yükleme kaynağı değildir**. Dosyalar kendiliğinden üçüncü servise gönderilmez. Tarayıcı depolaması temizlenebilir; cihazlar arasında otomatik aktarım yoktur. Biçim ve sınırlar: [BACKUP_FORMAT.md](docs/BACKUP_FORMAT.md).

## Çıkmış sorular ve Drive

Katalog dokuz resmî MEB kitapçığına bağlanır. 480 tarihî cevap anahtarı eşleşmesi ve toplam 580 soru pozisyonu gözlenmiştir; bunlar 580 uygun ve benzersiz tam soru anlamına gelmez. **Kabul edilen çıkmış soru 0; uygun benzersiz N bilinmiyor.** Tam soru metinlerinin yeniden yayımı kullanım hakkı izni bekler; tam metinler uygulamada yeniden yayımlanmaz. Erişilemeyen 2020 kitapçığı varmış gibi içerik üretilmez.

24 ders notu ve dağılım belgesi envantere alınmıştır. 657 Word çıkarım farkı ve O04 renkli kutu/OCR eksikleri açık kalır. Özel ham dosyalar `.local-sources/` içinde, Git dışında tutulur; bu yerel dizin uzak yedek değildir. Drive'daki **İlerleme** klasörü `1L30mGITasaz_HJ-wAQadrn9Tzv81nR7I` ID'siyle dal açılmadan dışlanır; içeriği okunmaz veya değiştirilmez. Drive erişim sırrı istemciye/depoya eklenmez.

## Doğrulama ve kabul

```sh
npm run lint
npm run typecheck
npm run verify:content
npm run verify:exams
npm run test:sources
npm run test
npm run build
npm run audit:content
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

E2E projeleri `mobile-chromium` ve `mobile-webkit` adlarını kullanır; ayrı çalıştırmak için örneğin `npm run test:e2e -- --project=mobile-webkit`. Yerel Chromium yolu `/usr/bin/chromium`; CI kurduğu Playwright Chromium'u kullanır. WebKit, iPhone 14 görünümüyle otomasyon sağlar. **Gerçek iPhone 14 Safari kabulü yapılmadı; WebKit emülasyonu gerçek cihaz testi değildir.** Güncel test sonuçları ve uzak CI gözlemi [QA_REPORT.md](docs/QA_REPORT.md) içinde tutulur; test sayıları çalıştırılan son rapordan okunmalıdır.

- [Şartname kabul matrisi ve kalanlar](docs/ACCEPTANCE_MATRIX.md)
- [Kayıtlı proje durumu](docs/PROJECT_STATE.json) · [devam raporu](docs/CONTINUATION_REPORT.md)
- [İçerik yayın kanıtları](docs/content-publication-report.json) · [tam aday envanteri](docs/content-inventory.json)
- [O01 inceleme](docs/O01_BANK_REVIEW.md) · [O02 inceleme](docs/O02_BANK_EXTENSION_REVIEW.md) · [O03 inceleme](docs/O03_BANK_REVIEW.md) · [T01 inceleme](docs/T01_BANK_REVIEW.md)
- [Öğrenme motoru](docs/LEARNING_ENGINE.md) · [plan/tahmin/odak](docs/PLANNING_AND_FORECAST.md)
- [Resmî kaynak kaydı](docs/OFFICIAL_SOURCE_REGISTRY.md) · [tarihî arşiv denetimi](docs/HISTORICAL_ARCHIVE_REPORT.md)
- [Faz 0](docs/PHASE_0_REPORT.md) · [V4 sözleşme özeti](docs/IMPLEMENTATION_CONTRACT_V4.md)

İçerik doğrulaması ve nihai ürün kabulü tamamlanmış değildir. Çalışan yazılım, 5.400 onaylı sorunun veya gelecekteki sınav mevzuatının tamamlandığı anlamına gelmez.

Korunan havuz:248adayın246’sı kaynakla doğrulanmış olarak PWA dışında hazırlanır;2NeedsReview. Tam100soruluk dağılım ve ayrı deneme incelemesi olmadan yayımlanmaz. `npm run verify:exams` bu kapıyı denetler.
