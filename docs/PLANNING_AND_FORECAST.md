# Çalışma planı, tahmin ve odak yönetimi

Bu modüller yerelde çalışır; haricî servise cevap, ilerleme veya kaynak göndermez. Test verileri yapay algoritma örnekleridir ve soru envanterine girmez. Soru tamamlama, müfredat kapsamı ve öğrenme hâkimiyeti `curriculumIndicators` ile ayrı hesaplanır; bu modüller üçünü birbirinin yerine kullanmaz.

## Tahmin

`buildForecast({observations, now?})` 24 resmî konuyu sabit ağırlıklarıyla kullanır. Toplam puan, bütün konularda yeterli ölçüm varsa `Σ (konu ağırlığı × tahmini doğruluk olasılığı)` olarak hesaplanır. Bir konunun ölçülmemesi sıfır doğruluk değildir: olasılığı ve beklenen kaybı `null` kalır. Yetersiz konulardan biri bile varsa toplam puan ve toplam aralık `null`, durum `insufficient-data` olur. Şu anki küçük ve tek konuya ait paket bütün sınav için tahmin sağlamaz.

Bir cevap gözlemi `questionId`, `objectiveId`, `topicId`, `attemptId`, `sourcePool`, `correct`, `firstSeen`, `completedAttempt`, `independentMock`, `answeredAt`, `difficulty`, `cognitiveType` alanlarını taşır. Bunlar cevap anındaki değişmez soru sürümünden ve gerçek oturum günlüğünden üretilmelidir. Aynı soru kimliği sürüm değiştirse de ilk karşılaşma sayılmaz. Ön izleme veya kartta görülmüş soruya `firstSeen=true` verilmez. Tam deneme gözleminde boş sorular da `correct=false` olarak yer almalıdır; yalnız işaretlenen soruları almak tamamlanmış 100 soruluk deneme değildir. Yeni sürümü geçmiş sonuçlara uygulayarak metadata değiştirilmez.

Sayım koşulları:

- İlk karşılaşmalar kronolojik ayıklanır. Aynı kimliğin tekrarları, `firstSeen=false` cevaplar, tamamlanmamış oturumlar ve gelecek tarihli/geçersiz kayıtlar tahmine girmez. Tarihî havuz C, güncel sınav tahminine girmez.
- Havuz A ancak aynı oturumda tam 100 benzersiz ve ilk kez görülen soruyla resmî her konu ağırlığına uyan, bitirilmiş bağımsız denemeyse kullanılır. Eksik ya da tekrar edilmiş bir A denemesi B çalışmasına dönüştürülmez.
- Konu başına en az `max(12, 2 × konu ağırlığı)` ilk karşılaşma, üç öğrenme hedefi, iki zorluk düzeyi, iki bilişsel işlem ve iki tamamlanmış oturum gerekir. Etkin örneklem bu sayının en az yarısı olmalıdır. Bunlar şimdilik kalite eşikleridir; psikometrik doğrulama iddiası taşımaz.

A soruları B sorularından daha güçlü kanıttır (göreli ağırlık 1 ve 0,65). Yakın tarihli cevaplar 60 günlük yarılanma ile daha fazla ağırlık alır. Aynı hedef ve aynı zorluk düzeyi aşırı örneklenmişse karekök dengelemesi etkisini azaltır. Bu işlem resmî sınavın bilinmeyen zorluk dağılımını uydurmaz. Kish etkin örneklem kaynak türü ve eskimeyle azaltılır; iki simetrik ön gözlem ile 0 ve 1 uçlarına aşırı güven engellenir. Eski ve dengesiz veri yeterlilik kapısını geçemeyebilir.

Konu aralığı, etkin örnekleme dayanan yaklaşık Wilson aralığıdır; toplam aralık konu alt/üst sınırlarının ağırlıklı toplamıdır. Bu geniş aralık konular arası ortak belirsizliği bağımsızmış gibi daraltmaz. Resmî sınav için kalibre edilmiş yüzde 95 güven aralığı değildir. Yeterli veride bile durum `experimental` olur; 85+ veya başka bir sonuç garanti edilmez. `evidence` alanı ham/uygun/tekrar/harihî/geçersiz sayıları ve bağımsız deneme kimliklerini, her konu da hedef/zorluk/bilişsel çeşitliliği ve etkin örneklemi gösterir. Yeterli konu için beklenen puan kaybı `ağırlık × (1 − olasılık)`tır.

