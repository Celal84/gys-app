# QA raporu — güncel MVP

06.11.2026 devam oturumu. Durum: **MVP çalışır / kısmi içerik**. Gerçek iPhone Safari ve nihai ürün kabulü henüz yapılmadı.

| Kontrol | Sonuç | Kapsam |
| --- | --- | --- |
| TypeScript ve ESLint | Geçti | Çekirdek, kayıt katmanı, uygulama ve testler |
| Birim/entegrasyon | **79/79 geçti** | Kaynak yayını, veri şeması, oturum/cevap atomikliği, çakışma, gerçek paket, kapsam ve regresyon |
| Python kaynak/HTML testleri | **9/9 geçti** | Yapısal çıkarım ve inline dipnot/paragraf koruması |
| Mobil Chromium E2E | **7/7 geçti** | Aşağıdaki gerçek soru akışı dahil |
| Üretim derlemesi | Geçti | Konu parçaları, manifest ve PWA; 10 önbellek girdisi yaklaşık278 KiB |
| Gerçek içerik yayın denetimi | **18/18 Approved** | Ayrı inceleme + deterministik kural + 11 gerçek kaynak HTML hash'i |
| Resmî 657 kaynak çıkarımı | 40 kontrol,0 hata | Soru onayı değildir; belge/alinti bütünlüğü |
| Diğer resmî kaynak envanteri | 472 kontrol,0 hata | 23 mevzuat kaynağına bağ; hukuki tam kabul değildir |
| Bağımlılık denetimi | Kritik/yüksek0 | Geliştirmede10 orta+2 düşük bulgu sürüyor |
| Gerçek iPhone Safari | **Yapılmadı** | Chromium mobil görünümü gerçek iPhone testi sayılmaz |
| GitHub Actions | Uzakta başlatıldı | PR#1,kod commit75d295a;son kayıtlı gözlem in_progress;tamamlanma sonucu ayrıca doğrulanır |

Gerçek paket E2E'si: 657'de beş soruluk çalışma açıldı; ilk soru yanlış,sonraki dört doğru cevaplandı. Yanlıştan sonra bağlantı kesilip sayfa yenilendi; kalıcı seçenek sırası ve kontrol edilmiş cevapla devam edildi. Sonuç **4 doğru,1 yanlış,0 boş** olarak kaydedildi; benzersiz tamamlama **5/18** ve yanlış defteri doğrulandı. Diğer E2E'ler:9 resmî kitapçık bağlantısı ve0 kabul göstergesi,24/16/8filtre,320px taşma,çevrimdışı kabuk,eksik denemenin engeli,eski localStorage baytlarının korunması ve geçersiz yedek öncesinde onay istenmemesi.

Kayıt testlerinde yeniden yükleme/ayar değişiminde XP'nin iki kez eklenmemesi,eski sekme sürüm çatışması,çift cevap,şema geçişi,değişmez geçmiş sonuçlar,journal export/merge ve bozuk/kesişen yedekte atomik ret denetlendi. İçe aktarılan sahte aktif soru,güncel paketin kimlikleri kopyalansa bile metin/seçenek/anahtar/kaynakla tam eşleşmeden sürdürülemez. Yanlış serpiştirmesi güncel onaylı nesneyi kullanır. Prototype anahtarları konu istatistiğine sokulmaz.

İlk E2E çalıştırmalarında testin asenkron ekran değişimini beklememesi ve rozetli düğmenin erişilebilir adı yüzünden hata görüldü. Gezinme sırasında kontroller kilitlendi,test gerçek soru metni değişimini bekler hale getirildi,yanlış defteri düğmesine açık erişilebilir ad eklendi. Yukarıdaki7/7sonucu bu düzeltmelerden sonradır. Hatalar gizlenmedi veya beklenen puan değiştirilmedi.

## Açık kabul işleri

