# Konu sorusunda ön plan süre ölçümü

`src/core/study-timing.ts` sayfa belleğinde çalışan bağımsız süre ölçer. Kalıcı ilerleme verisine veya eski localStorage anahtarlarına yazmaz. Toplam oturum/sınav süresi ile aktif cevaplama süresi farklıdır. Tarayıcının görünür olması kullanıcının gerçekten düşündüğünü kanıtlamaz; ölçülen değer yalnız gözlenen ön plan süresidir.

```ts
const timing = createStudyTimingTracker();
timing.setVisible(!document.hidden);
timing.view(question.id); // Yalnız cevaplanabilir soru gösterildiğinde.
timing.tick(!document.hidden); // Yaklaşık saniyede bir.
timing.recordAnswer(question.id, selectedOptionId); // İsteğe bağlı.
const measured = timing.finish(question.id); // Açıklama gösterilmeden önce.
// measured.activeTimeMs: Bu sayfada gözlenen konservatif süre.
```

`visibilitychange` sırasında `setVisible(!document.hidden)`, `pagehide` sırasında doğrudan `setVisible(false)` çağrılır. Gizleme olayına kadar gözlenen kısa ön plan aralığı kaydedilir; arka plandaki ve tekrar görünür olmadan önceki aralık eklenmez. Bir sonraki çağrıya kadar geçen aralık 15 saniyeyi aşıyorsa tamamı ölçülmemiş sayılır. Yapılandırmada daha küçük `maxGapMs` seçilebilir; 15 saniyenin üzerine çıkılamaz. Bu konservatif yöntem gerçek çalışmanın bir bölümünü eksik ölçebilir, büyük gözlenmeyen aralıkları düşünme süresi diye doldurmaz.

Varsayılan saat `performance.timeOrigin + performance.now()` olduğundan aynı sayfa içinde monotonik çalışır. Alternatif enjekte edilen saat geriye giderse son zaman yüksek su çizgisi korunur; saat önceki değere ulaşıncaya kadar süre eklenmez. Negatif zaman veya bozuk saat değeri süreyi değiştirmez. Saat geri dönüşleri ve ölçülmeyen aralık sayıları ayrıca kaydedilir.

Her soruda `firstViewedAt`, `lastViewedAt`, `activeTimeMs`, `viewCount`, `returnCount`, `answerChanges`, `lastSelectedOptionId`, `unmeasuredGapCount`, `clockRollbackCount`, `finishedAt` bulunur. İlk seçenek işaretleme değişiklik sayılmaz; başka seçenek veya boş seçimine dönüş değişikliktir. Aynı sorunun tekrar çizilmesi yeni görüntüleme sayılmaz; başka sorudan geri dönüş sayılır. `finish` sayacı durdurur ve çözüm açıklamasını okuma süresi eklenmez. Sonradan açıkça `view` çağrılırsa yeni cevaplama segmenti başlar.

`summary()` kopya kayıtlar döndürür, süreyi kendiliğinden ilerletmez. `tick()` veya görünürlük/bitirme/görüntüleme işlemi gözlem sınırını belirler. Yenileme/kapatma sonrası yeni sayaç eski aktif süreyi yeniden oluşturmaz; kalıcı cevap kaydındaki `activeTimeMs` yalnız bu sayfada ölçülen segment olarak saklanmalıdır. Eski cevaplar veya aktarılmış yedekler için yeni süre uydurulmamalıdır. Strict Mode’un devam eden 150 dakikalık mutlak süresini bu ölçer yönetmez.

Doğrulama: 9 birim testi geçti; ön plan/arka plan, uzun boşluk, geriye giden saat, soru dönüşü, seçenek değişimi, yenileme ve bağımsız kopya durumları kapsandı. ESLint ve TypeScript kontrolü geçti.
