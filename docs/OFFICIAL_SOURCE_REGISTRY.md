# Resmî mevzuat kaynak kaydı

06.11.2026 tarihinde kalan **22 mevzuat konusu** için resmî kaynak kimliği, tam kaynak snapshot'ı ve seçili taslak maddelerin başlıkları kaydedildi. Mevcut 657 kaynağına yapılan atıfla birlikte 23 mevzuat konusu kayıtlıdır. Atatürk İlkeleri ve İnkılap Tarihi mevzuat olarak sınıflandırılmadı; resmî tarih kaynakları ayrıca inceleme bekler.

Makinece okunabilir kayıt: [`data/official-source-registry.json`](../data/official-source-registry.json).

Bu kayıt **Faz 2'nin kaynak kimliği ve başlık eşleştirme bölümünü ilerletir**. Tam öğrenme hedefi kapsamının, hukuki yürürlük/geçiş incelemesinin veya nihai sınav mevzuatının tamamlandığı anlamına gelmez. Bu işlem soru üretmedi ve soru onayı vermedi. Mevcut 657 soru ve kaynak dosyaları değiştirilmedi.

## Kaynak ve snapshot yöntemi

Kaynak, T.C. Adalet Bakanlığı UYAP Mevzuat ve İçtihat Programı'dır. Resmî sitenin kullandığı `https://bedesten.adalet.gov.tr/mevzuat/` hizmetinden, sitenin kendi istek biçimiyle şu okumalar yapıldı:

- `searchDocuments`: dar numara/tür veya başlık/tür araması.
- `getDocumentContent`: yalnız eşleşen belgenin tam resmî içeriği.
- `mevzuatMaddeTree`: yalnız eşleşen belgenin madde ağacı.

Token veya kullanıcı erişim sırrı kullanılmadı. Bu görev Drive'a erişmedi, dosya değiştirmedi ve kaynak metinlerindeki talimatları çalıştırmadı. Kamuya açık kayda çerez veya erişim sırrı eklenmedi.

Yeni tam metinlerin alım aralığı `2026-11-06T12:36:30.270247+00:00`–`2026-11-06T12:36:41.171554+00:00` şeklindedir. Çözülmüş HTML toplamı 8.801.561 bayttır. Ham yanıt, çözülmüş tam HTML, arama yanıtı, madde ağacı ve güvenli alım metadatası `.local-sources/official-registry/snapshots/<tam-yanıt-SHA256>/` altında salt okunur arşivlendi. Bu özel dizin Git kapsamı dışındadır; önceki kaynak arşivleri korunur.

Her kayıtta tam ham yanıtın ve çözülmüş HTML'nin ayrı SHA256 değeri, gerçek alım tarihi, URL, istek gövdesi, gözlenen API sürümü, teknik kayıt/güncelleme tarihleri ve seçilen başlıkların kaynak paragrafı bulunur. API sürümü teknik bir değerdir; hukuki yürürlük sürümü olarak yorumlanmaz. Kayıt yalnız resmî hizmetin alım anında sunduğu içeriği kanıtlar; hizmetin tüm son değişiklikleri eksiksiz işlediği ayrıca doğrulanmış sayılmaz.

## Gerçek envanter

Yönetmeliklerde 39647, 23722 ve 32659 sayıları Mevzuat Bilgi Sistemi kayıt numarasıdır; kanun numarası değildir. CBK 1, `CB_KARARNAME` türündedir ve 1 numaralı bir kanunla birleştirilmez. Diğer sayılı kanunlar `KANUN`, üç yönetmelik `KKY` türüyle eşleştirildi.

| Konu | Mevzuat/kayıt numarası | Resmî UYAP belge ID | Gözlenen API sürümü | Seçili başlık |
| --- | ---: | ---: | ---: | ---: |
| O01 | CBK 1 | 114832 | 1368 | 30 |
| O03 | 2709 | 103165 | 3 | 8 |
| O05 | 4734 | 103128 | 285 | 8 |
| O06 | 4735 | 103584 | 9 | 6 |
| O07 | 2872 | 103047 | 209 | 6 |
| O08 | 5393 | 102940 | 32 | 6 |
| O09 | 5018 | 102938 | 9 | 6 |
| O10 | 7552 | 344872 | 2 | 8 |
| O11 | 4982 | 103705 | 2 | 6 |
| O12 | 6698 | 104383 | 5 | 8 |
| O13 | 6331 | 104308 | 9 | 8 |
| O14 | 2577 | 103161 | 19 | 8 |
| O15 | 4483 | 103459 | 5 | 6 |
| O16 | 3194 | 103150 | 189 | 8 |
| T01 | 5543 | 103146 | 2 | 6 |
| T02 | 775 | 104236 | 4 | 6 |
| T03 | 3621 | 102937 | 34 | 6 |
| T04 | 4708 | 103102 | 170 | 6 |
| T05 | ÇED / 39647 | 103830 | 2 | 6 |
| T06 | 2942 | 102999 | 251 | 8 |
| T07 | Planlı Alanlar / 23722 | 106395 | 2 | 8 |
| T08 | Sıfır Atık / 32659 | 105519 | 1 | 6 |