- **İçerik:**18/5.400 özgün;havuzB18/2.400,havuzA0/3.000,tam deneme0/30. Eski50 kayıt incelemede. Bu paket tüm657 kapsamını temsil etmez. Çıkmış sorular kabul edilmedi.
- **Kaynak:**657 Word çıkarıcı farkı ve O04 OCR renkli kutu eksikleri açık.75 sayfa OCR işlendi fakat tamlık onaylanmadı.
- **Kapsam:**24 konuda176 hedef taslağı;nihai kapsam paydası ve tüm hukuki yürürlük/geçiş değerlendirmesi bekliyor. Kapsam/hâkimiyet yüzdesi ve güvenilir sınav puanı tahmini üretilmiyor.
- **Yedek:**Eski kayıt/ayar zarfı ile yeni tam çalışma günlüğü iki ayrı JSON'dur. Tek dosyada bütün veriyi atomik geri yükleme ve PDF raporu sonraki iş. Eski kullanıcı anahtarları silinmez.
- **Sürüm/zaman:**Mevzuat hazırlık sürümü,kesim01.01.2027gelecekte. Otomatik nöbetçi ve sürekli arka plan taraması yok. Aktif düşünme süresi ölçülmediğinde null;duvar saati düşünme süresi sayılmaz.
- **Diğer özellikler:**Strict100/150,sınav saati sürekliliği,SM-2,planlama,kalibrasyon,karşılaştırmalar,odak araçları ve30deneme kabulü tamamlanmadı. Can sınırı yalnız isteğe bağlı alıştırma davranışıdır.
- **Cihaz/PWA:**HTTPS/localhost ve ilk çevrimiçi yükleme gerekir. Gerçek iPhone kurulumu,PNG apple-touch-icon,WebKit/gerçek Safari,güncelleme bildirimi ve cache tahliyesi henüz kabul edilmedi.
- **Güvenlik:**Yeni IndexedDB cevap/sayaç değişimleri atomik ve revizyon kontrollüdür;eski ayar zarfı localStorage'da kalır. Güncel bağımlılık denetimi12geliştirme bulgusu bildiriyor(kritik/yüksek0). Nihai sızma testi yapılmadı.

Makine raporları: [test-results.json](test-results.json),[content-publication-report.json](content-publication-report.json),[content-audit.json](content-audit.json),[source-integrity-summary.json](source-integrity-summary.json),[security-audit.json](security-audit.json). E2E ayrıntısı test-results/e2e-results.json içinde. [Devam raporu](CONTINUATION_REPORT.md) ve [kayıtlı durum](PROJECT_STATE.json) günceldir.

Aşağıdaki bölüm önceki Faz0oturumunun tarihî raporudur;güncel sonuçlar yukarıdadır.

---

# QA raporu — Faz 0

Tarih:06.11.2026. Ürün durumu **Prototip**. Bu rapor Faz 0 kabulünü kapsar; MVP ve nihai içerik kabulünü kapsamaz.

## Çalıştırılan kontroller

|Kontrol|Sonuç|Pratik kapsam|
|---|---|---|
|TypeScript `tsc --noEmit`|Geçti|Yeni çekirdek ve TS test/yapılandırma dosyaları;eski JS motoru tam TS'ye çevrilmedi|
|ESLint|Geçti|src,tests,scripts|
|Vitest|44/44 geçti|Müfredat,resmî parametre uyumu,İstanbul günü,yayın kapısı,madde sınırı,korunan havuz,Drive dışlama,şema/import/restore/veri korunması,motor regresyonu|
|Üretim derlemesi|Geçti|Vite + yerel JS/CSS + PWA manifest/service worker|
|İçerik envanter denetimi|Geçti|50 eski kayıt,16 tekrar adayı,0 onay;nihai içerik kabulü **false**|
|Mobil Chromium E2E|5/5 geçti|Aşağıdaki gerçek tarayıcı otomasyon senaryoları|
|Ek mobil görünüm kontrolü|320/390/430px geçti|Taşma/JS hatası yok;filtre24/16/8;~59pxsatır|
|Bağımlılık denetimi|Üretim0; geliştirme12|Kritik/yüksek0; geliştirme10 orta+2 düşük;tam güvenlik kabulü değil|
|Git diff boşluk kontrolü|Geçti|`git diff --check`|
|GitHub Actions|Yalnız yapılandırıldı|Uzak workflow çalıştırılmadı|
|Gerçek iPhone14Safari|**Yapılmadı**|Emülasyon gerçek cihaz testi değildir|

E2E:1)onay sayısı/filtre/eksik deneme/tahmin;2)320pxyatay taşma;3)service worker sonrası bağlantısız yeniden açılış;4)eski v1verisinin açılış/ayar değişiminde bayt olarak aynı kalması ve sabit ağırlık;5)bozuk yedeğin onay istemeden reddi ve aktif kaydı değiştirmemesi.

Birimlerde seçenek karıştırıldığında kalıcıID eşleşmesi,eksik/yanlış100 soruluk dağılımın reddi,tek başına AIöz-onayı ve kaynaksız onayın reddi;dışlananID'nin listeleme çağrısına hiç ulaşmaması;bozuk yedek/future schema/kimlik çakışması/prototype pollution/kota hatası ve atomik aktif kayıt kontrol edildi. Gün açılışı çalışılmış gün sayılmıyor. Bu testler hukuki içerik doğruluğunu kanıtlamaz.

