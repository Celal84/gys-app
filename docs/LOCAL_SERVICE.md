# İsteğe bağlı yerel mevzuat kontrol servisi

Uygulamanın çevrimdışı soru çözümü sunucu gerektirmez. Tarayıcıdan resmî UYAP kaynağına doğrudan istek izinleri bulunmadığı için **Mevzuatı kontrol et** işlemi, aynı kaynaktaki isteğe bağlı Node servisini kullanır. Servis yoksa uygulama önceki başarılı kontrol tarihini korur; kontrol yapılmış sayılmaz.

Node 22+ ve Python 3 gerekir. Kaynağın PDF dönmesi halinde `pdftotext` gerekir. Bu araç yoksa PDF kaynakları ayrıştırma başarısızlığı olarak raporlanır.

```sh
npm ci
npm run build
node server.mjs
```

Varsayılan adres `http://127.0.0.1:8787` olur. `PORT` ile port, `HOST` ile bağlanılan arayüz değiştirilebilir. Varsayılan yalnızca yerel makineye bağlanır. HTTPS ve canlı ortam yayını bu servis tarafından yapılmaz.

Vite geliştirme arayüzü ve servisi birlikte başlatmak için:

```sh
npm run verify:content
node scripts/sync-assets.mjs
node scripts/dev-full.mjs
```

Vite `/api` isteklerini `127.0.0.1:8787` adresine aktarır. Vite tek başına da kullanılabilir; bu durumda canlı mevzuat kontrol servisi çalışmaz. `PORT` değiştirilirse Vite proxy adresi de uyarlanmalıdır.

## İşleyiş

`POST /api/legal-watch`, JSON `{}` veya yalnızca `{"topics":["O02","T01"]}` kabul eder. Konu listesi mevcut 23 resmî mevzuat kaydıyla sınırlıdır; Atatürk tarihi O04 bir mevzuat kaydı değildir. İstek sınırı 1 KiB, rapor sınırı 256 KiB'dir. Kullanıcının soru çözümü, ilerlemesi, yedekleri veya Drive erişimi servise gönderilmez.

Servis, sabit Python denetleyicisini kabuk kullanmadan çalıştırır. Kullanıcı URL, dosya yolu, kimlik bilgisi veya komut sağlayamaz. Denetleyici sabit resmî endpoint ve depodaki doğrulanmış kaynak sicilini kullanır; kaynak değişikliği tespiti hukuki onay değildir. Yayımlanma, yürürlük ve geçiş incelemeleri ayrıca yapılır; 2027 sınav mevzuatı kesinleşmiş sayılmaz.

Aynı konu kümesi için eşzamanlı istekler tek taramayı paylaşır. Başka bir tarama sürerken farklı küme 429 yanıtı alır. Başarılı sonuç altı saat, kısmi başarısız sonuç 30 saniye bellekte tutulur. Önbellek yanıtı raporun **gerçek** `completedAt` tarihini taşır; yeni kontrol tarihi üretilmez. Sunucuyu yeniden başlatmak bu geçici önbelleği temizler.

Kısmi ağ/ayrıştırma hatası raporun içinde `complete:false` ve ilgili başarısız gözlemle döner. Süreç başlatılamaması, zaman aşımı veya geçersiz rapor HTTP hatasıdır. Bunlar başarı sayılmaz. İşlem için toplam 210 saniye üst sınır vardır; alt kaynak timeout'u 20 saniye, eşzamanlı kaynak sayısı üçtür.

Ham resmî yanıtlar `.local-sources/legal-watch`, rapor geçmişi `.local-reports` altında kalır. Bu dizinler Git dışında ve servis verilen `dist` dışında tutulur. Sunucu yalnızca `dist` içindeki gerçek dosyaları sunar; dizin listesi, üst dizine geçiş ve dist dışına çıkan sembolik bağlantılar kapalıdır. API başka origin'den gelen tarayıcı isteklerini kabul etmez; CORS açılmaz.

## Doğrulama

`npx vitest run tests/server.test.js` beş otomatik test içerir: şema/izinli konular, statik dosya/HEAD/yol güvenliği, origin/metot/boyut kontrolleri, eşzamanlılık/gerçek zaman damgalı önbellek ve başarısız rapor davranışı. Ağ çağrısı testlerde taklit edilir; bu testlerin geçmesi yeni bir resmî tarama yapıldığı anlamına gelmez.

6 Kasım 2026 `14:43:51.175907 UTC` tarihinde servis üzerinden gerçek tek-konu O02 taraması da çalıştırıldı: HTTP 200, ayrıştırma doğrulandı, sürüm 503, `TransportOnlyChanged`, `complete:true`. Bu yalnızca O02 kontrolüdür; diğer 22 kaynak bu servis denemesinde yeniden kontrol edilmiş sayılmaz. Ham yanıt ve rapor Git dışındaki özel dizinlerde tutuldu.
