# Öğrenme motoru

`src/core/learning.ts` saf SM-2, öz-açıklama ve kavram karşılaştırma önerilerini; `src/learning-store.ts` native IndexedDB kayıtlarını sağlar. Bu modül yeni soru üretmez. Mevcut onaylı soruların soru kökünü ve doğru seçeneğini kaynaklarıyla birlikte kart biçiminde sunar.

## Yayın ve korunan havuz

`registerCards({questions,snapshots,completedExamIds?,historicalRightsAcceptedIds?}, now?)`, mevcut `isAvailableFor` yayın kapısını kullanır. Onay, bağımsız kanıt, kaynak hash'i ve madde kapsamı geçmeden kart oluşmaz.

- B: yalnız `Approved` ve `flashcards` moduna uygun sorular.
- C: ayrıca tarihî kabul kararı ve soru kimliğinin `historicalRightsAcceptedIds` kümesinde olması gerekir. Kaynak/kapsam kabulü kullanım hakkı onayı yerine geçmez.
- A: tamamlanmış deneme kimliği verilse bile kart havuzuna kopyalanmaz. Tamamlanan denemenin hedefli yanlış incelemesi deneme motorunda kalır.

Kart `type` alanı `duration`, `authority`, `exception`, `sanction`, `concept`, `definition`, `date`, `comparison` değerlerini destekler. Kaynak hükümden ayrı incelemeyle çıkarılmış kart metni bulunmadığından başlangıç kartları `concept` ve `format: 'verified-question'` kullanır. Soru kökü `front`, kalıcı doğru seçeneğin metni `back`, doğrulanmış açıklama `explanation` olur. Bu dönüşüm yeni veya bağımsız soru sayılmaz.

Her kartta soru kimliği/sürümü, hedef/konu, kaynak snapshot kimliği, SHA-256, resmî URL, madde konumu ve hazırlık/sınav sürümü bulunur. Aynı kimlik ve soru sürümünün içeriği sessizce değiştirilemez. Yeni soru sürümü önceki kartı pasifleştirir; tekrar geçmişini silmez. Aynı sürüm yeniden doğrulandığında önceki tekrar planı korunur.

## API

```ts
const store = createLearningStore();
await store.registerCards({ questions, snapshots });
const cards = await store.dueCards(new Date(), 25);
const updated = await store.reviewCard(cards[0].id, 4, {
  expectedRevision: cards[0].revision,
  reviewedAt: new Date().toISOString(),
});
const detail = await store.getCard(updated.id);
const statistics = await store.stats();
const backup = await store.exportData();
validateLearningBackup(backup); // Saf ön kontrol; yayın yetkisi vermez.
await store.importData(backup);
await store.close();
```

`dueCards(now?,limit?)` vadesi gelen erişilebilir kartları indeks üzerinden en fazla 1.000 kayıtla döndürür; varsayılan sınır 100'dür. `getCard` erişilemeyen kaydı `null` döndürür. Arayüz, yüklediği güncel içerik parçalarını `registerCards` üzerinden eşleştirmelidir. Paket dışında bir kaynağın sonradan değişip değişmediği çevrimdışı kullanımda keşfedilemez.

## Uyarlanmış SM-2

Kalite puanı 0–5 arasında tam sayıdır. Kullanıcı puanı manuel verebilir; “Öğrendim” bildirimi veya tekrar sayısı tek başına hâkimiyet kanıtı değildir. `stats().mastery` bu nedenle `null` döner.

Orijinal SM-2'nin ilk iki başarılı aralığı 1 ve 6 gündür; sonrasında önceki aralık kolaylık katsayısıyla çarpılır. Bu uygulamada şartnameye uygun başarılı başlangıç aralıkları **1, 3, 7, 14, 30 gün**dür. Altıncı ve sonraki başarılı tekrar önceki aralık × güncellenmiş kolaylık katsayısıdır; sonuç en yakın tam güne yuvarlanır.

Kolaylık katsayısı başlangıçta 2,5'tir. Her puandan sonra `EF = max(1.3, EF + 0.1 − (5−q)×(0.08+(5−q)×0.02))` uygulanır. Taşma koruması için EF üst sınırı 10, aralık üst sınırı 36.500 gündür. Kalite 0–2 ise başarılı tekrar serisi sıfırlanır, başarısızlık sayısı artar ve yeniden çalışma 1 gün sonraya planlanır. Sonraki başarı 1 günlük başlangıç aralığına döner.

Tarih UTC ISO olarak saklanır, gün 24 saat kabul edilir. İstanbul mevcut UTC+03 düzeninde aynı yerel saatte tekrar oluşur; cihaz saat dilimini değiştirmek vade anını değiştirmez. Sınava kalan zamana göre çalışma önceliği başka bir planlama katmanıdır; bu SM-2 modülü vade tarihini sessizce kısaltmaz. Yerel cihaz saati güvenilir sunucu saati değildir.

