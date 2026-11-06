# Çıkmış sınav arşivi — İlk doğrulama raporu

06.11.2026 · Faz 4 kaynak incelemesi. **Havuz C henüz açılmadı; kabul edilen tarihî soru 0.** Bu inceleme, ilk özgün soru paketinden bağımsız yürütüldü.

## Kaynak dosyalarında gerçekte ne var?

Yetkili Drive bağlantısıyla ayrı çıkmış soru klasöründeki altı dosya okundu. Drive dosyası değiştirilmedi; dışlanan İlerleme dalına erişilmedi. Özgün baytlar, SHA-256 ve çıkarımlar `.local-sources/historical/` içinde, Git dışında saklandı.

- DOCX: 74 paragraf ve 10 tablo. İçerik, bir kişisel kaynak/cevap derlemesidir; resmî kitapçık değildir.
- PDF: aynı derlemenin okunabilir başka formatı; bağımsız resmî soru kaynağı sayılmadı.
- JSON: **gerçekten 480** soru sırası/kodu → cevap harfi kaydı. Bu kayıtlarda tam soru kökü ve seçenekler yoktur.
- DOCX örnek tablosu ve JSON `sinav_ozetleri`: **26 kısa özet**. Bunlar da tam soru metni değildir.
- HTML: **9 resmî MEB kitapçık PDF bağlantısı**, ayrıca duyuru bağlantıları.
- ZIP: resmî kitapçıkların fiziksel kopyalarını içermez; derleme dosyaları ve URL kısayollarını içerir. Beş ana ZIP üyesi ayrı Drive dosyalarıyla **bayt bayt aynı** olduğundan tekrar kaynak sayılmadı. URL kısayolları program olarak çalıştırılmadı.

Doğrudan derleme dosyalarındaki tam soru gövdesi + bütün seçenek kaydı sayısı **0**. Buradan 480 veya 580 özgün, tam, benzersiz ve 2027'ye uygun soru sonucu çıkarılamaz.

## Resmî kitapçıklara erişim ve tarihî cevap doğrulaması

HTML'de gerçekten bulunan dokuz MEB bağlantısının **tamamı HTTP 200 ve PDF imzasıyla** alındı. Her dosyanın özgün SHA-256 değeri, boyutu, sayfa sayısı ve kaynak URL'si kaydedildi. Sınav başlığı, tarih ve kadro/grup bilgileri resmî PDF başlıklarından incelendi.

