# O03 Anayasa konu bankası: ayrı inceleme

6 Kasım 2026 tarihinde üreticiden ayrı süreçle 100 adayın tamamı okundu. Karar, resmî kaynağa bağlı **hazırlık içeriği** için 100 Pass / 0 NeedsReview / 0 Rejected'dır. Aday dosyası kendiliğinden Approved yapılmadı; yayıncı ayrı inceleme ve yeniden üretilebilir kaynak/cevap kontrolleri birlikte geçmeden yayımlayamaz.

İnceleme yapay zekâ desteklidir; insan onayı veya 1 Ocak 2027 kesim tarihindeki nihai mevzuat kabulü değildir. 100 soru, konunun bütünü veya bütün öğrenme hedeflerinin kabul edildiğini göstermez.

## Kaynak ve kapsam

Kaynak, Adalet Bakanlığı UYAP'ın 103165 kimlikli Anayasa belgesinin saklanan tam resmî HTML içeriğidir. Raw yanıt hash'i `92878aae23720d0828f3fc21c3c16968208371f8a2fc1feb1f8505d90de4a9ad`, decoded HTML hash'i `f3619ac0e027047a0e593e0eca5075bcdbcf5c093af8a6a429430c5159a3b328` olarak doğrulandı. API'nin Base64 içeriği ile saklanan HTML'nin birebir aynı olduğu kontrol edildi. Yanıttaki eski Windows-1254 bildirimi yerine gerçek UTF-8 baytlar esas alındı.

Üreticinin html.parser ayrıştırmasına karşı ayrı lxml.html ayrıştırmasıyla **817 paragrafın tamamı**, 1 tabanlı paragraf konumu, metin ve metin hash'i üzerinden karşılaştırıldı; 0 fark bulundu. Toplam **1.628 mekanik kontrolün tamamı geçti**. Bunlar tek başına hukuki onay sayılmadı; ayrıca bütün soru kökleri, beş seçenek, cevap, çeldirici ve açıklamalar okundu.

Resmî müfredatın adlandırdığı kısımlar, tam HTML'deki p[23] Genel Esaslar, p[69] Temel Haklar ve Ödevler ve p[481] Cumhuriyetin Temel Organları başlıklarıyla eşleştirildi. Mali ve Ekonomik Hükümler p[1029]'da başlar. Yalnız m.1–160 arasındaki seçili öğrenme hedeflerine ait soru kararları kaydedildi. M.161 ve sonrası veya geçici/yürürlük hükümleri otomatik kapsam sayılmadı. Her review kaydı kendi madde, hedef ve kapsam kanıtını içerir.

## İçerik incelemesi ve düzeltmeler

Önceki kontrolün işaretlediği iki O02 bilgi tekrarı, son adayda farklı hedeflere dönüştürülmüş olarak doğrulandı: Q89, AYM Genel Kurulunun toplantı yeter sayısını; Q99, ceza sorumluluğunun şahsiliğini sorar. Q56 anayasal üst sınırı CMK'daki daha kısa süreden açıkça ayırır. Q58'de kaynakta yazmayan süre başlangıcı iddiası yoktur. Q59 ara seçim istisnalarını, Q64 bütçe ve anayasa değişikliği özel rejimlerini, Q94 Türk kanunlarını değiştiren andlaşma durumunu kökte sınırlar.

22 sorudaki zayıf çeldiriciler, ilgili hukuki koşulu daraltan veya başka norm/merci/ölçütle karıştıran seçeneklerle değiştirildi. Doğrudan bilgi hatırlamaya dayanan bazı soruların zorluğu yeniden etiketlendi. Son dağılım **35 temel, 38 orta, 7 zor, 20 uygulama** ve **20 senaryo**dur. Başlangıç zorluk hedefini sayısal olarak tutturmak için kolay sorulara zor etiketi verilmedi; bu bir istatistiksel madde güçlüğü kalibrasyonu değildir.

100 O02 banka sorusu ve 100 O03 banka adayı; sorgulanan bilgi, hukuki koşul, sonuç ve bilişsel işlem yönünden karşılaştırıldı. Son hâlde metinsel, anlamsal veya aynı hedef/işlem tekrarı gözlenmedi. Aynı maddeden farklı bilgi ölçen sorular ayrı tutuldu; örneğin m.18 genel angarya yasağı ile OHAL hizmet istisnası, m.28 sansür yasağı ile basımevi kuruluşu ayrıdır. Bu gözlem bir embedding testi veya matematiksel benzersizlik ispatı değildir.

O03 korunan A120 adayları bu banka kabulüne dahil değildir; ayrı inceleme bekler. İleride eklenecek diğer konu ve havuzlarla çapraz benzersizlik yeniden kontrol edilmelidir.

## Değişmez inceleme çıktıları

- Aday: `data/content-candidates/o03-bank.json`
- Aday dosyası SHA256: `a8fac105027e90bac4c32dc6609836f521c9f5dc7d2cee676f06db1d6bbfc884`
- Kural dosyası SHA256: `b28bdde538f2505680721aea64217697959a6a0e222351b301addc10c9016671`
- Soru bazlı inceleme: `data/reviews/o03-bank-review.json`
- Ayrı kaynak bütünlüğü raporu: `data/reviews/o03-source-independent-audit.json`

Her soru kaydında JSON.stringify üzerinden aday hash'i vardır. Aday veya kural dosyası değişirse mevcut review sessizce yeniden kullanılamaz.