## İsteğe bağlı öz-açıklama

`compareSelfExplanation({text,concepts,strictMode?,skipped?})`, kaynakla incelenmiş kavram listesiyle normalleştirilmiş tam sözcük/ifade eşleştirmesi yapar. Bir kavramın `requiredTerms` listesindeki bütün ifadeler aranır. Önceden tanımlanan `contradictionTerms` ifadeleri çelişki incelemesi için işaretlenir; doğal dilin anlamını veya olumsuzlamayı genel olarak çözümlemez.

Sonuç `matchedConceptIds`, `missingConceptIds`, `contradictionConceptIds` ve `conceptCoverage` içerir. Çelişki işaretlenen kavram kapsanmış sayılmaz. Boş kavram listesinde oran `null` olur. Bu oran mevzuat doğruluğu veya öğrenme hâkimiyeti puanı değildir. Arayüz yalnız erişilebilir, doğrulanmış kartın kaynaklı referansından kavram vermeli ve sonucu yardımcı ipucu olarak göstermelidir. Yanıt boşsa/atlanmışsa değerlendirme yapılmaz; `strictMode:true` değerlendirmeyi kapatır.

## Hata nedenleri

`ERROR_REASONS` dokuz nedeni içerir: bilgi eksikliği, dikkatsizlik, süre baskısı, çeldirici, soru kökünü yanlış okuma, yetki, süre/sayı, istisna ve eski mevzuat.

`recordError({questionId,questionVersion,topicId,userReason?,inferredReason?,conceptId?,relatedConceptId?,confidence?,activeTimeMs?,occurredAt?,id?,strictMode?})` kaydı isteğe bağlı alanları `null` saklayarak oluşturur. Kullanıcı nedeni ve tahmini neden ayrı tutulur; tahminde yöntem ve 0–1 güven gerekir. Cevap güveni 0–1, ön planda ölçülen süre 0–86.400.000 ms aralığındadır. Arka plan/duvar saati aktif düşünme süresi diye doldurulmaz. Aynı kimlikte aynı kayıt yinelenebilir; farklı içerik çakışmadır.

Bir kavram için en az **iki farklı soru kimliği** hata kanıtı bulunmadan karşılaştırmalı çalışma önerilmez. Aynı sorunun yeniden çözümü veya farklı sürümü bağımsız soru sayılmaz. Eşik aşıldığında bile sistem kesin kavram yanılgısı teşhisi koymaz. `strictMode:true` hem hata analizi kaydını hem kart değerlendirmesini kapatır; bitmiş deneme sonrasında analiz yapılabilir.

## Bütünlük ve yedek

Kart ve değerlendirme olayı aynı IndexedDB işleminde kaydedilir. `expectedRevision` eski sekmenin yeni ilerlemeyi ezmesini önler. Modül hiçbir kayıt silmez, eski localStorage alanlarına dokunmaz.

Yedek biçimi `{kind:'gys-learning',schemaVersion:1,exportedAt,cards,reviews,errors}` şeklindedir. `validateLearningBackup` tüm kimlikleri, alanları, tarihler ve sınırları denetler; SM-2 olay zincirini yeniden hesaplayıp kartın son planıyla eşleştirir. Bozuk/kesişen yedek bütün olarak reddedilir. İçe aktarma önce bütün çatışmaları kontrol eder, sonra tek işlemde birleştirir.

Yedek üzerinden yayın onayı kazanılamaz. Yerel onaylı kartla eşleşmeyen eski kayıtlar `available:false` korunur. Yedekte `available:true` yazması bu kuralı değiştirmez. Güncel gerçek kaynak paketi `registerCards` ile tam eşleştirilince kart etkinleşebilir. Bilinen kartın farklı metni/cevabı/kaynağı veya değişmiş yerel tekrar planı çakışmadır; ilerleme silinmez ya da sessizce geriye alınmaz. PDF geri yükleme biçimi değildir.

## Doğrulama

`npx vitest run tests/learning.test.ts tests/learning-store.test.ts`: **18 test geçti**. Gerçek onaylı paket dönüşümü, korunan havuz/hak kapısı, SM-2 başlangıcı/başarısızlık/vade, saat dilimi, kalıcılık, sekme çatışması, Strict engeli, kaynak revokasyonu, öz-açıklama sınırları, bağımsız kanıt eşiği ve atomik/karantinalı yedek ele alındı. IndexedDB testleri `fake-indexeddb` kullanır; gerçek iPhone Safari kabul testi yapıldığı anlamına gelmez.
