# Tam yedek ve PDF raporu

`src/full-backup.ts` sürüm 1 biçimini uygular. Bu yedek yalnız cihazdan kullanıcının seçtiği dosyaya dışa aktarılır; ağ servisine gönderilmez. JSON içeriğinde çalışma geçmişi bulunur, bu nedenle dosya kişisel veri gibi saklanmalıdır. SHA-256 özeti bozulma kontrolüdür; imza, şifreleme veya resmî içerik onayı değildir.

```json
{
  "kind": "gys-full-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-11-06T12:00:00.000Z",
  "integrity": {"algorithm": "SHA-256", "payloadHash": "64 karakterlik küçük harfli hex"},
  "payload": {
    "legacyWorkspace": {"schemaVersion": 1, "state": {}, "questions": []},
    "journal": {"kind": "gys-study-journal", "schemaVersion": 1, "exportedAt": "2026-11-06T12:00:00.000Z", "attempts": []},
    "learning": null,
    "strict": null,
    "planner": null,
    "focus": null
  }
}
```

Bu örnekteki boş `state` yalnız alanları gösterir; içe aktarılabilecek geçerli ilerleme verisi değildir. Uygulama her alanın gerçek şemasını doğrular. Hesaplanan planın ayrıca kalıcı günlüğü yoksa `planner` null kalır. Bölümler desteklenmediğinde null kullanılır; dolu bir bölümün doğrulayıcısı bulunmuyorsa yedek reddedilir.

## Doğrulama

Tam dosyanın UTF-8 boyutu en fazla 32 MiB olur. Bilinmeyen tür/sürüm, eksik veya bilinmeyen üst alanlar, geçersiz tarihler, sonlu olmayan sayılar, tehlikeli özellik adları, hesaplanan özellikler, JSON dışı değerler, aşırı büyük/derin ağaçlar reddedilir. Nesne anahtarları sıralanarak oluşturulan canonical JSON üzerinde `payload` özeti hesaplanır; listelerin sırası korunur.

Eski ilerleme `storage.js` doğrulayıcısıyla, çalışma günlüğü `validateJournalBackup` ile doğrulanır. Sonuç sayıları soru ve kalıcı seçenek kimliklerinden yeniden denetlenir. Aynı çalışma kimliği farklı içerikle mevcutsa veya aynı eski soru kimliği farklı metin/seçenek/cevapla geliyorsa geri yükleme reddedilir. Birden fazla aktif konu çalışması reddedilir. İçe aktarılan eski soru bankasının `Approved` beyanları `ValidationPending` yapılır. Yedek, bir soru için yayın veya resmî kaynak yetkisi oluşturmaz.

`learning`, `strict`, `planner` ve `focus` için çağıranın sağladığı saf şema doğrulayıcıları kullanılır. Doğrulayıcı normalize edilmiş bir değer döndürüyorsa bu değer saklanır; assertion biçiminde çalışıyorsa kontrol edilen kopya saklanır. Bölümün kendi import işlemi de kaynak uygunluğu ve çakışmaları denetlemelidir.

## Güvenli profil etkinleştirme

`prepareFullRestore` depolamaya yazmaz. Tam dosyayı doğrular, inceleme sayıları ve yeni bir `profileId` üretir. Öneri ve inceleme verisi dondurulur; kayıt sırasında iç kopya kullanılır. Elle üretilmiş öneri nesnesi kabul edilmez.

Uygulama entegrasyonu şu sırayı izler:

1. Mevcut tam veriyi dışa aktarır; mevcut profil sürümünü kaydeder.
2. `prepareFullRestore(file, {current, validators})` ile tüm dosyayı doğrular ve kullanıcıya sonuçları gösterir.
3. Kullanıcının açık geri yükleme onayından sonra yeni `profileId` altında ayrı localStorage/IndexedDB adları oluşturur. Yeni alanları ve modül günlüklerini bu boş profile yükler; çalışan özgün alanlara yazmaz.
4. Bütün hazırlama işlemleri başarılıysa `commitPrepared(proposal, {approved:true, expectedRevision})` çağrılır.
5. Bu çağrı tamamlandıktan sonra uygulama adaptörlerini yeni profile geçirir. Sonraki açılışta `readActive()` etkin profil kimliğini verir.

