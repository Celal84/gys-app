# Faz 0 — Mevcut proje ve kaynak erişimi

Tarih: 06.11.2026. Durum: **Faz 0 tamamlandı / Prototip**. MVP, 5.400 soru ve nihai kabul tamamlanmış değildir. Kullanıcının V4 şartnamesi esas alınmıştır.

## Doğrulanmış başlangıç bulguları

İlgili depo [Celal84/gys-app](https://github.com/Celal84/gys-app), başlangıç `main` commit'i `ab731aa` idi. Başlangıç çalışma ağacı temizdi; yalnız `index.html` ve `questions.json` vardı. Önceden kurulu yerel proje bulunmadı. Mevcut kod Alpine.js + Tailwind CDN + localStorage kullanıyordu; paket tanımı, test, CI, README ve çevrimdışı service worker yoktu.

Kodda konu/kategori seçimi, beş seçenekli öğrenme turu, açıklama, XP, seri, yanlış defteri, ses ve JSON import/export bulundu. “100 soru” düğmesi en fazla25 soru başlatıyordu; zamanlayıcı ve Strict Mode yoktu. Ölçülmemiş konu0, hiç veri yokken tahmin50 gösteriliyordu. Yedek yalnız JSON varlığı üzerinden kabul edilip mevcut veriyi kısmen değiştirebiliyordu. Zoom engellenmiş, konu listesi büyük zikzak düğümlerinden oluşuyordu.

Eski soru kayıtları:24 gömülü +26 dış JSON=50 kimlik. **50 özgün soru olduğu doğrulanmadı**. Aynı seçenek/cevap kümesi üzerinden16 tekrar adayı bulundu; anlamsal ve hedef bazlı tekrar incelemesi henüz tamamlanmadı. Hiçbir kayıtta bağımsız onay ve değişmez kaynak snapshot kanıtı yoktu. Özellikle dış JSON id5, Anayasa m.84 ve tek doğru seçenek yönünden incelenmeli; bu rapor ona hukuki doğruluk kararı vermez.

## Resmî duyuru ve dağılım

[Resmî ilan](https://kariyerkapisi.gov.tr/IlanDetay?i=232d3886-9af8-4b69-a802-b393f13a600d), kayıt `ILN00002918`. İlk HTML, JavaScript kabuğuydu; sayfanın kullandığı herkese açık resmî API'den ilan metni alındı. Kimlik veya gizli anahtar kullanılmadı.

- Bölüm6:100 soru;70 ortak+30 alan;150 dk;beş seçenek/tek doğru;eşit puan;yanlışların etkisizliği;60 eşiği.
- Bölüm7:27 Şubat2027,10.15,Ankara.
- Bölüm12:01.01.2027 sonrası mevzuat değişikliklerinin dikkate alınmaması.
- Kişisel85+ hedefi resmî kural değil, kullanıcı tercihidir.

[Resmî teknik dağılım PDF'si](https://kariyerkapisi.gov.tr/Ups/Evraklar/tekniksorulari011026.pdf) iki sayfa ve256.450 bayttır. Drive `Soru DAĞILIM.pdf` ile SHA-256 birebir eşleşti:

`48ec4152166be53f6582c6795d6b8c5e3eb3ae5f9e26a3ee383d595236cb98bb`

24 başlığın tamamı ve bütün ağırlıklar eşleşiyor. O01:97–126,O02:1–212. Diğer başlıklar için ayrıntılı hedef/madde kapsamı çıkarılmadı; tam mevzuat dosyası bulunması bütün maddelerin sınava dahil olduğu anlamına gelmez. Duyurunun ayrı yayın tarihi doğrulanamadı; başvuru başlangıcı yayın tarihi sayılmadı. Kesim tarihi gelecekte:mevzuat sürümü **hazırlık**, nihai sınav mevzuatı değil.

Yapılandırılmış kanıt:[official-verification.json](../data/official-verification.json). İlan API hamı/metni ve PDF'ler `.local-sources/` içinde saklandı.

## Drive erişimi ve ilk okuma

Yetkili Google Drive bağlantısı çalıştı; ortamda aynı OAuth erişiminin bulunacağı varsayılmadı. Özel dosyalar bağlantı aracı üzerinden alındı. Drive'a hiçbir yazma işlemi yapılmadı.

|Kaynak|Bulunan|Özgün bayt/hash|İlk metin çıkarımı|Hukuki/tam yapı onayı|
|---|---:|---:|---:|---:|
|Genel Yüzde70|16|16|16;1kalite sorunu|0|
|Teknik Yüzde30|8|8|8|0|
|Soru DAĞILIM.pdf|1|1;resmîyle aynı|1|Dağılım doğrulandı|
|Ayrı çıkmış soru arşivi|6 dosya|Yalnız envanter|Okunmadı|0|

İlerleme klasörü ID'si kök listesindeki doğrudan metadata kaydında görüldü; **kendi metadata/list/content çağrısı yapılmadan dal atlandı**. Alt içeriği okunmadı, indekslenmedi veya kullanılmadı. Ad tabanlı dışlama yok. Kodda aynı kural, doğrulanamayan üst klasörleri ve kısayolları takip etmeyen tarayıcıyla güvenceye alındı. Gerçek erişim dökümü oturum araç işlemlerinin kaydıdır; sağlayıcının audit log'u olduğu iddia edilmez.

Ortak15 DOC, gerçek OLE Word biçiminde; LibreOffice metin çıkarımı kullanıldı. Atatürk PDF'si75 sayfa ve metin katmanı ciddi OCR bozuklukları içeriyor; `PartialTextOcrQuality`. Teknik dörtDOC Word,üçDOC HTML, birPDF'dir. ÇED ve Planlı Alanlar çift kodlanmış HTML'sinde kayıpsız UTF-16/CP1254 dönüşümü uygulandı. Özgünler korundu; teknik HTML/DocBook yapı kopyaları saklandı. Dipnot/tablo/bent ve sayfa konumlarının tam görsel denetimi yapılmış sayılmaz.

24 dosyanın başlığı24 konuyla eşleştirildi. O01/O02/O03 kaynakları sınav kapsamından geniş; sınır filtrelemesi gerekir. Dosya sürümü sağlayıcıdan gelmediği için uydurulmadı; özgün SHA-256 ile snapshot sürümü tutuldu. Yayın/yürürlük/geçiş ve hukuk sürümü incelemeleri bekliyor.

Ayrıntılar Git dışında `.local-sources/drive-inventory.json`, `common-read-report.json`, `technical-read-report.json`, `source-access-log.json`. Uzak depoya özel kaynak içerikleri aktarılmadı. Ortam kaybolursa yeniden yetkili indirme gerekir.

## Güvenli ilk geliştirmeler

- Mevcut Alpine motoru korundu; React'e gereksiz yeniden yazım yapılmadı. Vite, yerel Tailwind/Alpine paketleri ve TypeScript güvenilirlik çekirdeği eklendi.
- 24 kanonik konuID ve sabit70/30;eski konu adları ilerleme anahtarı olarak korundu. Önceki özel ağırlıklar saklanır fakat resmî dağılımı değiştirmez.
- Kaynak hash/snapshot ve bağımsız kontrol kanıtı isteyen yayın kapısı;kalıcı seçenekID;madde sınırı ve tam deneme dağılımı denetimleri eklendi. Kontroller hukuki doğruluğu kendi başına ispatlamaz.
- Eski/import edilen içerik yayımlanmaz. Onaylı paket boş olduğundan konu çalışması ve tam deneme kapalı; kullanıcıya gerekçesi gösterilir. Yanlış25 soru denemesi kaldırıldı,Strict Mode tamamlandı iddiası yok.
- Ölçülmeyenler `Ölçülmedi`;tahmin `Veri yetersiz`. Eski tekrarları ayıramayan istatistikler öğrenme hâkimiyeti/puan tahmini sayılmaz. Uygulama açılışı çalışılmış gün sayılmaz.
- Eski localStorage anahtarları okunur, üzerine yazılmaz/silinmez. Yeni sürümlü tek zarf,şema/çakışma kontrolü,geri alma kopyası,önce doğrulama sonra kayıt sayılı restore onayı eklendi. Geçersiz toplu import veya yazma hatası bankayı kısmen değiştirmez.
- Kompakt slate/teal mobil arayüz;~59px konu satırları;44px dokunma hedefleri;zoom/metin seçimi ve ölçülmeyen durumlar düzeltildi. Silme ve ağırlık düzenleme kontrolleri kaldırıldı.
- Üretim PWA çevrimdışı kabuğu ve yerel varlıklar eklendi. İlk çevrimiçi yükleme sonrası Chromium çevrimdışı yeniden açılış geçti. Mevzuat izleme veya onaylı soru içeriği sağladığı iddia edilmez.
- Otomatik test,CI tanımı,çalıştırma talimatları ve kalıcı devam kayıtları eklendi. Canlı yayın ve uzak depo değişikliği yapılmadı.

## Soru ve kapsam durumu

|Gösterge|Sonuç|
|---|---:|
|Bu fazda üretilen özgün soru|0|
|Kaynakla doğrulanan soru|0|
|Onaylanan soru|0|
|Reddedilen soru|0|
|İnceleme bekleyen eski kayıt|50|
|Kabul edilen tarihî soru|0;envanter incelemesi bekliyor|
|Başlık/kaynak eşleşmesi|24/24|
|Tamamlanmış öğrenme hedefi haritası|0/24 konu|
|Son başarılı mevzuat nöbeti|Henüz yok|

## Bağımlılık sırasıyla sonraki plan

1. **Faz 1'i bitir:**Atatürk OCR onarımı veya resmî/okunabilir alternatif kaynak;DOC/PDF tablo,dipnot,bent/sayfa karşılaştırması;eksik metadata ve sürüm raporu.
2. **Faz 2:**24 konunun kaynaklı alt kapsamı,öğrenme hedefleri,resmî mevzuat sürümleri,yayın/yürürlük/geçiş tarihleri. Önce O01/O02 sınırları ve kapsam dışı bölümler ayrılır.
3. **Faz 3:**Önce küçük bir gerçekten doğrulanmış konu paketi;resmî hükümle ayrı kontrol,yayın kararı;IndexedDB kayıt/oturum sürümleme ve kalıcı sonuç/yanlış defteriyle kullanılabilir MVP.
4. **Faz4:**Arşivdeki kitapçık/anahtar/hak/tür/kapsam/tekrar/eski-yeni hukuk incelemesi;480/580 varsayımı yapılmaz.
5. **Faz5–6:**Kademeli2400bankasorusu ve korunan3000denemesorusu;tam100/150 Strict Mode kabulü.
6. **Faz7–9:**SM-2,analiz,planlama,tahmin kalibrasyonu,nöbetçi;gerçek iPhoneSafari ve nihai içerik kabulü.

Şu anda kullanıcı kararı gerektiren OAuth/erişim/yıkıcı işlem engeli yok. OCR ve hukuki doğrulama işleri bağımsız sürdürülebilir. Test sonuçları ve açık sınırlamalar [QA_REPORT.md](QA_REPORT.md) içindedir.
