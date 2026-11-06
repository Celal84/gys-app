# Faz 1–3 devam raporu

Tarih: 06.11.2026. Önceki Faz 0 kaydı korunmuştur. Bu oturumda **18 onaylı soruyla çalışan ilk MVP / kısmi içerik** düzeyine ilerlenmiştir. Bu durum, 5.400 sorunun veya bütün fazların tamamlandığı anlamına gelmez.

## Gerçek içerik

657 sayılı Kanunun 3, 54, 94, 102, 125, 129, 130 ve 135. maddelerindeki farklı hedeflere bağlı 18 özgün konu bankası sorusu açılmıştır. Beş seçenek, kalıcı seçenek kimliği, doğru cevap, her çeldirici için açıklama, öğrenme hedefi ve resmî kaynak konumu bulunur. Beş senaryo vardır; zorluk dağılımı 5 temel, 6 orta, 4 zor ve 3 uygulamadır. Bu, 100 soruluk bağımsız tam deneme değildir.

Kaynak, [Adalet Bakanlığı UYAP resmî metnidir](https://mevzuat.adalet.gov.tr/mevzuat/102924). Soru üreticisinin dışındaki süreç; tek doğru, çeldirici, istisna, kapsam ve tekrar incelemesi yapmış, üç aday düzeltilip tekrar incelenmiştir. Bu süreç insan hukuk uzmanı onayı olarak gösterilmez. Sonrasında ayrı deterministik yayın denetimi, 11 gerçek resmî HTML dosyasının hash'ini, alıntıyı, dipnotu, paragraf konumunu, cevap ve dört çeldirici kimliğini, hedef/madde bağını ve bağımsız incelemenin değişmemiş aday hash'ini kontrol etmiştir. Yalnız bu iki katmanı geçen 18 kayıt `Approved` paketine alınmıştır.

Bir alıntıdaki `[187]` dipnotu önce denetime takılmıştır. Sorunun HTML çıkarıcısının inline etiketlere yapay boşluk eklemesi olduğu doğrulanmış; kaynak veya alıntı değiştirilmeden blok/inline ayrımı düzeltilmiş ve üç regresyon testi eklenmiştir. Kontrol, dipnot veya noktalama silinerek gevşetilmemiştir.

- Üretilen: **18**.
- Kaynakla doğrulanan ve onaylanan: **18**.
- Yeni bekleyen / reddedilen: **0 / 0**.
- Önceden bulunan inceleme bekleyen kayıt: **50**; özgün/onaylı sayılmaz.
- 5.400 özgün hedefe kalan: **5.382**.
- Tam deneme: **0/30**; havuz A **0/3.000**.
- Konu bankası: O02 **18/100**; toplam havuz B **18/2.400**.

Kanun metni alım anında resmî hizmetin sunduğu **hazırlık snapshot'ıdır**. 01.01.2027 kesimi henüz gelmedi; nihai sınav mevzuatı kesinleşmiş sayılmaz. Yayım, teknik hizmet tarihi ve yürürlük/geçiş bilgileri ayrı tutulur. Kaynakta kesinleştirilemeyen yürürlük/geçiş alanları boş/bekleyen bırakılmıştır.

## Kaynak ve kapsam ilerlemesi

24 Drive dosyasının özgün hash'i yeniden eşleşmiştir. 19 Word, 3 HTML ve 2 PDF yapısal olarak incelenmiştir. 657 Word dosyasında çıkarıcıların dipnot/tablo sayıları ayrışmış, bir geçici madde numarasına dipnot yapıştığı bulunmuştur. Bu sebeple eski düz metin, otomatik ve eksiksiz madde kaynağı sayılmamıştır. İlk paket için bunun yerine ayrı resmî UYAP hükümleri kullanılmıştır.

Atatürk PDF'sinin 75 sayfası Türkçe OCR ile yeniden işlendi. Örnek sayfada okunabilirlik iyileşse de renkli kutularda atlanan içerik vardır. **Faz 1 tam görsel/yapısal kabulü halen tamamlanmış değildir.** İlerleme klasörü açılmamış, Drive değiştirilmemiştir.

24 konu için 166 alt konu ve 176 kaynak bağlantılı öğrenme hedefi taslağı oluşturulmuştur. O01/O02 sınırları korunur; diğer konuların tüm maddeleri otomatik kapsam sayılmaz. Nihai hedef paydası bilinmediğinden kapsam ve hâkimiyet yüzdeleri uydurulmaz. Bu katalog, tam ve onaylanmış sınav kapsamı değildir.

Kalan 22 mevzuat için resmî kimlik/tür/başlık eşleştirmesiyle tam snapshot alınmış; mevcut O02 ile **23 mevzuat konusu** kaynak kaydına bağlanmıştır. Seçili 174 başlık gözlenmiş ve 472 kaynak/yapı kontrolü geçmiştir. Bu, 23 mevzuatın bütün hukuki hüküm ve geçişlerinin onaylandığı anlamına gelmez. O04 için ayrıca resmî tarih kaynakları gerekir. Mülga/yeniden düzenlenmiş başlıklar, madde ağacı hatası ve ek kanunla karışabilecek madde numaraları açık kayıt olarak tutulur.

## Çalışan uygulama

- Kompakt Türkçe mobil arayüzde 18 onaylı soru ve O02 konu seçimi.
- Paket boyutuna göre gerçek mevcut sayı; onaysız konudan başka konuya sessiz geçiş yok.
- Küçük manifest başlangıçta, soru metinleri konu parçası açıldığında yüklenir. Bütün banka başlangıç JS'sine gömülmez.
- IndexedDB'de kalıcı çalışma, cevap, soru sürümü ve kaynak snapshot bilgisi.
- Yenileme/çevrimdışı yeniden açılış sonrası aynı seçenek sırası ve kontrol edilmiş cevapla devam.
- Atomik cevap ve sayaç kaydı; yinelenen cevap iki kez XP/sonuç üretmez; eski sekme sürüm çakışması reddedilir.
- Doğru/yanlış/boş, konu sonucu ve aynı paketin ilk/tekrar çözümü ayrımı; eski sonuçlar soru güncellendiğinde değişmez.
- Yanlış defteri, yalnız güncel onaylı paketle eşleştirilen tekrar. İçe aktarılan sahte soru yeni çalışmaya sızmaz.
- Başlangıç istatistikleri ve benzersiz soru tamamlama; kapsam/hâkimiyet ve sınav tahmini yetersiz veride üretilmez.
- Yeni çalışma günlüğünün tam JSON yedeği ve silmeden/çakışma denetimli birleştirmesi. Eski kayıt/ayar yedeği ayrı korunur; tam koruma için iki dosya birlikte saklanır.

Tam 100/150 Strict Mode, 30 deneme, tüm 24 konu bankası, birleşik tek dosyalı yedek, PDF raporu, SM-2, gelişmiş plan/tahmin ve otomatik mevzuat nöbetçisi sonraki kabul işleridir. Gerçek iPhone Safari testi yapılmamıştır. Canlı yayın için kullanıcının açık onayı beklenir.

## Test ve sonraki adım

79 birim/entegrasyon, 9 Python kaynak/HTML çıkarım ve 7 mobil Chromium E2E testi geçti. Gerçek paketle beş soruluk çalışmada bir yanlış/dört doğru, çevrimdışı yenileme, devam, **4 doğru · 1 yanlış · 0 boş**, benzersiz tamamlama ve yanlış defteri doğrulandı. Ayrıntılar [QA_REPORT.md](QA_REPORT.md) içinde.

Sonraki içerik büyütme adımı: açık kaynak/kapsam istisnalarını çözmek, özellikle yüksek ağırlıklı hedefleri resmî hüküm ve ayrı incelemeyle sırayla onaylamak. Sırf adede ulaşmak için mevcut 18 soru farklı kelimelerle çoğaltılmaz. Çıkmış arşiv incelemesi ayrı ilerler; resmî kitapçık, anahtar, kapsam ve kullanım hakkı netleşmeden soru yayımlanmaz.

## Çıkmış kaynakların ilk denetimi

Ayrı arşivde6 Drive dosyası okundu;ZIP'teki5kopya aynı özgün baytları içeriyor. Derleme0 tam soru,26 özet ve480 cevap indeksi taşıyor.9 resmî MEB PDF'si indirildi ve480/480 tarihî anahtar eşleşti;2022 PDF'sinde ayrıca100 kod/cevap görüldü.580 pozisyon,benzersiz veya2027'ye uygun580 soru sayılmadı;Accepted0,Nbilinmiyor.2019/2022kitapçıklarında yazılı izin kısıtı var;tam soru metni kamuya aktarılmadı. Uygulamada güvenli resmî bağlantı kataloğu var.2020duyurusu bu alımdaHTTP503;tam kitapçık yok. Ayrıntı:[HISTORICAL_ARCHIVE_REPORT.md](HISTORICAL_ARCHIVE_REPORT.md).

## Kodun incelemeye alınması

Kaynak kodu `codex/gys-verified-mvp` dalına gönderildi ve [taslak PR#1](https://github.com/Celal84/gys-app/pull/1) açıldı. `main` birleştirilmedi,canlı yayın yapılmadı. GitHub Actions uzakta başlatıldı;sonuç ayrı gözlenir. Özel Drive hamları,PDF kitapçıklar,kullanıcı ilerlemesi ve erişim sırları gönderilmedi. Yalnız resmî kanun alıntıları,özgün içerik ve doğrulama kayıtları kaynak paketindedir.
