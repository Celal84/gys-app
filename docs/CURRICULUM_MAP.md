# Müfredat kapsam haritası — ilk kaynaklı taslak

Bu dosya Faz 2'nin ilk kapsam çalışmasını kaydeder. **24 konu için 166 alt konu ve 176 öğrenme hedefi taslağı** çıkarıldı. Bunlar tamamlanmış veya onaylanmış sınav kapsamı değildir. Nihai hedef sayısı bilinmediği için kapsam/hâkimiyet yüzdesinin paydası henüz yoktur.

Veri: `data/curriculum-map.json`. İşlevler: `src/core/curriculum-map.ts`. Her hedefte kalıcı ID, konu/alt konu, ilgili mevzuat/madde, tespit edilebilen bent, öğrenme hedefi, önem derecesi, ön koşul hedefleri, bağlı sorular ve ölçüm durumu bulunur. Tespit edilmemiş fıkra/bent numarası `null` bırakıldı. İlgili soru listeleri henüz boştur; önceki 50 soru otomatik olarak bu hedeflere bağlanmadı.

## Kaynak ilişkisi ve doğrulama sınırı

Her hedefin dayanağı, gerçekten çıkarılan metindeki madde başlığı/örneği, satır aralığı ve özgün dosya/metin SHA-256 değerleriyle izlenebilir. Bu ilk harita, kullanıcının ders kaynaklarındaki başlıklardan çıkarıldı. Resmî mevzuat sürümü, dipnot/bent/istisna bütünlüğü ve yayımlanma/yürürlük/geçiş hükümleri henüz bu harita tarafından onaylanmış değildir.

`sourceDocuments` kayıtlarının özgün hash değerleri özel `.local-sources/drive-inventory.json`, `common-read-report.json` ve `technical-read-report.json` ile eşleştirilebilir. Özel Drive URL'leri ve ham belgeler bu kataloğa eklenmedi; kısa kaynak başlığı/metin parçaları izlenebilirlik için saklandı. Satır konumları saklanan metin çıkarımına aittir; matbu belge sayfası gibi gösterilmez.

Tüm hedefler `Draft`, kullanıcı öğrenme durumu `Unmeasured` ve kaynak hükmü doğrulaması bekleyen durumdadır. Bir madde başlığının bulunması, o hükmün hukuken güncel veya otomatik olarak sınava dahil olduğu anlamına gelmez. Sonraki bağımsız resmî kaynak kontrolü yalnız doğrulanan hedefin durumunu yükseltmelidir.

## Sınırlar

- O01 yalnız **97–126**, O02 yalnız **1–212** aralığında seçildi. Belge dosyasının bu aralıklar dışındaki bölümleri hedef üretilirken kullanılmadı.
- O03 yalnız resmî dağılımın belirttiği **Genel Esaslar**, **Temel Haklar ve Ödevler**, **Devletin Temel Organları** başlıklarından seçildi. Kaynak metindeki yapısal sınırlar sırasıyla 1–11, 12–74 ve 75–160 olarak kaydedildi. Bunlar seçili başlıkların sınırını doğrulamak içindir; içlerindeki bütün maddelerin ayrıntılı kapsamının onaylandığı anlamına gelmez.
- Diğer 21 konu için seçilen maddeler yalnız incelenecek hedef adaylarıdır. Dosyadaki tüm maddeler kapsama alınmadı; `allArticlesAssumedInScope=false`, kapsam kararı `Pending` kalır.
- O04'te mevzuat maddesi kullanılmadı. Olay/dönem ve neden-sonuç hedefleri, PDF sayfa konumlarıyla bağlandı. OCR bozuk olduğu için tarihler doğrulanmış sayılmaz; normalleştirilmiş olay adları ve dönem etiketleri inceleme adaylarıdır. Sayfa görseli ve okunabilir resmî tarih kaynağı kontrolü bekleniyor.
- Her konuya 6–8 başlangıç hedefi seçildi; O02'de ilk soru paketinin birbirinden farklı bilgi işlemlerini ayırabilmek için **18 alt hedef** kullanıldı. Bu sayı konuya ilişkin nihai öğrenme hedefi kotası değildir.

## Ayrı göstergeler

`curriculumIndicators()` üç değeri birbirinden ayırır:

1. **Soru tamamlama:** Gerçekten yayımlanmış çalışma sorularının benzersiz ID'leri içinde benzersiz çözülenlerin oranı. Yayımlanmış soru yoksa `null`; başka havuzdaki/henüz yayımlanmamış ID'ler sayılmaz.
2. **Müfredat kapsama:** Kaynak ve kapsam durumu onaylanmış hedeflerden, yayımlanmış onaylı soruyla temsil edilenlerin nihai sınav hedef sayısına oranı. Taslak hedefler sayılmaz. Bu katalog eksik olduğu için şu anda `null`.
3. **Öğrenme hâkimiyeti:** Yeterli çeşitli ve gecikmeli ölçümle öğrenilmiş sayılabilecek onaylı hedeflerin nihai hedef sayısına oranı. Nihai payda veya yeterli ölçüm yoksa `null`.

Geçici ölçüm eşiği hedef başına en az dört bağımsız soru, iki bilişsel işlem türü, en az %80 doğruluk ve gecikmeli hatırlama başarısıdır. Bu eşik bir başlangıç kuralıdır; psikometrik olarak kalibre edilmiş başarı tahmini değildir. Aynı soruyu tekrarlamak bağımsız soru sayısını artırmaz. Yalnız “öğrendim” seçimi, tek yanlış/doğru veya aynı bilişsel türde tekrarlar hâkimiyet kanıtı sayılmaz. Herhangi bir ölçüm yapılmış hedef sayısı ile yeterli ölçüme sahip hedef sayısı ayrı tutulur.

Bu işlev, nihai sınav puanı tahmini üretmez ve ölçülmemiş konuyu sıfır başarılı gibi etiketlemez. Mevcut toplu eski istatistiklerden çeşitli/bağımsız hedef ölçümü türetilmez.

## Kontroller ve sonraki iş

`tests/curriculum-map.test.ts` 24 konu kapsamını, değişmez madde sınırlarını, O03 bölüm ilişkisini, tarih konusunun madde içermemesini, kaynak hash ilişkisini, taslak kanıtla onay verilememesini, eksik paydayı ve üç göstergenin farklı anlamlarını denetler.

Sonraki iş resmî mevzuat snapshot'larını bu hedeflerle eşleştirmek, kapsam ve hukuk sürümü kararlarını ayrı kaydetmek, geniş kanun dosyalarını hedeflere bölmek ve yalnız bağımsız doğrulanmış hedefleri içerikle temsil etmektir. Bu ilk harita büyük ölçekli soru üretiminin tamamlandığı veya başlatılmasının güvenli olduğu anlamına gelmez.
