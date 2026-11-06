# T01 konu bankası bağımsız incelemesi

6 Kasım 2026 tarihinde 100 adet `ValidationPending` T01 adayı, üretimden ayrı inceleme işlemiyle resmî hüküm, seçenek, cevap, açıklama, çeldirici, hedef ve kapsam açısından okundu. Sonuç 100 `Pass`, 0 `NeedsReview`, 0 `Rejected` kararıdır. İnceleme soruları yayımlamaz: bağımsız kararın yanında yayıncının gerçek dosya hashleri, kaynak alıntıları ve kuralları doğrulaması gerekir. Bu rapor insan incelemesi veya kesin 2027 hukuk sürümü onayı değildir.

Makinece okunabilir kararlar [t01-bank-review.json](../data/reviews/t01-bank-review.json), bütünlük sonuçları [t01-review-integrity.json](t01-review-integrity.json) içindedir. Son aday dosyası SHA-256: `8a50db2e69dc8c0ff16e11b162fbc7c338cbafd3026df57137308dc17b077763`; kurallar SHA-256: `c1ca5b7fab30fd00e354c63f556d8fead9e07767f59c1f85fae8566669a70363`.

## Kaynak ve kapsam

Asıl metin [Adalet Bakanlığı UYAP, 5543 sayılı İskân Kanunu](https://mevzuat.adalet.gov.tr/mevzuat/103146) kaydıdır. Ham API cevabı ile içindeki base64 içeriğin çözüldüğü HTML, saklanan iki artifact ile byte düzeyinde eşleşir. Üç dosya hash kontrolü (ham cevap, tam HTML, seçilmiş hüküm JSON'u), iki byte uzunluğu kontrolü ve ham-cevap/HTML ilişkisi ayrıca doğrulandı. Üretimde kullanılan `lxml` yerine Python standart kütüphanesinin `html.parser.HTMLParser` sınıfıyla 399 HTML paragrafı bağımsız ayrıştırıldı; seçilmiş 65 paragrafın metin ve hashlerinde fark görülmedi. Dipnot işaretleri atılmadı.

Resmî teknik müfredattaki T01 satırı ve SHA-256 değeri, salt okunur yerel resmî PDF ile doğrulandı. Kullanıcının izinli teknik kaynak PDF'sinin ve çıkarılmış metninin hashleri ile seçilmiş 27 madde başlığı ayrı karşılaştırıldı. Özel kaynak metni bu rapora veya sorulara kopyalanmadı. Dışlanan İlerleme klasörüne erişilmedi.

Yalnız 3, 4, 5, 8, 9, 10, 11, 12, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 27, 28, 29, 30, 34, 36, 39, 40 ve 41'in seçilmiş 100 hedefi için hazırlık paketi kapsam eşlemesi kabul edildi. Bu karar bu maddelerin bütün fıkralarını veya Kanunun bütününü otomatik sınav kapsamına almaz. Mülga m.13 ve m.27/5, m.37'de eski 1111 sayılı Kanuna atıf ve çözümlenmemiş geçiş süreleri soru yapılmadı. Ek m.2'nin DSİ rejimi, m.19 yetki sorularında açıkça hariç tutuldu. Kamulaştırma senaryosunda DSİ barajı yerine karayolu projesi kullanıldı.

## Düzeltmeler ve kalite

- Q33 önceki Q5 tekrarı yerine m.8/2'deki ivedi ödenek aktarımı hedefini ölçer.
- Q83'te soy ve kültür koşullarının birlikte aranması, m.4'ün olumsuz lafzından çıkarılmak yerine açık m.3/d tanımına dayandırıldı; madde, hedef, alıntı ve kural birlikte güncellendi.
- Q88'in m.12/1 alıntısı için kaynak JSON'unda eksik kalan (a) bendi, değiştirilmeyen tam resmî HTML'nin 74'üncü paragrafından eklendi. Alıntı konumu 73–76 olarak düzeltildi ve kaynak JSON'u hash değeri yeniden hesaplandı. Sadece alıntının kendi hashinin doğru olması yeterli kabul edilmedi.
- 40 soruda toplam 160 çeldirici, ilgisiz meslek/turizm/renk gibi ipuçları yerine yakın hukuki süreç, makam, koşul veya sonuç karışıklıklarıyla değiştirildi; dört çeldiricinin açıklaması da seçenekle birlikte düzeltildi.
- Q80 kökü ve Q95 doğru seçeneği dilsel belirsizlikten arındırıldı.
- Doğrudan hüküm hatırlama soruları yalnız üretim kotası için zor sayılmadı. Son öneri dağılımı 42 temel, 30 orta, 8 zor, 20 uygulamadır. Yirmi soru gerçek kısa olay içerir. Başlangıçtaki 25/30/25/20 zorluk hedefi karşılanmadı; sahada ölçülmüş güçlük veya ayırt edicilik iddiası yoktur.

100 T01 sorusu, mevcut 100 O02 ile O01/O03'ün 200 adayıyla metin karşılaştırmasından geçirildi. T01'in 100 hukuki bilgi/koşul/sonuç ve bilişsel işlem hedefi ayrı okundu. Aynı maddenin farklı bilgisi veya farklı uygulama işlemi tekrar sayılmadı. Gözlenen tam metin tekrarı ve aynı bilgi/aynı işlem tekrarı yoktur. En yüksek konu dışı kelime Jaccard benzerliği yaklaşık %26,1'dir (Q-T01-B-0043 / Q-O02-B-0067); biri aynî/nakdî tarımsal kredi, diğeri kaldırılan kadro sonrası atama ölçer. Bu işlem embedding modeli veya anlamsal benzersizliğin istatistiksel ispatı değildir. Gelecekteki yeni içerikle küresel tekrar denetimi yine gerekir.

## Kontrol sonucu ve sınırlar

Toplam 31.867 mekanik doğrulama koşulu hatasız geçti; bu sayının 30.000'i 100 T01 ile 300 diğer aday arasındaki tam metin karşılaştırmalarıdır. Bu sayı 31.867 bağımsız hukuk incelemesi anlamına gelmez. Kalan kontroller seçenek kimlikleri, beş farklı seçenek, dört çeldirici ilişkisi, cevap metni, alıntı ve kaynak hashleri, paragraf konumu, hedef/madde eşleşmesi ve seçilmiş başlıklar üzerindedir.

Kaynak hazırlık sürümüdür. 1 Ocak 2027 kesim tarihi henüz gelmediği için nihai sınav sürümü kabul edilmez. Güncel hazırlık sürümünün daha sonraki resmî değişikliklerle yeniden doğrulanması ve 2027 sürümünün ayrıca sabitlenmesi gerekir. Kullanıcının tüm öğrenme hedeflerinde hâkimiyet kazanmış olduğu veya T01'in tamamının kapsandığı sonucu çıkarılmaz.
