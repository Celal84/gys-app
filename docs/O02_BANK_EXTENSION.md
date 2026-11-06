# O02 konu bankası — 82 yeni özgün aday

06.11.2026. Üretim durumu: **82 ValidationPending**, bu paket tarafından **0 Approved**. Mevcut 18 onaylı soru korunmuştur. Bu rapor, 82 adayın bağımsız inceleme ve yayın kapısından geçtiğini iddia etmez.

## Tamamlanan iş

`Q-O02-B-0019`–`Q-O02-B-0100` arasında 82 soru elle yazılmıştır. Her soruda beş kalıcı seçenek kimliği, tek doğru seçenek kimliği, çözüm, dört ayrı çeldirici açıklaması ve kavramı, resmî hüküm, kesintisiz kaynak alıntısı, alıntı SHA-256 değeri, kaynak locator'ı ve beklenen hüküm parçaları bulunur. Sorular `bank_growth` tarafından oluşturulmuş; kendi kendine onaylanmamıştır.

Paket 657 sayılı Kanunun **74 farklı maddesinden** 82 ayrı öğrenme hedefi önerir. O02 için resmî sınır olan **1–212** aşılmamıştır. Bu 74 maddenin tamamındaki bütün hükümler ölçülmüş sayılmaz; diğer maddeler kapsam dışı ilan edilmemiştir. Mevcut müfredat haritası değiştirilmemiştir; yeni hedefler inceleme ve entegrasyon için ayrı tutulmuştur.

İlk 18 sorunun sınıflandırma/kariyer/liyakat, adayın başka kuruma nakli, 94. madde, yıllık izin süreleri, disiplin cezalarının tanımları, savunma ve itiraz süreleri hedefleri yeni sözlerle tekrar üretilmemiştir. Yeni paket; ödev ve yasaklar, kamu görevlisi zararı, memur hakları, aday eğitimi, atama, ilerleme, nakil, çalışma ve izin, disiplin usulü, uzaklaştırma, mali ve sosyal haklardan farklı hükümler seçer. Metinsel ve hedef kimliği kontrolü hukuki/anlamsal bağımsız incelemenin yerini tutmaz.

## Resmî kaynak kanıtı