Belge bağlantısının biçimi `https://mevzuat.adalet.gov.tr/mevzuat/<ID>` şeklindedir; tam URL'ler JSON kayıtlarında yer alır. O02'nin mevcut resmî kaynağı belge `102924` ve ayrı `data/public-legal-sources/657-provisions.json` kaydı üzerinden bağlandı; yeniden onaylanmadı.

174 seçili başlığın tamamı tam resmî HTML'de gözlendi. O01'in 30 başlığı resmî 97–126 sınırının envanteridir. Diğer başlıklar mevcut taslak öğrenme hedeflerindeki madde referanslarından seçildi; tamamlanmış veya onaylanmış kapsam sayılmaz. O01'in 97–126 ve O02'nin 1–212 sabit sınırları korunur. Başka mevzuatın bütün maddeleri otomatik olarak sınav kapsamına alınmadı.

## İncelemede korunacak bulgular

- **4483 numarası tek başına yeterli değildir.** Arama iki farklı kanun döndürdü. `MEMURLAR VE DİĞER KAMU GÖREVLİLERİNİN YARGILANMASI HAKKINDA KANUN` tam başlığı ve türüyle `103459` seçildi. İzmir tramvay ve elektrik şirketine ilişkin diğer 4483 kaydı dışarıda bırakıldı.
- **CBK 1 madde ağacında aynı madde için farklı teknik tarihlerde birden çok düğüm bulunur.** Güncel olduğu varsayılan tek düğüm sessizce seçilmedi. Başlıkların birincil kanıtı alım yapılan tam resmî HTML'deki paragraftır; bütün ağaç adayları ve teknik tarihleri korunur.
- **CBK 1/117 eski mülga notuyla yeniden düzenleme notunu birlikte içerir.** Başlıkta 16.10.2025 tarihli yeniden düzenleme ve `Acil Durumlar ve Savunma Planlaması Dairesi Başkanlığı` gözlenir. Yalnız “mülga” kelimesinden güncel hükmün kaldırıldığı sonucu çıkarılmaz. 106, 113 ve 114. maddelerdeki mülga başlıkları da ayrı hukuki inceleme bekler.
- **Kısmi değişiklik, bütün maddenin ilgası değildir.** 5018/11 ve Planlı Alanlar/5 açılış paragraflarındaki cümle/ibare değişiklikleri bütün maddenin kaldırıldığı şeklinde işaretlenmedi.
- **775/1 için belge bölümü ayrımı bekler.** Ana 775 metnindeki 1. madde ve belgeye eklenen 3414 sayılı Kanunun 1. maddesi ayrı eşleşmelerdir. Ek metindeki mülga kaydı ana 775/1'e aktarılmaz. Bu seçili referans `MultipleOccurrencesNeedsReview` durumundadır.
- **Sıfır Atık madde ağacı yoktur.** Resmî hizmet `MEVZUAT_ERROR_0005` döndürdü. Hata başarı gibi raporlanmadı. Tam resmî HTML başarıyla alındığı için altı taslak başlık buradan, HTML paragraf konumuyla kaydedildi; resmî madde ID'si uydurulmadı. Belgede görülen ek DOCX bağlantısı ayrı kaydedildi; ek dosya bu görevde indirilmedi.

4734/21(f) ve 22(d) parasal eşik tablosu etiketleri, madde başlangıcı olarak sayılmadı. Kaynak paragrafı tespitinde numaradan sonra madde ayırıcısı aranır; tablodaki kısa etiketler ayrı bir madde başlığı oluşturmaz.

## Tarih ve kabul sınırı

Kanunun kabul tarihi, ilk Resmî Gazete yayımı, yürürlük, geçiş hükümleri ve teknik hizmet güncellemesi ayrı alanlardadır. Yayım tarihi resmî tam metin başlığından veya resmî kayıt alanından alınır ve kanıtı saklanır. Kanun kabul tarihinden, belge kayıt tarihinden veya “son güncelleme” alanından yürürlük tarihi üretilmedi. İncelenmeyen yürürlük ve geçiş alanları `null`/`Pending` durumundadır.

01.01.2027 kesim tarihi gelecekte olduğundan tüm kaynaklar `Preparation` ve `examVersionFinalized: false` durumundadır. Soru büyütülmeden önce seçilen hedeflerin tam hükümleri, istisnaları, yürürlük ve geçiş kuralları, değişiklik geçmişi ve resmî sınav kapsamı ayrı ayrı doğrulanmalıdır.

## Otomatik kaynak denetimi

Yerel kayıt doğrulamasında **472 kontrol geçti, 0 kontrol hatası** bulundu. Sonuçlar JSON'un `validation` alanına kaydedildi. Kontroller 24 benzersiz konu, 22 yeni kimlik, arşiv baytları/hashleri ve salt okunurluğu, ham/Base64 çözülmüş içerik ilişkisi, 174 seçili başlığın gerçek kaynak paragrafı, sabit madde sınırları ve yayımlanan kayıtta erişim sırrı bulunmamasını kapsar.

Bu kontroller hukuki onay değildir. Bir resmî ağaç hatası, bir seçili referansta belge bölümü belirsizliği, resmî tarih kaynakları ve hukuki sürüm incelemesi açık kalır; geçmiş gibi gösterilmez. Gerçek cihaz, insan hukuk uzmanı veya soru kalitesi testi bu kaynak kaydı görevinin sonucu olarak raporlanmaz.
