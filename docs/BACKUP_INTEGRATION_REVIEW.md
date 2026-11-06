# Yedek entegrasyonu bağımsız incelemesi — 6 Kasım 2026

İncelenen alanlar: tam dosya doğrulaması, yeni profil hazırlama, etkin profil işaretçisi, eski depoların izolasyonu, Alpine reaktivitesi, Strict Mode içe aktarma yetkisi ve yerel servisin dosya erişimi. Bu belge sınırlı kod incelemesidir; gerçek iPhone/Safari kabulü değildir.

## Doğrulanan davranışlar

- Geri yükleme önerisi, normalize edilmiş verinin ayrı kopyasıyla hazırlanır. Dondurulmuş öneri Alpine'ın kullandığı Vue 3.1.5 reaktivitesinde aynı nesne olarak kalır. WeakMap kimlik kontrolü arayüzdeki reaktif nesne nedeniyle bozulmaz; ayrı regresyon testi gerçek engine ile commit çağrısını doğrular.
- Yeni profil adaptörü mevcut v1/v4 kayıtları üzerinde yazmaz. İlk açılışta doğrulanmış snapshot'tan okur; sonraki yazılar `gys-profile:<profileId>:` alanına gider. Ayrı test eski v1 ve v4 baytlarını değişmez bulur.
- Modül veritabanları yeni profil kimliğiyle hazırlanır. Başarısız hazırlama etkin işaretçiyi değiştirmez. İşaretçi ve canonical snapshot tek IndexedDB transaction'ında kaydedilir; önceki canonical revision tutulur. Mevcut testler CAS yarışı ve kota/yazma hatasında rollback davranışını doğrular.
- İçe aktarılan soru onayı yayın yetkisi değildir. Çalışma kayıtları gerçek soru/cevap/kaynak baytlarıyla, Strict Mode kayıtları yayımlanmış paketle eşleşmeden tahmin ölçümüne alınmaz. Bilinmeyen aktif deneme korunur ve öğrenme başlatılması engellenir.
- Yerel servis yalnız `dist` dosyalarını sunar; private rapor ve kaynak dizinleri sunulan kökün dışındadır. Dosya yolu ve sembolik bağlantı denetimi vardır. API kullanıcı ilerlemesini veya Drive verisini almaz.

## İncelemede bulunan düzeltmeler

1. Tam yedek üretimindeki `getLegacy` çağrısı güncel ayarları alırken güncel `hearts` değerini başlangıç durumundan okuyordu. Eski yedek aracı güncel değeri alıyordu; iki çıktı eşitlenmelidir. Bu alan ölçme kanıtı değildir, ancak tam yedeğin güncel ayar durumunu yansıtması gerekir.
2. `openStrictResult` tamamlanmış bir içe aktarımı paket yetkisi kontrolü olmadan gösterebiliyordu. Tahmin motoru bu kayıtları filtrelese de sonuçta “İlk bağımsız çözüm” etiketi güvenilir kaynakla doğrulanmış ölçüm izlenimi yaratabilir. Kayıt silinmeden kaynak doğrulama uyarısı gösterilmeli ve bağımsızlık etiketi doğrulanmış kayıtlarla sınırlandırılmalıdır.

3. Konu çalışmasını sürdürmedeki eski elle yazılmış karşılaştırma ile yeni ortak içerik yetkisi denetimi arasında metadata farkı bulunuyordu: eski karşılaştırma mevzuat sürümü/öğrenme hedefi/zorluk/bilişsel tür/çeldirici kavramlarını kontrol etmiyordu. Doğru cevap ve kaynak bağlantısı korunuyordu, ancak içe aktarılmış farklı kavram etiketleri hata analizini etkileyebilirdi. Ortak denetim kullanılması ve hata kavramının yayımlanmış soru paketinden okunması önerildi.

Bu bulgular uygulama sahibine iletildi. Son düzeltme durumu ana QA raporunda belirtilmelidir; bu inceleme tek başına bütün entegrasyonun kusursuz olduğu iddiası değildir.

## Sınırlar

Web Locks bulunmayan tarayıcıda profil kontrolü ve sonraki farklı veritabanı yazısı tek atomik işlem değildir. Eski sekme eski profilin alanlarına yazabilir; yeni profil alanlarına yönlenmez. BroadcastChannel ve revizyon kontrolü yenileme uyarısı verir. Ayrı veritabanları arasında atomiklik iddia edilmemelidir. Fiziksel olarak tutulan önceki profiller için kullanıcıya profil seçme aracı henüz sunulmuyorsa kurtarma geliştirici desteği gerektirebilir.

CSP için yeni header eklenmedi. Arayüz metinleri `x-text` ile gösterilir; bağlantı şemaları modül şemalarında denetlenir. Alpine'ın mevcut normal derlemesi dinamik değerlendirme kullandığından sıkı CSP'yi test etmeden eklemek çalışan arayüzü engeller. Yerel serviste `nosniff` ve Referrer-Policy mevcut.

## Test sonucu

```sh
npx vitest run tests/backup-profile-review.test.js tests/full-backup.test.ts tests/content-authority.test.ts
```

13 test geçti (yeni entegrasyon inceleme testleri 2, tam yedek 9, içerik yetkisi 2). Ağ ve gerçek iPhone kabul testi bu sayıya dahil değildir.