Makine raporları:[test-results.json](test-results.json),[content-audit.json](content-audit.json),[source-summary.json](source-summary.json). E2E ayrıntısı `test-results/e2e-results.json` içinde;CIartifact olarak saklanır. Mobil ekranlar ve yerel kontroller `.local-reports/` içindedir. Üretim paketinde9önbellek girdisi yaklaşık147 KiB;bu bir iPhone performans benchmark'ı değildir.

## Kaynak kabulü

Resmî duyuru/sınav parametreleri doğrulandı;resmî ve Drive dağılım PDF'leri SHA256eşit.24dersdosyasının baytları ve başlıkları alındı. Bir OCR sınırlı dosya var;24 dosyada hukuki sürüm ve tam madde/bent/dipnot/tablo onayı **bekliyor**. İlerleme dalı açılmadı. Çıkmış arşivde6 dosya listelendi;resmî soru/anahtar/kullanım hakkı incelemesi yapılmadı.

## Açık işler ve sınırlar

- **İçerik/MVP engeli:**50 eski kayıt inceleme bekliyor;onaylı soru0. Konu testleri ve tam deneme bu yüzden kapalı.5.400 hedefin tamamlandığı veya çalışan MVP olduğu iddia edilmez.
- **Faz 1:**Atatürk OCR hataları;tablo/dipnot/sayfa bütünlüğü. O01/O02/O03 dosyaları müfredattan geniş.
- **Faz 2:**22 konunun ayrıntılı kapsamı,24 konunun hedefleri,resmî hukuk snapshot'ları ve yürürlük/geçiş tarihleri.01.01.2027 kesimi gelecekte;mevzuat hazırlık sürümünde.
- **Kayıt:**İlk faz localStorage'dır;IndexedDB ve sürümlü deneme oturumları sonraki fazda. Eşzamanlı iki sekmede compare-and-swap koruması yok;stale sekme yeni v4kaydı ezebilir. MVP öncesi çözülmeli. Eski v1orijinaller korunur.
- **Cihaz/origin:**Tarayıcı depolama temizliği ve farklı origin'e otomatik taşıma garanti edilmez;JSONyedek gerekir. iOSkurulum ikonunda yalnızSVGvar;apple-touch-iconPNGve gerçek cihaz testi bekliyor.
- **PWA:**İlk yükleme çevrimiçi veHTTPS/localhost gerekir;cihazın cachetahliye davranışı,gerçekSafari,paket güncelleme bildirimi ve kullanıcı veri geçişi henüz kabul edilmedi. Çevrimdışı kabuğun çalışması onaylı içerik var demek değildir.
- **Strict:**100/150motor,zamanın kalıcılığı,arka plan/yenileme,saat oynama,sonuç sürümleri ve gerçekStrictE2Ehenüz yok. Alıştırma can sınırıStrictdeğildir.
- **Akıllı öğrenme:**SM-2,hedefhâkimiyeti,güvenilir tahmin,kalibrasyon,planlama,odak araçları,PDFrapor ve mevzuat nöbetçisi henüz yok. Son başarılı mevzuat kontrolü yok.
- **Güvenlik:**Şema/XSSiçin metin gösterimi ve sır içermeyen yerel varlıklar kullanılır. Yerelde cevaplar mutlak gizlenemez. Bağımsız sızma testi veya nihai güvenlik kabulü yapılmadı.

Canlı yayın,Drive yazması,eski ilerleme silme ve uzak depo değişikliği yapılmadı. Kullanıcıdan yeni izin/karar gerektiren engel yok. Sonraki adım:Faz 1metin/yapı bütünlüğünü tamamlamak,ardından kapsam haritası ve bağımsız doğrulanmış küçük örnek paket.

## Bağımlılık bulguları

İlk geliştirme denetimindeki iki kritik Vitest/tinypool bulgusu, Vitest 5.1.0 güncellemesiyle giderildi. TypeScript ESLint ve PWA araçları da güncellendi;lint/test/derleme tekrar geçti. Üretim bağımlılığı Alpine için bildirilen açık0. Geliştirme araçlarında12 bulgu kaldı:2 düşük,10 orta;kritik/yüksek yok. Zincirler `deepmerge`, `glob`, `minimatch`, Workbox/Rollup ve TypeScriptESLint. `npm audit fix --force` sürüm düşürme/değişiklikleri uygulanmadı. Sabit güvenilir build globları riski sınırlar;bu,bulguların giderildiği anlamına gelmez. Ayrıntılı özet [security-audit.json](security-audit.json);MVP öncesi yeniden değerlendirilmelidir.
