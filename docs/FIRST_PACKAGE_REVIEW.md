# İlk 657 paketi — Ayrı kaynak ve soru incelemesi

Üretici süreç: `first_questions`. İnceleyen ayrı süreç: `source_integrity-independent-review`. Bu çalışma **insan incelemesi değildir**; üreticinin kendi cevabını onaylamasından ayrı bir süreçte resmî hüküm, seçenek ve hedef karşılaştırmasıdır. Yayın için ayrıca tekrar çalıştırılabilir kaynak/kural kontrolleri gereklidir.

## Sonuç

**18 adayın 18'i, aşağıdaki düzeltmelerden sonra Pass aldı.** Son aday dosyası SHA-256:

`a0c2e59e38612369c0b9d5f6bb260e037676280ec879293b77c5fe6b5bbbc0d2`

İnceleme kayıtları [657-starter-review.json](../data/reviews/657-starter-review.json) içindedir. Her soru için kaynak alıntısı, HTML paragrafı, karar, gerekçeler ve tam aday nesnesinin `SHA256(JSON.stringify(question))` değeri saklandı. Soru sonradan değişirse bu inceleme yeni içeriğe otomatik uygulanamaz.

Bu rapor adayları doğrudan Approved yapmaz. Adaylar kaynaklı hazırlık paketi olarak, yalnız kaynak/kural denetimleri ve yayın kapısı da geçerse açılabilir. 01.01.2027 kesim tarihi henüz gelmediğinden nihai 2027 mevzuat sürümü onayı verilmedi.

## Kullanılan resmî kanıt

Kaynak, T.C. Adalet Bakanlığı UYAP resmî mevzuat hizmetinin 06.11.2026 tarihinde sunduğu 657 sayılı Kanun metnidir. Kaynak snapshot kimliği `SRC-OFFICIAL-657-UYAP-20261106-e179523117a8`.

- [Resmî belge](https://mevzuat.adalet.gov.tr/mevzuat/102924).
- [Kaynak/paragraf kayıtları](../data/public-legal-sources/657-provisions.json).
- [Resmî HTML arşivi hash manifesti](../data/public-legal-sources/657-source-audit.json).

İnceleme sırasında arşivdeki 11 resmî HTML dosyasının bayt uzunluğu ve SHA-256 değerleri yeniden kontrol edildi. Her adayın alıntısı, işaret ettiği resmî madde/paragrafın metniyle birebir eşleştirildi. 238. madde yalnız yürürlük metadata araştırması içindir; hiçbir aday soruya veya sınav kapsamına alınmadı. Kayıt güncellenme zamanı yürürlük tarihi olarak yorumlanmadı.

## İnceleme kapsamı

Her adayda 1–212 madde sınırı, tek doğru seçenek, beş farklı seçenek kimliği, dört çeldiricinin yanlışlık gerekçesi, soru kökünün bağlamı, açıklama ve kaynak konumu okundu. Kaynak paragrafında doğru seçeneğin adı önceki başlıktaysa ilgili başlık da ayrıca kontrol edildi; örneğin m.3'te Sınıflandırma/Kariyer/Liyakat başlıkları tanım bentleriyle birlikte değerlendirildi.

18 soru sekiz ana maddeyi temsil ediyor: **3, 54, 94, 102, 125, 129, 130 ve 135**. 94. madde senaryolarında 95 ve 96. maddeler bağlam/istisna kontrolünde ayrıca kullanıldı. Pakette beş senaryo var. Bu, O02'nin bütün kapsamını veya 24 konunun tamamını temsil etmez.

|Adaylar|Kontrol edilen bilgi|
|---|---|
|0001–0003|Sınıflandırma, kariyer ve liyakatin farklı tanım unsurları|
|0004|Adaylık içinde başka kuruma nakil yasağı|
|0005|Kesintisiz izinsiz/mazeretsiz terk ve yazılı başvurusuz çekilme isteğinde bulunulmuş sayılma|
|0006|Bir ay sonrası, özel hâller dışında üstüne haber vererek ayrılma usulü|
|0007–0009|Tam on yıl sınırı, on yıldan fazla hizmet süresi ve zorunlu yol eki|
|0010–0014|Beş disiplin cezasının farklı tanımları ve oran/süre/sonuçları|
|0015|Çıkarma istenen memurun evrak, tanık ve savunma hakları|
|0016|Savunma için asgari süre; süresinde savunmamanın sonucu|
|0017–0018|Memurun itiraz süresi ve merciin karar süresinin farklı başlangıçları|

## İnceleme sırasında düzeltilenler

1. **Q-O02-B-0001:** Liyakat çeldirici açıklamasındaki eksik cümle sınıflandırma tanımıyla yanlış okunabiliyordu. Üretici iki açık cümleye ayırdı; düzeltilmiş aday yeniden incelendi.
2. **Q-O02-B-0005 ve 0006:** Genel “olağanüstü yönetim hâli yok” ifadesi, ilan edilmiş OHAL dışında kalan genel hayata müessir afet durumunu yeterince açık dışlamıyordu. Köklerde olağanüstü hal, seferberlik, savaş ve genel hayata müessir afet tek tek dışlandı; devir-teslim yükümlülüğünün yokluğu da korundu. Yeni sürümler yeniden incelendi.

Ayrıca m.130 açıklamasında süresinde savunma yapmayanın savunma hakkından vazgeçmiş sayılması sonucunun korunduğu; m.129'da eski “sicil dosyası hariç” ibaresinin güncel metne geri taşınmadığı kontrol edildi.

## Tekrar ve ölçme sınırları

Aday metinleri uygulamadaki 24 gömülü +26 dış JSON eski kaydın metinleriyle karşılaştırıldı; birebir tekrar bulunmadı. Eski adaylık süresi sorusu (id3/id102) ve itiraz mercii sorusu (id4) yalnız yeniden ifade edilerek pakete alınmadı. Adaylar kendi aralarında farklı hedef/bilişsel işlem çiftlerine sahip; aynı maddeye ait soruların farklı bilgi, koşul veya işlem aşamalarını sorduğu ayrıca okundu.

Bu uygulama içi inceleme, bütün dünyadaki soru kaynaklarında benzersizlik araştırması değildir. Henüz madde güçlüğü, ayırt edicilik veya bağımsız sınav puanı tahminine uygunluk hakkında ampirik veri yoktur. Paketin Pass kararı, insan uzman onayı veya nihai içerik kabulü diye etiketlenmemelidir.
