# Faz 1 — Kaynak bütünlüğü ve OCR ilerleme raporu

Bu rapor 24 ders kaynağının özgün baytlarını, metin çıkarımını ve yapısal gösterimini denetler. **Metin/yapı çıkarımı hukuki doğruluk veya bütün belgelerin eksiksiz görsel kabulü anlamına gelmez.** Kaynaklar Drive'da değiştirilmedi; İlerleme klasörü ve altı açılmadı.

## Tamamlanan teknik işler

- Önceki 24 kaynak snapshot'ının SHA-256 değeri yeniden hesaplandı; **24/24 eşleşti**. Denetim sonunda tekrar hesaplanan hash'ler de değişmedi.
- **19 gerçek Word** dosyası, özgünlere dokunmadan yerel DOCX yapı kopyasına çevrildi. `document.xml`, tablo hücreleri, dipnot referansları ve ayrı dipnot tanımları çıkarıldı. Aynı özgün dosyalar antiword DocBook çıkarımıyla bağımsız olarak karşılaştırıldı.
- Üç teknik HTML kaynağının tablo hücreleri, iç bağlantıları ve dipnot hedefleri incelendi; ilk metin aktarımıyla token ve madde işareti karşılaştırması yapıldı.
- İki PDF'nin sayfa/sözcük koordinatları `pdftotext -bbox-layout` ile saklandı: O04 **75 sayfa**, T01 **24 sayfa**. Koordinat çıktısı PDF tablosunu veya dipnotunu semantik olarak doğrulamaz.
- Word/HTML yapılarında çözümsüz dipnot hedefi görülmedi. Bu, bütün dipnotların kayıpsız olduğu iddiası değildir.
- Word dosyalarının 18'inde iki çıkarıcının tablo ve dipnot adetleri eşleşti. Önceki metinle token örtüşmesi yaklaşık %99,08–99,98 aralığında; bu oran hukuki kelime doğruluğu veya tamlık ölçümü olarak kullanılmamalıdır.

Denetim yeniden çalıştırılabilir:

```sh
python3 scripts/source-integrity.py --convert-docx
python3 -m unittest discover -s tests -p 'test_source_integrity.py' -v
```

LibreOffice, Poppler ve yerel antiword çalışma zamanı gereklidir. Özel snapshot'lar `.local-sources/` içinde bulunmalıdır; bu dizin Git'e dahil edilmez. Betik yalnız manifestteki 24 kaynağı okur, orijinal hash uyuşmazlığında durur, kaynakları hukuken onaylamaz. Dışlanan ID, klasör dışına çıkış ve sembolik bağlantıyla kaçış dosya içeriği okunmadan reddedilir. Başka konumdaki yalnız adı İlerleme olan dosya ad nedeniyle dışlanmaz.

## 657 kaynağında inceleme gerektiren fark

O02 dosyası için LibreOffice yapı kopyası **13 tablo ve 364 dipnot tanımı**, antiword ise **12 tablo ve 172 dipnot** verdi. Hiçbir sonuç otomatik olarak tam kaynak kabul edilmedi. LibreOffice yapısındaki dipnot referansları mevcut tanımlara bağlanıyor; yine de hangi yapının özgün Word görünümünü tam koruduğu ayrıca incelenmelidir.

Ayrıca önceki düz metinde `Geçici Madde 32314` ifadesi bulundu. Yapısal DOCX'te aynı paragraf **Geçici Madde 32** ve ayrı bir `footnoteReference` (`id=315`) taşıyor. Bu, madde numarasına dipnot numarasının yapışmasının somut örneğidir. Eski düz metindeki sayılardan otomatik madde kapsamı veya soru referansı çıkarılmamalıdır. Bu geçici maddeyi sınav kapsamına dahil etme kararı verilmedi; O02 için 1–212 sınırı korunur.

## O04 OCR kurtarma sonucu

Kaynak, taranmış sayfa görüntüleri ve hatalı eski OCR katmanı içeriyor. Sorun yalnızca font/Unicode kodlaması değil. Özgün PDF korunarak resmî Tesseract `tessdata_fast` Türkçe modeliyle **75/75 sayfa** yeniden işlendi; işlem hatası sıfır. Model ve özgün PDF hash'leri, sayfa TXT/TSV kayıtları ve yeniden üretme betiği yerelde saklandı.

Sayfa 1, 2 ve 17 görselleri örnek olarak incelendi. Sayfa 2'de görselden okunan dokuz kısa ifadede eski katman **3/9**, yeni OCR **9/9** eşleşti. Bu yalnızca o örneklerin sonucudur; belgenin genel OCR doğruluğu değildir.

Ek kontrol önemli bir eksikliği ortaya çıkardı: sayfa 17'de renkli kutuların içindeki yedi cemiyet başlığı ve bir metin satırı standart sayfa düzeni tanımada atlandı. Gri ton/eşik 165 alternatifi örneklenen **7/7 başlığı** ve satırı geri kazandı. Alternatif çıktı ayrıca saklandı; bütün metnin doğrulanmış sürümü olarak eski veya yeni kaydın üzerine yazılmadı.

Tanınan sözcük sayısı 12.385, sayfa ortalama sözcük güveni 90,47. Güven puanı, yalnız motorun tanıdığı sözcüklerin tahminidir; atlanan alanları ölçmez ve transkripsiyon doğruluğu değildir. Durum **MachineOcrRecoveredWithLayoutGaps**. Tüm 75 sayfanın görsel kontrolü, tarihsel doğruluk ve metin tamlığı hâlâ onaylanmadı. O04 içerik üretiminde onaylı kaynak sayılmaz.

T01 PDF'nin ilk sayfasında başlık, kanun numarası, yayın bilgileri ve ilk madde düzeni örneklendi; kalan 23 sayfanın tam görsel onayı verilmedi.

## Raporlar ve kalan işler

- Makine özeti: [source-integrity-summary.json](source-integrity-summary.json).
- Yerel ayrıntılar: `.local-sources/source-structure-audit.json` ve `structure-docx/`, `structure-xml/`, `structure-text/`.
- OCR ayrıntıları: `.local-sources/ocr-audit-summary.json`, `ocr-audit-result.json`, `ocr-audit-o04-recovered.txt`, `ocr-audit-pages/` ve örnek karşılaştırma kayıtları.
- Altı Python testi geçti: dışlanan ID, ad benzerliği, sembolik bağlantı kaçağı, dipnot/tablo yapısı, madde-dipnot bitişme teşhisi ve HTML iç bağlantıları.

**Faz 1'in otomatik bütünlük tanılaması hazırdır; tam kaynak kabulü tamamlanmış değildir.** Öncelikli kalan işler: O02 yapı farkının özgün Word görünümüyle çözülmesi; O04 renkli kutu ve karmaşık düzenlerin sayfa bazlı gözden geçirilmesi; sorularda kullanılacak madde/fıkra/bent ve dipnotların resmî kaynakla birebir kontrolü. Mevzuat sürümü ve yürürlük incelemesi ayrı bir iş olarak sürdürülmelidir.

Bu alt görevde üretilen, kaynakla doğrulanan veya onaylanan soru sayısı **0**. Kaynakların hiçbirine hukuki Approved durumu verilmedi.