| Belge | Tarih | Gerçek sınav türü / grup | Pozisyon | Tarihî cevap eşleştirmesi | Kaynak |
|---|---|---|---:|---:|---|
| 2019-UDS-G1A | 13.07.2019 | Unvan değişikliği · 1. Grup A - Mühendis, Mimar, Şehir Plancısı ve diğerleri | 50 | 50 | [MEB PDF](https://meb.gov.tr/meb_iys_dosyalar/2019_07/16174603_CEVRE_VE_YEHYRCYLYK_BAKANLIYI_UDS_1_GRUP_A.pdf) |
| 2019-UDS-G2A | 13.07.2019 | Unvan değişikliği · 2. Grup A - Sağlık Teknikeri, Tekniker | 50 | 50 | [MEB PDF](https://meb.gov.tr/meb_iys_dosyalar/2019_07/16174624_CEVRE_VE_YEHYRCYLYK_BAKANLIYI_UDS_2_GRUP_A.pdf) |
| 2019-UDS-G3A | 13.07.2019 | Unvan değişikliği · 3. Grup A - Teknisyen | 50 | 50 | [MEB PDF](https://meb.gov.tr/meb_iys_dosyalar/2019_07/16174640_CEVRE_VE_YEHYRCYLYK_BAKANLIYI_UDS_3_GRUP_A.pdf) |
| 2022-MEU | 30.10.2022 | Millî Emlak Uzmanlığı Özel Sınavı · Millî Emlak Uzmanlığı | 100 | 100 satır içi | [MEB PDF](https://odsgm.meb.gov.tr/meb_iys_dosyalar/2022_11/03145730_CEVRE_YEHYRCYLYK_BAKANLIYI.pdf) |
| 2023-MEU | 26.11.2023 | Millî Emlak Uzmanlığı Özel Sınavı · Millî Emlak Uzmanlığı e-Sınavı | 100 | 100 | [MEB PDF](https://odsgm.meb.gov.tr/meb_iys_dosyalar/2023_11/29095406_milli_emlakuzmanligi_esinavi.pdf) |
| 2023-UDS-G1 | 23.12.2023 | Unvan değişikliği · 1. Grup - Mühendis, Mimar, Şehir Plancısı ve diğerleri | 50 | 50 | [MEB PDF](https://odsgm.meb.gov.tr/meb_iys_dosyalar/2023_12/26093633_cevre-sehircilikveiklimdegisikligibakanligi1grup.pdf) |
| 2023-UDS-G2 | 23.12.2023 | Unvan değişikliği · 2. Grup - Tekniker | 50 | 50 | [MEB PDF](https://odsgm.meb.gov.tr/meb_iys_dosyalar/2023_12/26093633_cevre-sehircilikveiklimdegisikligibakanligi2grup.pdf) |
| 2023-UDS-G3 | 23.12.2023 | Unvan değişikliği · 3. Grup - Teknisyen | 50 | 50 | [MEB PDF](https://odsgm.meb.gov.tr/meb_iys_dosyalar/2023_12/26093633_cevre-sehircilikveiklimdegisikligibakanligi3grup.pdf) |
| 2024-GYS-EM | 01.12.2024 | Görevde yükselme · Emlak/Millî Emlak Müdürü ve Müdür Yardımcılığı | 80 | 80 | [MEB PDF](https://odsgm.meb.gov.tr/meb_iys_dosyalar/2024_12/04115902_sifreli_01_12_2024_milli_emlak.pdf) |

2019/2023/2024 kitapçıklarının sonundaki resmî cevap anahtarları kod/sıra + harf üzerinden JSON indeksle karşılaştırıldı: **480/480 eşleşme, 0 uyuşmazlık, 0 eksik**. İndeks kayıt kimliğinde aynı sınav içinde tekrar yoktur; bu, başka sınavlarda anlamsal tekrar olmadığını göstermez.

2022 Millî Emlak Uzmanlığı kitapçığında ayrıca **100 benzersiz soru kodu ve 100 satır içi “Cevap” kaydı** algılandı. Bu 100 kayıt, 480 kayıtlık indekse ayrıca eklenmiş değildir.

Dokuz resmî PDF'de toplam **580 soru pozisyonu ve A/B/C/D seçenek etiketlerini içeren 580 metin bloğu** otomatik olarak algılandı. Bu sayı; şekil, tablo ve bütün soru sözcüklerinin görsel olarak doğrulandığı veya soruların birbirinden benzersiz olduğu anlamına gelmez. Bütün görsel/transkripsiyon incelemesinden geçmiş pozisyon sayısı henüz 0. **Uygun benzersiz Havuz C soru sayısı N halen bilinmiyor.**

Tarihî soruların bu kaynaklarda özgün seçenek sayısı dörttür. Daha sonra izin ve kabul koşulları sağlanırsa dört seçenek korunmalı; beş seçenekli özgün soru motoruna uydurmak için seçenek eklenmemelidir.

## Sınav türleri birbirine karıştırılmadı

- 2019 ve 2023 grupları **Unvan Değişikliği** sınavlarıdır; mühendis/mimar ve diğer gruplar ayrıdır.
- 2022 ve 2023-MEU belgeleri **Millî Emlak Uzmanlığı** sınavlarıdır.
- 2024-GYS-EM, **Emlak/Millî Emlak Müdür ve Müdür Yardımcılığı** görevde yükselme sınavıdır.
- Bunların hiçbiri doğrudan “Şube Müdürü (Teknik) çıkmış sorusu” olarak etiketlenmedi. 2019 B kitapçıkları bu alıma dahil değildir; A/B ve ortak soru tekrarları sonraki aşamada ayrıca birleştirilmelidir.

## 2020 Şube Müdürlüğü durumu

Arşivde yalnız [03 Ekim 2020 duyuru bağlantısı](https://personel.csb.gov.tr/sube-mudurlugu-gorevde-yukselme-sinavi-03-ekim-2020-tarihinde-yapilacaktir-haber-256478) var; tam resmî kitapçık yok. Bu oturumdaki duyuru erişimi **HTTP 503** döndü. Arşiv derlemesinin duyuruya ilişkin açıklaması, bu erişimde bağımsız olarak yeniden doğrulanmış sayılmadı. Tam kitapçık alınmadı; 2020 için soru üretilmedi veya ithal edilmedi. Bütün internette hiçbir kopya bulunmadığı gibi daha geniş bir iddia da kurulmadı.

## Kullanım hakkı ve eleme kararı

2019 kitapçıklarında ve 2022 kitapçığında, MEB'in yazılı izni olmadan kopyalama/çoğaltma/yayımlamaya ilişkin açık kısıtlama metni görüldü. Diğer PDF'lerde aynı cümlenin metin çıkarımında bulunmaması kullanım izni oluşturmaz. Resmî bir URL'nin herkese açık olması da soru metnini uygulamada yeniden yayımlama yetkisi değildir.

Bu nedenle **hiçbir tam tarihî soru metni veya seçenek kamuya açık proje dosyalarına taşınmadı**. Public rapor yalnız envanter, kaynak bağlantısı, hash ve doğrulama sonucunu içerir. Tek tek soruların 2027 kapsamı, madde sınırı, güncel hüküm, metinsel/anlamsal tekrar ve kullanım hakkı henüz karara bağlanmadığından bütün kitapçıklar **NeedsReview** durumunda; Accepted sayısı 0. Bu aşamada bir soruyu hukuken yanlış veya kapsam dışı diye gerekçesiz Excluded yapmadık.

2886'ya özgü bir soru, yalnız ihale ilişkisi nedeniyle 4734'e taşınamaz. Tarihî anahtarın doğrulanması güncel hukukta aynı seçeneğin doğru olduğunu kanıtlamaz. Güncel hükme göre eski seçeneklerin hiçbiri doğru olmayabilir; bu durum için güncel cevap harfi uydurulmamalıdır.

## Yapılan otomatik kontroller ve sonraki adım

Yerel yeniden üretilebilir denetim `.local-sources/historical/audit-archive.py` ile çalıştırıldı: altı dosya, ZIP kopya eşitliği, 480 kayıt şeması/kimlikleri, 26 özet, dokuz resmî PDF, 480 resmî anahtar eşleşmesi ve 580 soru/özgün seçenek bloğu sayımı geçti. HTTP 503, eksik kitapçık ve kullanım hakkı bekleyişi başarı olarak gösterilmedi. Makine raporu [historical-inventory.json](historical-inventory.json).

Sonraki işler: kullanım koşullarını/uygun izin belgesini netleştirmek veya bağlantı+metadata gösterimiyle kalmak; soruları sayfa/şekil/tablo kontrolüyle tam kayda ayırmak; 24 konu ve açık madde sınırlarına tek tek eşlemek; eski/yeni hukuk karşılaştırması; aynı soru ve aynı hedef/bilişsel işlemi tekrar eden kayıtları birleştirmek. Bu işler tamamlanmadan N kesinleştirilmez ve Havuz C puan tahminine katılmaz.
