# O02 soru bankası genişletmesi — bağımsız inceleme

İnceleme: 2026-11-06T14:24:50.718Z. Üreticiden ayrı süreçte, resmî hüküm ve bağlam okuması yapıldı. İnsan incelemesi yapılmadı. Bu rapor yalnız 06.11.2026 hazırlık sürümündeki kontrollü yayına dayanak olabilir; 01.01.2027 kesimi veya nihai sınav mevzuatı kabulü değildir.

82 yeni adayın tamamı son metni üzerinden Pass aldı. İnceleme bekleyen veya reddedilen son aday yoktur. Önceden onaylı 18 soru ile birlikte O02 konu bankası için 100 soru oluşur; yayın kapısının kaynak, kural ve dosya özeti kontrolleri ayrıca geçmelidir. Bu inceleme soruları doğrudan Approved yapmadı. Diğer 23 konu veya 30 tam deneme tamamlanmış sayılmaz.

## Kaynak ve bağlam

Resmî kaynak: [Adalet Bakanlığı UYAP 657 metni](https://mevzuat.adalet.gov.tr/mevzuat/102924). Snapshot: SRC-OFFICIAL-657-UYAP-20261106-e179523117a8. Üretici HTMLParser yerine bağımsız lxml.html ayrıştırması kullanılarak 117 HTML madde arşivi, 117 ham madde cevabı, ham tam belge, çözülmüş tam HTML ve provision JSON özeti kontrol edildi: 237 hash kontrolü. 975 paragrafın metni ve sırası yeniden karşılaştırıldı, tümü tam resmî belgede bulundu; fark yoktur.

Her sorunun alıntısı, ilgili maddenin sonucu etkileyen bağlamı, istisnaları ve gerekli madde göndermeleri ayrıca okundu. Uzun 36. maddede özellikle I/II hizmet sınıfları ve seçeneklerin ilgili komşu sınıfları incelendi. Bu, 1–212 aralığındaki bütün hükümlerin veya kaynak envanterindeki 117 maddenin bütün hukuki sorunlarının onaylandığı anlamına gelmez. Yeni sorular 74 farklı maddeyi ve 82 ayrı hedefi ölçer; 100 soru çözmek O02 kapsamının tamamına hâkimiyet kanıtı değildir.

2026 değişiklikleri özellikle m.56 (uyarma/kınama eşiği), m.68 (yürürlükteki atama düzeni), m.104 (8+16 haftalık normal analık izni) ve m.127 (yargı iptali sonrası yeniden tesis süresi) üzerinden okundu. Güncel hazırlanma snapshot bilgisi ile nihai sınav sürümü ayrıldı. Yayımlanma ve yürürlük tarihi bu raporda birbirinin yerine geçirilmedi; genel geçiş hükümleri kabulü yapılmadı.

## İnceleme sırasında düzeltilenler

- Q0052: Pazartesi tebliğinden sonra salı başlangıcı için eksik olan hesap devri ve eski göreve yazılı devam istisnaları kökte açıkça dışlandı. İzin, rapor, geçici görev ve olağanüstü hâl de dışarıda tutuldu.
- Q0067: Kadrosu kaldırılan memurun kurumunda atama imkânı yoksa başka kuruma bildirim yapılması, doğru seçenekte açık koşul hâline getirildi. Mali ve sosyal hakların devamı korundu.
- Q0030, Q0031, Q0036, Q0045, Q0053, Q0057 ve Q0098: Doğrudan hatırlama veya sınırlı eşleştirme sorularının zor etiketi orta düzeye indirildi. Sayısal kotayı doldurmak için yapay zorluk atanmadı.
- Q0025, Q0052, Q0053, Q0058, Q0065, Q0069, Q0070, Q0075 ve Q0087: Arada paragraf atlanarak birleştirilen alıntılar, en küçük–en büyük kaynak paragrafı arasındaki bütün paragrafları içerecek şekilde genişletildi. Son alıntılar kesintisiz resmî metinle yeniden eşleştirildi.

## Soru ve özgünlük denetimi

Her soruda beş farklı seçenek, bir kalıcı doğru seçenek kimliği, dört ayrı çeldirici açıklaması ve yanlış kavram tanımı kontrol edildi. Senaryolarda sonucu değiştiren koşullar ve istisnalar incelendi. Örneğin m.11 suç emri/yazılı ısrar, m.62 genel/özel süre başlangıcı, m.104 tekil/çoğul ve süre aktarımı, m.143 zorunlu kesinleşme/m.144 erken takdir ayrımları korundu.

100 sorunun normalize metinleri karşılaştırıldı; metinsel tekrar görülmedi. Öğrenme hedefi, hukuki koşul, sorulan sonuç ve bilişsel işlem bakımından ayrı model destekli anlam incelemesi yapıldı. Aynı madde grupları özellikle kontrol edildi: m.11 (suç olan/olmayan emir), m.28 (aile bildirimi/kooperatif istisnası), m.56 (disiplin eşiği/yeniden alınma süresi), m.62 (ertesi iş günü/izin bitimi), m.64 (tanım/cezasız ilerleme), m.104 (analık/babalık), m.108 (izin koşulları/erken dönüş), m.145 (disiplin üst süresi/ceza kovuşturmasında inceleme). Yeni adaylarda aynı bilgiyi yalnız farklı kelimelerle tekrarlayan soru saptanmadı. Bu, matematiksel bir anlamsal benzersizlik ispatı veya embedding denetimi değildir.

Yeni paket: 20 temel, 30 orta, 15 zor, 17 uygulama; 17 senaryo (%20.7). %10 senaryo hedefi sağlanır. Zorluklar içerik temelli ön sınıflamadır; gerçek kullanıcı verisiyle madde güçlüğü ve çeldirici işleyişi henüz ölçülmedi. 25/30/25/20 başlangıç hedefi tam tutturulmuş gibi sunulmaz.

## Son dosyalar

- Aday SHA-256: 38ec0a34fe8f05f15e43ee4d2e5abbf4cd0294dec5eaa870f2923862f5209603
- Kural SHA-256: 687fc2a39c135f71bb4253a97d2c44b055cdd6a2d881fa8760a11bd3dd01ebe2
- Makine incelemesi: [o02-bank-extension-review.json](../data/reviews/o02-bank-extension-review.json). Her soru için hash, karar, ayrı inceleyici kimliği, zaman, alıntı, konum ve gerekçe vardır.
- Kaynak bütünlüğü: [657-extension-source-audit.json](../data/public-legal-sources/657-extension-source-audit.json). Üreticinin ayrı kurallı kontrol raporu: [657-extension-checks.json](../data/public-legal-sources/657-extension-checks.json).

Son aday için bağımsız tekrar kontrolünde kapsam/seçenek/kural/alıntı/çeldirici açıklaması veya erken onay beyanı hatası bulunmadı. Yayın işini proje ana süreci yapar. Soru veya kaynak değişirse soru hash’i değişir; bu karar yeni sürüme otomatik taşınamaz.