`calibrateForecasts(savedForecasts, laterMockOutcomes)` tahmin anından **sonra başlayan**, daha önce tahmin verisine katılmamış, ilk kez çözülmüş, bağımsız ve dağılımı doğrulanmış 100 soruluk ilk denemeyle karşılaştırır. Tahmini deneme başladıktan sonra kaydetmek veya tekrarlanan denemeyi doğrulama saymak engellenir. Mutlak ve işaretli hata saklanır. Aynı denemeden önce kaydedilen çok sayıda tahmin, bağımsız doğrulama sayısını artırmaz; ortalama mutlak hata önce deneme başına, sonra denemeler arasında ortalanır. Beş farklı bağımsız doğrulama olmadan kalibrasyon durumu yetersizdir. Bununla birlikte beş deneme tek başına modelin geçerliliğini kanıtlamaz.

## Plan

`buildStudyPlan({now?, startDate?, capacities?, objectives, availableQuestions, topicSignals?, completedSessions?, solvedQuestionIds?, scheduleMock?, mockAvailable?})` yedi günlük öneri üretir. Varsayılan kapasite pazartesi–cuma 60'ar, cumartesi/pazar 90'ar dakikadır: **haftada 480 dakika**. Her gün 0–720 tam dakika olarak değiştirilebilir. Tarih ve sınava kalan gün `Europe/Istanbul` takvimine göre hesaplanır; cihazın başka saat diliminde olması günü kaydırmaz.

Normal 60 dakikalık gün 30 dakika kaynak öğrenme, 10 dakika tekrar, 20 dakika soru çözümüdür. Ek kapasite aynı döngüyle gerçek dakika bütçesine sığdırılır. Soru sayısı dakikaya ve gerçekten mevcut onaylı B sorularına göre 5/10/20/25/50/100 paketlerinden seçilir. Beş uygun soru bile yoksa süre kaynak öğrenmeye ayrılır; eksik sorular tamamlanmış gibi gösterilmez. A ve C soruları çalışma paketine sızmaz. Konu ve hedef eşleşmesi olmayan kayıtlar kullanılmaz. Aynı paket farklı günlerde önerilebilir; tekrar cevapları bağımsız tahmin kanıtı olmaz.

Sadece gerçek kaynak kanıtı ve kimliği bulunan hedefler önerilir. Taslak hedefler için `sourceStatus=pending` ve açık doğrulama/kapsam uyarısı bulunur. Bunlar onaylı kapsam olarak sayılmaz. Görev `topicId`, `objectiveId/objectiveIds`, var olan soru ilişkisinden `legalProvisionId/legalProvisionIds`, `sourceDocumentId`, madde/fıkra/bent veya tarihî dönem/olay konumunu taşır. Var olmayan madde kimliği uydurulmaz; kimlik yoksa `null` ve okunabilir kaynak konumu kullanılır. Birden çok hedeften gelen soru paketinin bütün hedef ve hüküm kimlikleri korunur.

Öncelik, konu ağırlığıyla ölçeklenen beklenen açık/unutma/kapsam/güven bileşiminin öğrenme süresine bölünmesiyle hesaplanır. Katsayılar sırasıyla 0,45 / 0,20 / 0,20 / 0,15; sınav yaklaştıkça aciliyet artar. Bilinmeyen başarı için yalnız plan önceliğinde nötr 0,5 varsayımı kullanılır; bu değer ölçülmüş doğruluk ya da puan tahmini olarak gösterilmez. `probability=null`, `expectedLoss=null` korunur. Açıklama konu ağırlığını, ölçüm/kapsam eksikliğini, son tekrarın üzerinden geçen günleri ve ölçüm güvenini somut gösterir. Bu önceliklendirme öğrenme kazancının doğrulanmış nedensel modeli değildir.

Tam deneme için doğrulanmış 100 benzersiz soruluk korunan sınav kimliği gerekir. Tek günde 150 dakikalık kesintisiz kapasite yoksa ve hafta sonu toplamı en az 150 ise cumartesi 150, pazar kalan dakika olarak ayrılır. Varsayılan bütçe böylece **150+30**, haftalık toplam yine **480** olur. Hafta sonu da yetersizse deneme bölünmez ve atanmaz. Kaynak sorular hazır değilse sahte deneme atanmaz. Sınav tarihinde veya sonrasında yeni hazırlık görevi atanmaz.

