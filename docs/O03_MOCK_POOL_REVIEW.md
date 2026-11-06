# O03 korunan deneme havuzu incelemesi

6 Kasım 2026 tarihli ayrı süreç incelemesinde 120 O03 A adayı tek tek, beş seçenek ve kaynak hükmüyle birlikte okundu. Son adaylara ilişkin karar **120 Pass, 0 NeedsReview, 0 Rejected**'dır. Dosyalardaki aday durumları yayıncının bağımsız onay ve kural kontrollerini bekler; bu rapor kendi başına uygulamada tam deneme açmaz.

Bu inceleme yapay zekâ destekli ayrı süreçtir. İnsan incelemesi, bütün müfredat hedeflerinin kabulü veya 1 Ocak 2027 kesim tarihindeki nihai mevzuat onayı değildir.

## Kaynak, kapsam ve düzeltmeler

Banka incelemesindeki değişmez UYAP 103165 hazırlık kaynağı kullanıldı. Tam raw cevap, Base64 decoded HTML, kamuya açık hüküm JSON'u ve tam paragraf transkripti hash'leri yeniden kontrol edildi. Üreticiden farklı lxml.html ayrıştırmasıyla 817 paragraf karşılaştırıldı; fark yoktur. Soru bazlı quote/hash/konum/madde/hedef/seçenek denetimleriyle **1.788 mekanik kontrol geçti**.

Yalnız resmî müfredatın adlandırdığı Genel Esaslar, Temel Haklar ve Ödevler, Cumhuriyetin Temel Organları kısımlarındaki seçili m.1–160 hedefleri kabul edildi. Mali ve ekonomik hükümler, geçici hükümler ve m.161 sonrası genel kapsam sayılmadı. Bütün 120 review kaydında seçili kapsam kanıtı vardır.

52 sorunun zayıf çeldiricileri, ilgili norm/merci/kapsam/koşul karşılaştırmalarıyla değiştirildi. Q88'e dokunulmazlık istisnaları ve önceki TBMM kaldırma kararı sınırı eklendi. Q114 doğrudan iptal hakkını Anayasa m.150'nin genel kuralıyla sınırlar; kanunların şekil denetimindeki özel başvuru kuralını genellemez. Doğrudan hatırlama sorularının etiketleri yeniden kalibre edildi.

Son dağılım **49 temel, 38 orta, 2 zor, 31 uygulama**, senaryo sayısı **31**'dir. Zorluk etiketi gerçek cevap verilerinden hesaplanan istatistiksel güçlük değildir; başlangıç sayı hedefi uğruna bilgi hatırlamaya zor etiketi verilmemiştir.

## Benzersizlik ve koruma

100 O03 B + 100 O02 B + 120 O03 A olmak üzere 320 soru, sorgulanan bilgi/koşul/sonuç ve bilişsel işlem yönünden karşılaştırıldı. Normalize metin tekrarı ve bu incelemede anlamsal/hedef tekrar gözlenmedi. Örneğin:

- TBMM toplantı sayısı 200 ile karar sayısının alt sınırı 151 farklı aşamalardır.
- AYM Genel Kurul toplantı sayısı ile parti kapatma karar çoğunluğu farklı koşullardır.
- M.38 kanunilik, masumiyet, şahsilik ve genel müsadere yasağı ayrı hukuki bilgilerdir.
- O02 memur tanımı ile Anayasa m.128'de görevlerin memurlar ve diğer kamu görevlileri eliyle görülmesi farklı kapsam sorularıdır.

Bu gözlem embedding testi veya matematiksel benzersizlik ispatı değildir. Sonradan eklenecek diğer konu ve havuzlarla çapraz denetim yeniden yapılmalıdır.

120 aday, EXAM-01…EXAM-30'a **her denemede 4 O03 sorusu** olarak atanmıştır. Bunlar konu bankasına, kartlara veya öğretici ön izlemeye aktarılmamalıdır. Diğer 23 konunun onaylı dağılımı tamamlanmadığından bu review tek başına **0 hazır tam deneme** üretir. Toplam 100 soru ve 70/30 dağılımını başka içerikle doldurmak için B soruları kullanılamaz.

## Değişmez çıktılar

- Aday dosyası: `data/content-candidates/o03-mocks.json`
- Aday SHA256: `dc920ff25dd9062017f3ea6602b24b626d9da0499b7545861c1ad4a64dd5b8de`
- Kural SHA256: `2b94026ac7923685e290720da4c0934651b5c7009c496bdc91b8abd06416ccda`
- Review: `data/reviews/o03-mocks-review.json`
- Ayrı kaynak denetimi: `data/reviews/o03-mocks-source-independent-audit.json`

Her sorunun son JSON.stringify hash'i review kaydında tutulur. Sonraki aday/kural değişikliği inceleme hash'ini geçersiz kılar.