Kaynak, T.C. Adalet Bakanlığının [UYAP Mevzuat 657 kaydı](https://mevzuat.adalet.gov.tr/mevzuat/102924) ve resmî sayfanın kullandığı herkese açık Bedesten belge hizmetidir. Token veya gizli erişim bilgisi kullanılmamıştır. Drive'a erişilmemiş veya yazılmamıştır.

- Önceki değişmez tam belge snapshot'ı korunur: `SRC-OFFICIAL-657-UYAP-20261106-e179523117a8`, içerik sürümü **503**.
- Tam ham yanıt SHA-256: `e179523117a8b6c1d8addc4f4151b6410320be70ce14d9f4146c34ac162b26c0`.
- **117 ayrı resmî madde HTML'i**, toplam **484.735 bayt**, özgün UTF-8 baytlarıyla `data/public-legal-sources/snapshots/` altında saklanmıştır. CRLF ve özgün boşluklar yeniden biçimlendirilmemiştir.
- Yeni HTML paragraflarının tamamı önceki tam resmî belge metninde bulunmuştur: **0 uyuşmazlık**. Bu sonuç metin bütünlüğü kanıtıdır; bütün maddelerin yürürlük/geçiş hükümlerinin ayrı hukuki kabulü değildir.
- Yalnız gerekli 74 madde sorulara bağlanmıştır. Diğer kaynak maddeleri onaylı soru adedini artırmaz.
- Her madde için gerçek alım zamanı, resmî madde kimliği, resmî içerik sürümü, ham yanıt ve HTML hash'leri ayrı tutulur. Tam belge alım zamanı sonradan alınan madde HTML'lerinin alım zamanı olarak kullanılmamıştır.

`657-extension-provisions.json` ve `657-extension-source-audit.json`, eski 18 sorunun imzalı kaynak dosyaları değiştirilmeden ayrı oluşturulmuştur. Resmî m.56 ve m.127'deki 7573/2026, m.104'teki 7578/2026 değişiklikleri metinde korunur; eski m.57 veya eski 8+8 haftalık analık izni üzerinden soru üretilmemiştir. Yayım ve yürürlük tarihleri değişiklik kabul tarihlerinden türetilmemiş; bağımsız çözümlenmeyen madde tarihleri `null` kalmıştır.

**Kesim tarihi 01.01.2027 henüz gelmemiştir.** Tüm paket hazırlık mevzuatı sürümüdür; nihai 2027 sınav sürümü olarak sunulamaz. Sonradan değişen hüküm soruları yeniden incelemeye aldırmalıdır.

## Ölçme çeşitliliği

| Ölçüm | Yeni 82 aday | Mevcut 18 + yeni 82 |
| --- | ---: | ---: |
| Temel bilgi | 20 | 25 |
| Orta | 30 | 36 |
| Zor | 15 | 19 |
| Uygulama/yorum | 17 | 20 |
| Olay/senaryo işaretli | 17 | 22 |

Başlangıç zorluk hedefi 25/30/25/20'dir. Orta ve zor dağılımındaki **+6/−6 sapma** saklanmamıştır: doğrudan hatırlama sorularına yalnız kotayı tutturmak için zor etiketi verilmemiştir. Zorluk düzeyleri ön değerlendirmedir; yeterli kullanıcı verisiyle ampirik kalibrasyon ayrıca yapılmalıdır. Senaryo oranı birleşik bankada %22'dir ve en az %10 hedefini karşılar.

## Otomatik kontrol

Makine raporu: [`657-extension-checks.json`](../data/public-legal-sources/657-extension-checks.json).

**1.834 kontrol, 0 hata:** kaynak dosyası ve 117 HTML bayt hash'i; ayrı HTML parser'ıyla paragraf çıkarımı; kaynakta kesintisiz alıntı ve alıntı hash'i; hüküm parçaları; beş benzersiz seçenek; kalıcı cevap eşlemesi; dört çeldirici ve kavram; companion rule eşitliği; kaynak-hedef-soru bağları; 1–212 sınırı; adayların yayımlanmamış statüsü; mevcut 18 soruyla normalize metin ve hedef/işlem anahtarı çakışmaması. İlk kontrolde atlanmış ara paragraflar nedeniyle 9 alıntı kesintisiz eşleşmemiş, bütün ara paragraflar eklenerek düzeltilmiştir.

Bu kontroller bağımsız hukuki/anlamsal onay değildir. Ayrı inceleyici üreticiyle aynı kişi değildir; soru hash'i üzerinden inceleme kararı bağlanmalıdır. Yeni paketin uygulama yayını ve tüm regresyon testleri ana entegrasyonda ayrıca yapılır. Gerçek iPhone Safari testi bu içerik üretimi sırasında yapılmamıştır.

## Dosyalar ve kalan iş

- [`o02-bank-extension.json`](../data/content-candidates/o02-bank-extension.json): 82 soru ve 82 kaynak bağlı hedef önerisi. SHA-256: `38ec0a34fe8f05f15e43ee4d2e5abbf4cd0294dec5eaa870f2923862f5209603`.
- [`o02-bank-extension-rules.json`](../data/content-candidates/o02-bank-extension-rules.json): 82 bağımsız denetime hazırlık kuralı. SHA-256: `687fc2a39c135f71bb4253a97d2c44b055cdd6a2d881fa8760a11bd3dd01ebe2`.
- [`657-extension-provisions.json`](../data/public-legal-sources/657-extension-provisions.json), [`657-extension-source-audit.json`](../data/public-legal-sources/657-extension-source-audit.json): 117 resmî madde ve yeniden üretilebilir HTML kanıtı.
- [`657-extension-objectives.json`](../data/public-legal-sources/657-extension-objectives.json): 82 hedef önerisi. Entegrasyonda `learningObjective` → `objective`, `articleNumber/clause` → `legalReference.article/clause`, `learningStatus` → `learningState` eşlenmelidir.

Sonraki bağımlı işler: ayrı inceleyicinin hukuki doğruluk ve anlamsal tekrar kararı; hedeflerin onaylı müfredata eklenmesi; çoklu kaynak paketini destekleyen yayın kapısına entegrasyon; kuralları ve incelemeyi geçen adayların Approved yayını. **Ancak bundan sonra** mevcut 18 ile O02 bankası 100 onaylı soruya ulaşmış sayılabilir. Çıkmış sorular bu pakete dahil değildir; 30 korunan deneme veya diğer 23 konu tamamlanmış sayılmaz.
