# 657 sayılı Kanun: resmî kaynak alımı

06.11.2026 tarihinde T.C. Adalet Bakanlığı UYAP Mevzuat ve İçtihat Programı'nın sunduğu 657 sayılı Kanun tam metni alındı. Bu bir **hazırlık sürümüdür**. 01.01.2027 kesim tarihine henüz ulaşılmadığından nihai sınav mevzuatı olduğu ileri sürülmez.

- Belge: <https://mevzuat.adalet.gov.tr/mevzuat/102924>
- Resmî sitenin kullandığı içerik hizmeti: `POST https://bedesten.adalet.gov.tr/mevzuat/getDocumentContent`
- İstek gövdesi: `{"data":{"documentType":"MEVZUAT","id":"102924"},"applicationName":"UyapMevzuat"}`
- Kimlik doğrulama: gerekmedi; token veya erişim sırrı gönderilmedi.
- Gerçek alım: `2026-11-06T12:26:39.739481+00:00`
- Tam ham API yanıtı: 2.367.404 bayt; SHA256 `e179523117a8b6c1d8addc4f4151b6410320be70ce14d9f4146c34ac162b26c0`.
- Yanıtın Base64 çözülmüş HTML içeriği: 1.775.335 bayt; SHA256 `b4645c93cb71d5f50a14af49425ac1f226473e0e7d5fe40db921ae12f3cbb50e`.
- Snapshot: `SRC-OFFICIAL-657-UYAP-20261106-e179523117a8`.

Tam ham yanıt, tam HTML, madde ağacı, belge kaydı ve tekil madde yanıtları `.local-sources/official-law-657/snapshots/e179523117a8b6c1d8addc4f4151b6410320be70ce14d9f4146c34ac162b26c0/` altında hash adresli, salt okunur yerel arşivde saklandı. Bu özel arşiv Git kapsamı dışındadır. HTTP oturum çerezleri kamuya açık dosyalara taşınmadı.

## Kapsam ve çıkarım

O02 kapsamında 3, 54, 94, 95, 96, 102, 125, 129, 130 ve 135. maddeler tam olarak çıkarıldı. Başlıklar, madde numaraları, dipnotlar ve istisnalar korundu. Bu seçim, O02'nin bütün kapsamının veya 24 konunun tamamının eşlendiği anlamına gelmez.

238. madde yalnız yürürlük bilgisi incelemesi için ayrıca saklandı. Bu madde mülgadır, sınavdaki 1–212 sınırı dışındadır ve `examScope: false`, `scopeUse: MetadataOnlyNotQuestionScope` olarak işaretlendi. Soru üretiminde kullanılamaz.

`data/public-legal-sources/657-provisions.json` kaynak snapshot'ını, tam seçili madde metinlerini, paragraf sırasını, dipnotları ve paragraf hashlerini içerir. HTML kaynağının PDF sayfası bulunmadığı için resmî madde kimliği ve `HTML p[n]` konumları kullanılır. Yalnız boşluk normalizasyonu yapılır; eski yazım biçimleri düzeltilmez.

Seçili resmî madde HTML'lerinin gerçek baytları kamuya açık hash adresli arşivde tutulur: toplam 11 dosya, 35.898 bayt. `data/public-legal-sources/657-source-audit.json` her dosyanın yolunu, hashini, boyutunu ve 122 paragrafın kontrol sonucunu kaydeder. Böylece seçili kaynaklar ağ erişimi olmadan tekrar denetlenebilir.

## Tarihler ve hukuki sürüm sınırı

Kanunun kabul tarihi 14.07.1965, ilk Resmî Gazete yayımı 23.07.1965, sayı 12056'dır. Yayım tarihi, bütün maddelerin yürürlük tarihi olarak kullanılmadı. İlk yürürlük ve bütün tarihsel geçiş hükümleri bu alımda bağımsız olarak yeniden kurulmadı; bilinmeyen alanlar `null` ve açıklamalı durumlarla korunur.

UYAP belge kaydı ve madde ağacında 31.07.2026 kayıt/güncelleme bilgisi gözlenir. Bu teknik tarih, düzenlemelerin yayımlanma veya yürürlük tarihi değildir. Tam metin 7573, 7578 ve 7590 sayılı kanunlarla 2026'da yapılan değişiklikleri içerir; resmî metnin ekindeki yürürlük tablosu ayrıca korunmuş tam kaynakta bulunur. Güncel hizmetin bugün sunduğu sürümün alınması, gelecekteki kesim tarihinin kesinleştirilmesi anlamına gelmez.

`mevzuat.gov.tr` üzerindeki kanonik PDF ve küçük harfli yol denemeleri içerik gelmeden zaman aşımına uğradı. OGM'nin 2024 tarihli resmî PDF kopyası ve TBMM'nin 2024 derlemesi karşılaştırma için yerelde saklandı; güncel kaynak olarak kullanılmadı. Kullanılan asıl kanıt, yukarıdaki resmî Adalet/UYAP hizmetinden bugün alınan içeriktir.

## Kontroller ve onay sınırı

Yerel kaynak bütünlüğü kontrolünde 40 kontrol geçti, 0 hata bulundu. Tam yanıt ve çözülmüş HTML hashleri, 11 tekil madde hashleri, 122 paragrafın çıkarımı, kapsam sınırı ve kamuya açık dosyada erişim sırrı bulunmaması kontrol edildi. Sonuç `data/reviews/657-source-extraction-audit.json` dosyasındadır.

Bu rapor soru onayı vermez. Kaynak alımı ve alıntı eşleşmesi; tek doğru cevap, çeldirici kalitesi, benzersizlik veya bağımsız hukuki incelemenin yerine geçmez. Soru üreticisi, ayrı soru inceleyicisi ve kural tabanlı yayımlama denetimi bu rapordan ayrı çalışır. Gerçek iPhone/Safari veya insan hukuk uzmanı incelemesi yapıldığı iddia edilmez.
