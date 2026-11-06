# Mobil tarayıcı kabul raporu

06.11.2026, son çalıştırma başlangıcı 15:15:42 UTC. **26/26 test geçti; 0 atlanan, 0 tekrar, 0 kararsız sonuç.** Çalıştırma 65,3 saniye sürdü. Üretim derlemesi, 400 onaylı çalışma sorusunu içeriyordu.

| Ortam | Sonuç | Gerçek kapsam |
| --- | --- | --- |
| Debian 13 / Chromium 156.0.8078.79 /390×844 |13/13 geçti|Mobil görünüm ve tarayıcı otomasyonu|
| Debian 13 / Playwright WebKit 27.2, build 2388 /390×664 /iPhone 14 emülasyonu |13/13 geçti|WebKit motoru, mobil görünüm ve dokunma ayarları|
| Fiziksel iPhone 14 /Safari |Yapılmadı|Emülasyon, gerçek iOS Safari kabulü yerine geçmez|

Her iki projede aşağıdaki akışlar gerçek arayüz ve kalıcı veritabanıyla çalıştırıldı:

- 24 konu/16 ortak/8 teknik filtresi, gerçek onaylı sayı ve eksik tam denemenin başlatılamaması.
- Konu bankasında zorluk ve madde/alt konu filtresi; 50 soru isteğinin eldeki soruyla sınırlandırılması; IndexedDB'ye yalnız eşleşen onaylı kimliklerin yazılması.
- Kaynak bağlantılı kartta cevabın başlangıçta gizlenmesi, kalite 5 verildikten sonra tekrar sırasından çıkması ve kaydın yenilemede korunması.
- 480 dakikalık haftanın 465 dakikaya değiştirilmesi, açık temanın korunması ve çalışılmayan görevin tamamlanmış sayılmaması.
- Bağlantı hatasında mevzuat nöbetçisinin gerçek son başarılı tam kontrol tarihini koruması.
- Odak oturumunun duraklatılması, duraklamada sürenin işlememesi ve yenilemede sürdürülmesi.
- Bozuk tam yedeğin veri değiştirmeden reddi; geçerli yedeğin yeni profilde açılması; önceki profilin korunması; indirilen PDF'nin gerçek PDF olarak ayrıştırılması.
- İlk konu satırının Chromium 390×844 ve WebKit 390×664 görünür alanlarında alt gezinmenin üstünde tamamen kalması; 320 px görünümde yatay taşma kontrolü, Service Worker üzerinden çevrimdışı yenileme, eski ilerlemenin bayt olarak korunması ve geçersiz eski yedek için onay istenmemesi.
- Beş gerçek soruluk akış: ilk soru yanlış, sonraki dört doğru; çevrimdışı yenilemeden sürdürme; 4 doğru/1 yanlış sonucu, benzersiz tamamlama ve yanlış defteri.
- Dokuz resmî MEB kitapçık bağlantısı ve 0 kabul edilmiş tarihî soru göstergesi.

Tam çevrimdışı soru akışı son çalıştırmada Chromium'da 12,3 saniye, WebKit'te 11,8 saniye sürdü. İki yenileme ve beş cevap içeren bu testin bütçesi 60 saniyedir; diğer testler 30 saniyede kalır. Otomatik tekrar kullanılmaz.

İlk denemelerde yayımlayıcı çalışırken derleme 100/300 soruda, yerel beklenen veri 200/400 soruda kaldığı için test sayıları uyuşmadı. Son 400 soruluk derleme boyunca kaynak çıktıları sabitlendi. Yeni soru seçeneklerinden birinde “devam ettiği” ifadesi eski `/DEVAM ET/i` düğme seçicisine de uydu; seçici tam erişilebilir düğme adıyla düzeltildi. WebKit'in ağ hatası metni “Load failed” olarak gözlendi. Bu ara hatalar nihai başarıya eklenmedi.

## Çalıştırma

Standart Linux/CI kurulumu:

```bash
npm ci
npx playwright install --with-deps chromium webkit
npm run build
npm run test:e2e
```

Playwright yapılandırması iki projeyi de çalıştırır; eşzamanlılık yerelde 4, CI'da 2 işçidir. CI tarayıcı bağımlılıklarını normal yöntemle kurar.

Bu oturumda sistem paketi kurmak için root yetkisi yoktu. Eksik kütüphaneler resmî Debian paketlerinden geçici kullanıcı klasörüne çıkarıldı; indirilen WebKit sarmalayıcısı mevcut `LD_LIBRARY_PATH` değerini koruyacak şekilde yerel olarak ayarlandı. Sistem kütüphane listesine yazılmayan GLES için yalnız Playwright'ın kurulum ön kontrolü atlandı. WebKit tarayıcısı gerçekten başlatıldı ve 13 testin tamamı yürütüldü; test atlanmadı. Bu geçici ortam ayarı uygulama koduna veya CI'ya eklenmedi.

Makine raporu: [browser-acceptance-report.json](browser-acceptance-report.json). Rapor test adlarını, sürelerini, derlenen dosyaların SHA-256 değerlerini ve fiziksel cihazın denenmediğini kaydeder. Ham Playwright raporu `test-results/e2e-results.json` içindedir ve CI artifact'ına alınır.

Son kompakt ana ekran görüntüsü: [mobile-preview.png](mobile-preview.png). WebKit iPhone 14 emülasyonunda fiziksel ekran 390×844, Safari görünür alanı 390×664 CSS pikselidir. İlk konu satırının altı 552,2 pikselde, alt gezinmenin üstü 598 pikselde. Ekran açıldığında ilk satırın tamamı görünür. Kaynak bilgisi ve sınav/çıkmış kaynaklar dokunularak açılan bölümlerde korunur.

Başlangıç konumu ayrıca doğrulandı: toolsReady ve gerçek kontrol tarihi beklenip window.scrollTo(0,0), body.scrollTop=0 ve documentElement.scrollTop=0 uygulandı. Görüntü öncesi ve sonrası tüm kaydırma değerleri 0, visualViewport.pageTop/offsetTop 0; başlık kutusu y0, yükseklik 89,5 piksel. Test de bu başlangıç konumunu ve başlığın görünmesini doğrular. Önizleme belirsizliğini gidermek için tarayıcıdan CSS piksel ölçeğinde 390×664 boyutlu PNG alındı. Görüntünün kaydırılmış olabileceği varsayımına dayanılarak kabul verilmez.
