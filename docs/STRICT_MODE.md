# Strict Mode kayıt motoru

`src/strict-store.ts`, mevcut çalışma kayıtlarını ve eski localStorage verilerini değiştirmeyen, ayrı bir IndexedDB günlüğüdür. Yazılım motoru tamamlanmıştır; gerçek **100 onaylı Havuz A sorusu bulunmadığı için yayımlanabilir tam deneme halen 0'dır**. Testlerdeki 100 soruluk paket sentetiktir, uygulamaya eklenmez ve soru üretim sayısına katılmaz.

## Başlatma ve yayın kapısı

`createStrictStore({dbName?, clock?, idFactory?})` varsayılan olarak `gys_strict_v1` veritabanını açar. Veri kaydı şeması 1, veritabanı sürümü 2'dir. Sürüm geçişi yeni depolar ekler, eski kayıtları silmez; tanım ve soru rezervasyonlarını geçmiş kayıtlardan kurar.

`start({definition, questions, snapshots})` şunları zorunlu tutar:

- Doğrulanmış, sürümlü tanım; `verifiedAt`, inceleme kanıtı ve sıralı 100 `questionIds`.
- Her birinin `examId` alanı bu tanımın kimliğine bağlı, `canPublishQuestion` kapısından geçen 100 farklı Havuz A sorusu.
- 24 kanonik konunun her birinde resmî ağırlık, toplam 70 ortak / 30 teknik soru. Eksik deneme Havuz B veya başka içerikle tamamlanmaz.
- Kaynak hash'i, sürümü, bağımsız cevap doğrulaması ve gerekli madde/kapsam kanıtı.
- Deneme içinde farklı soru kimlikleri ve normalize metinler; başka deneme kimliğine ayrılmamış soru kimlikleri ve metinler.

Aynı tanım kimliği ve sürümündeki içerik değişmez. Düzeltilmiş içerik yeni sürüm gerektirir; önceki sonuç ve kaynaklar korunur. Soru rezervasyonu tanım kimliğine bağlıdır, başka denemeye aktarılamaz. Aynı denemenin yeni sürümü, aynı soru kimliklerinin düzeltilmiş sürümlerini saklayabilir. Anlamsal/öğrenme hedefi benzerliklerinin uzman incelemesi tanımın doğrulama sürecinde tamamlanmalıdır; normalize metin kontrolü bu incelemenin yerine geçmez.

## Arayüz bağlantısı

```ts
const strict = createStrictStore();
let view = await strict.getActiveView();
// Gerçek, onaylı yayımlanmış bir paket varsa:
// view = await strict.start({ definition, questions, snapshots });

if (view) {
  view = await strict.saveAnswer(view.id, {
    questionId: view.questions[view.cursor].id,
    selectedOptionId: 'kalici-secenek-kimligi', // null cevabı temizler
    expectedRevision: view.revision,
  });
  view = await strict.setCursor(view.id, 42, view.revision);
}
```

`saveAnswer` seçenek seçildiğinde hemen beklenerek kaydedilmelidir. `setCursor` serbest ileri/geri geçiş, `finish(id, revision)` kullanıcı teslimi sağlar. Duraklatma API'si yoktur. Her yazma, cevap/konum/zaman ve özet revizyonunu tek transaction içinde kaydeder. Eski sekmenin revizyonu `StrictConflictError` alır; arayüz `loadView(id)` ile güncel kaydı yükler. Aynı anda iki aktif deneme başlatılamaz.

Sayaç için düzenli `loadView(id)` çağrılır. `getActiveView()`, `loadView()`, `getResult()`, `listSummaries()`, dışa aktarma ve geçerli yazmalar süreyi denetler. Süre dolduğunda bitiş, **başlangıç + 150 dakika** zamanıyla otomatik kaydedilir; geç cevap eklenmez. `getActiveView()` biten deneme için `null` döndürür; sonuç `listSummaries()` veya bilinen kimlikle `loadView()` üzerinden bulunur. Uygulama kapalıyken JavaScript'in çalıştığı iddia edilmez; süre sonraki erişimde kesin sonlanma zamanına göre tamamlanır.