`gys_full_workspace_v1` veritabanındaki tek `workspaces` transaction'ı tam snapshot ile etkin profil işaretçisini birlikte kaydeder. Önceki canonical kayıt `revision:N` olarak saklanır. Eşzamanlı iki geri yüklemeden eski revizyonu kullanan işlem reddedilir. Kota/yazma hatasında transaction geri alınır. Hazırlanan ayrı profil başarısızsa eski etkin profil değişmez; kullanılmayan hazırlık alanları kendiliğinden silinmez.

**Atomiklik sınırı:** localStorage ve birbirinden ayrı IndexedDB veritabanları tek transaction kapsamına giremez. Bu modül farklı eski depolara toplu atomik yazdığını iddia etmez; atomik olan etkin profil işaretçisinin ve snapshot'ın birlikte kaydıdır. `expectedRevision` diğer profil etkinleştirmelerine karşı korur; eski profil içinde devam eden bir çalışma için genel kilit değildir. Uygulama etkinleştirme sırasında çalışmayı durdurmalı, diğer sekmelerde yeni profil durumunu tekrar okumalıdır. Eski profil verileri korunur. Tarayıcı depolama temizliği veya cihaz kaybına karşı dosya yedeği gerekir.

## API

- `createFullBackup(input, {validators, exportedAt?})`: doğrulanmış tam dosyayı üretir.
- `validateFullBackup(input, {validators, current?})`: JSON metnini/nesnesini doğrular; yazmaz.
- `prepareFullRestore(input, {validators, current?})`: değiştirilemez öneri ve inceleme oluşturur; yazmaz.
- `createFullBackupStore(name?).readActive()`: etkin canonical profil veya null.
- `commitPrepared(proposal, {approved, expectedRevision})`: yalnız doğrulanmış öneriyi açık onayla etkinleştirir.
- `close()`: bağlantıyı kapatır; veri silmez.

Eski iki yedek türü geçerli eski araçlarıyla okunmaya devam edebilir. Bunlar yeni tam yedek gibi etiketlenmez. Gelecekteki şema sürümleri sessizce düşürülmez; açık göç uygulaması gerekir.

## PDF

`generateProgressPdf` çevrimdışı çalışabilen gerçek PDF baytlarını üretir. `downloadProgressPdf` bunları `application/pdf` dosyası olarak indirir. PDF kütüphaneleri ihtiyaç anında yüklenir. Türkçe karakterler yerel `public/fonts/DejaVuSans.ttf` yazı tipinin gömülen alt kümesiyle korunur; font lisansı aynı klasördedir. PWA önbelleği bu dosyayı içermelidir. İlk kurulumda yerel kaynaklar hiç yüklenmemişse çevrimdışı PDF üretimi garanti edilmez.

Raporda doğru/yanlış/boş, benzersiz çözüm, konu sonuçları, ilk/tekrar çözüm ayrımı, planın gerekçesi/süresi/soru sayısı, madde ve kaynak bağlantıları yer alır. Ölçülmeyen oranlar ve yetersiz tahminler sayısal sıfıra dönüştürülmez. Metin ve uzun bağlantılar A4 sayfalarına bölünür. Rapor özet niteliğindedir; soru bankası veya geri yükleme verisi içermez. **PDF geri yükleme kaynağı değildir.**

## Otomatik kontrol

`npx vitest run tests/full-backup.test.ts tests/report-export.test.ts` bozuk özet, sürüm/tür, şema, çakışma, onay, yarış, yazma hatası, veri kopyalarının izolasyonu, gerçek PDF, Türkçe Unicode haritaları ve sayfalama kontrollerini çalıştırır. Bunlar gerçek iPhone/Safari kabul testinin yerini tutmaz.