Planı açmak, günü geçirmek veya görevi önermek çalışma değildir. `completedSessions` yalnız gerçekten kaydedilmiş pozitif çalışma dakikalarını alır; gelecek gün kayıtları yok sayılır. Geçmişte hiç çalışılmamış gün `missed`, kısmen çalışılan gün `partial` olur. Günün dakika bütçesini doldurmak günü tamamlar; belirli görevi tamamlamak ayrıca o `taskId` ile yeterli dakika gerektirir. Kaçırılmış günler otomatik tamamlanmaz, ilerleme sıfırlanmaz. Plan kendisi kullanıcı günlüğüne yazmaz; günlük kapasiteler arayüz ayarlarında ve tam yedek zarfında korunabilir.

## Odak

`createFocusStore({indexedDB?, dbName?})` varsayılan olarak `gys_focus_v1` adlı ayrı IndexedDB kullanır. Eski localStorage anahtarlarına, sınav cevaplarına ve başka uygulama veritabanlarına yazmaz. Varsayılan çalışma/mola 25/5 dakikadır; sırasıyla 1–180 ve 1–60 aralığında değiştirilebilir. Etkin oturumun süreleri sonradan ayar değişince sessizce değişmez.

API: `getSettings`, `setSettings`, `getActive`, `start({id?,now?,visible?})`, `tick({now?,visible})`, `pause`, `resume`, `confirmPhase({now?,visible,skipBreak?})`, `listSessions`, `exportData`, `importData`, `close`. `exportJournal`/`importJournal` eş adları vardır. `validateFocusSettings` ve `validateFocusJournal` dışarıdan kullanılabilen saf doğrulayıcılardır. Journal şeması `{schemaVersion:1, settings, sessions}` şeklindedir. İçe aktarma birleştirir; var olan farklı oturum veya ayar çakışması bütün işlemi reddeder. İçe aktarılan çalışan sayaç duraklatılır; yeniden başlatmak kullanıcı eylemidir. Veri silme yoktur.

Arayüz görünürken yaklaşık saniyede bir `tick` çağırmalı, `visibilitychange` olayında da yeni görünürlük durumuyla çağırmalıdır. Önceki örnekte görünür olan en fazla 15 saniyelik aralık aktif süreye eklenir. Daha uzun callback boşluğu, tarayıcı yeniden görünür olsa bile aktif çalışma kanıtı sayılmaz. Arka planda duvar saati ilerler; aktif çalışma/mola süresi ilerlemez. Bu yaklaşım, görünürlük olayının hiç gelmemesi veya tarayıcının donması halinde iyimser otomatik tamamlama yapmaz. Görünür pencere kullanıcının dikkat ettiğinin kesin kanıtı değildir; kısa kapanma boşluklarını kusursuz ayırma iddiası yoktur.

Süre dolunca durum `awaiting-confirmation` olur. Görünür ekranda açık `confirmPhase` çağrısı olmadan sonraki faza veya `completed` durumuna geçilmez. Mola kullanıcı tarafından açıkça atlanabilir ve `breakSkipped` kaydedilir. Uzun arka plan süresi oturumu bitirmez. Geriye giden cihaz saati işlemi reddeder; yerel saat güvenilir sunucu saati sayılmaz. Bu odak sayacı Strict Mode sınav sayacından ayrıdır: gerçek denemede duvar saati arka planda da işlemeye devam eder.

## Doğrulama

`tests/analytics.test.ts`, `tests/planner.test.ts`, `tests/focus-store.test.ts` toplam 23 test içerir: yetersiz veri, bilinmeyen konu, tekrar etkisi, hedef çeşitliliği, bağımsız tam deneme, eskime, ileriye dönük kalibrasyon; 480 dakika, hafta sonu denemesi, gerçek soru mevcudiyeti, İstanbul gece yarısı, kaçırılan günler; IndexedDB kalıcılığı, arka plan/aktif süre ayrımı, manuel faz onayı, saat gerilemesi, atomik çakışma ve sekmeler arası eşzamanlı başlangıç. Bunlar gerçek iPhone Safari kabul testi değildir.
