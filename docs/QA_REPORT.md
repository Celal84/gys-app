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