`visibilitychange` ve `pagehide` olaylarında `setForeground(id, false, revision)`, görünür dönüşte `true` çağrılmalıdır. Bu işlem **süreyi durdurmaz**. Yeni bağlantı, önceki sayfanın ne zaman kapandığını bilemediğinden geçmiş boşluğu aktif düşünme süresine eklemez; yükleme sonrası görünürlük yeniden belirtilir. Arayüz cevap/konum/görünürlük yazmalarını sıraya almalı, başarısız kaydı kullanıcıya göstermelidir. İlk görüntüleme, bilinen ön plan süresi, geri dönüş ve cevap değiştirme sayısı ayrı tutulur; ön planda geçirilen süre zihinsel etkinliğin kesin ölçümü değildir.

Aktif `StrictView.questions` yalnız `id`, `version`, `topicId`, `text`, `options` içerir. Doğru cevap, açıklama, kaynak alıntısı ve `review` sonuç öncesinde dönmez. Tamamlanınca `review.questions` ve `review.snapshots` değişmez geçmişi verir. `getResult()` bitişten önce `null` döndürür. Puan doğru sayısıdır; yanlış ve boş cevap puan düşürmez. 24 konu ile ortak/teknik toplamlar ayrıca hesaplanır. Aynı tanım kimliği/sürümünün ilk ve tekrar girişimleri ayrı işaretlenir; farklı sürüm yeni ölçüm dizisidir.

## Saat ve yerel verinin sınırları

Varsayılan saat `Date.now()` ile `performance.now()` başlangıç çıpasını birlikte kullanır. Yaşam süresi içinde etkili zaman geri gitmez; kaydedilen en ileri gözlem, yeniden yüklemede de alt sınırdır. Geri alınmış cihaz saati `clockWarning` üretir. Testler için `clock: {now(), monotonicNow?()}` verilebilir.

Uygulama kapalıyken cihaz saati değişmişse geçen gerçek süre, yalnız çevrimdışı cihazdan kesin çıkarılamaz. Kaydedilmemiş kapalı süreyi doğrulayacak güvenilir sunucu saati yoktur. Saat uyarısı kullanıcıya gösterilmelidir; motor bunun gözetimli sınav düzeyinde güvenilir olduğunu iddia etmez.

Çevrimdışı cevap anahtarı IndexedDB içinde bulunur. Geliştirici araçları, cihaz erişimi veya tam JSON yedeği olan kişinin bunu teknik olarak kesin gizlemek mümkün değildir. Arayüzde cevapları gizlemek kriptografik gizlilik sağlamaz. JSON yedeği, aktif sınav geribildirimi olarak gösterilmemelidir.

## JSON yedeği

`exportData()` tam `StrictJournal` döndürür; `validateStrictJournal(unknown)` saf doğrulayıcıdır. Kaynak/dağılım kontrolleri, zamanlar, seçenek kimlikleri, ölçüm kayıtları, tekrar dizisi, en fazla bir aktif oturum ve yeniden hesaplanan sonuç denetlenir.

`importData(unknown)` yalnız birleştirir; mevcut kimlik/revizyonla farklı içerik çakışır ve işlem bütünüyle geri alınır. Geçmiş sonuç üzerine yazılmaz, veri silinmez. Tanım ve soru rezervasyonları kayıtlardan yeniden kurulur; içe alınan süresi geçmiş oturum tamamlanır. Birleşik yedek katmanı, bütün alanları önce doğrulayıp yeni profil veritabanına aktarabilir.

**Geçerli kullanıcı JSON'u içerik yayın yetkisi değildir.** İçe alınmış aktif oturum oynatılmadan önce uygulama gerçek yayımlanmış deneme manifestindeki tanım, soru/seçenek/cevap ve kaynak sürümleriyle tam eşleşmesini doğrulamalıdır. Kaynak onayı alanlarını kullanıcının JSON'da yazmış olması gerçek hukuki doğrulama yerine geçmez.

## Doğrulama

`npx vitest run tests/strict-store.test.ts` 20 otomatik kontrol içerir: gerçek dağılım kapısı, Havuz B reddi, cevap gizliliği, serbest cevap değişimi, puanlama, değişmez kaynak/cevap sürümleri, tam sınırda sonlanma, yeniden açılma, saat geri alma, arka plan ölçümü, sekme/revizyon çakışması, atomik geri alma, ilk/tekrar ayrımı, korunan rezervasyon, yedek doğrulama/birleştirme ve veri silmeyen şema geçişi.

Gerçek iPhone Safari kabul testi ve gerçek 100 soruluk yayımlanmış deneme kabulü bu birim testleriyle yapılmış sayılmaz.
