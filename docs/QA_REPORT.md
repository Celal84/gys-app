# QA — 6 Kasım 2026

Durum: **çalışan uygulama / kısmi doğrulanmış içerik**. Nihai kabul verilmedi. Yayımlanan çalışma içeriği O01/O02/O03/T01 bankalarında 100'er, toplam **400** sorudur. Korunan havuzda **246 kaynakla doğrulanmış parça** PWA dosyalarının dışında bekler; iki aday anlamsal tekrar nedeniyle incelemededir. **Hazır tam deneme 0/30**. Bu parçalar 400 kullanılabilir soruya eklenmez.

| Kontrol | Gerçek sonuç | Sınır |
| --- | --- | --- |
| TypeScript / ESLint | Geçti | Uygulama, çekirdek, kayıt katmanları, yayıncılar ve testler |
| Vitest | **195/195 geçti**, 24 dosya | Native IndexedDB, kaynak/yayın/korunan havuz, zaman, yedek, PDF, öğrenme, plan/tahmin ve regresyon; son toplu çalıştırma 15:10 UTC |
| Python kaynak testleri | **19/19 geçti** | HTML blokları/dipnotlar ve resmî kaynak kontrol kuralları |
| Mobil Chromium | **13/13 geçti** | 390×844; gerçek 400 soruluk derleme |
| WebKit iPhone 14 emülasyonu | **13/13 geçti** | 390×664 görünür alan; fiziksel iPhone/Safari değildir |
| Üretim derlemesi / PWA | Geçti | Yerel paketler, konu parçaları, PNG simgeler, çevrimdışı font/PDF; yaklaşık 5 MiB precache |
| B yayın kontrolü | **400 onaylı**, 166 gerçek HTML artifact hash kontrolü | Ayrı süreç model destekli kaynak incelemesi + deterministik kural; insan hukuk uzmanı onayı değildir |
| A yayın kontrolü | **246/248 kaynakla doğrulanmış parça**, 2 NeedsReview | Eksik 100 soruluk tanım, 24 konu ağırlığı veya ayrı tam deneme incelemesi varsa PWA'ya yayımlanmaz |
| Mevzuat nöbetçisi | **23/23 gerçek resmî kaynak kontrolü başarılı** | 06.11.2026 14:12:22 UTC; sonraki gerçek API kontrolü yalnız O02 için 14:43:51 UTC; teknik gözlem hukuki onay değildir |
| Bağımlılık denetimi | Üretimde **0**, geliştirmede **10 orta / 2 düşük** | Kritik/yüksek 0; kalan derleme bağımlılıkları nihai güvenlik kabulü değildir |
| Fiziksel iPhone Safari | **Yapılmadı** | Emülasyon bu kabulün yerine geçmez |
| GitHub Actions | Yeni commit sonrası gözlenecek | Önceki 18 soruluk sürümün yeşil sonucu yeni sürüme mal edilmez |

## Sınanan ürün davranışları

- Gerçek beş soruluk çalışmada 4 doğru/1 yanlış/0 boş; seçenekler kalıcı kimlikle eşleşir. Yanlıştan sonra bağlantı kesilip yenileme yapılır; cevap, seçenek sırası, XP, sonuç ve yanlış defteri korunur. Eski v1 localStorage baytları değişmez.
- Alt konu/kaynak hüküm ve zorluk filtresi gerçekten kalıcı pakete uygulanır. 50 istenip daha az uygun soru varsa yalnız mevcut sayı açılır; başka konudan tamamlanmaz.
- Kart yanıtı açılmadan gizlidir; kalite 0–5 ve SM-2 uyarlaması kaydedilir. Kaynak/korunan A/hak denetimi kartlara uygulanır. Tek yanlış kesin kavram yanılgısı veya öğrenme kanıtı sayılmaz.
- Varsayılan takvim 480 dakika; kapasite değişikliği ve tema kalıcıdır. Çalışılmamış günler otomatik tamamlanmaz. Ölçülmeyen konu başarıya sıfır olarak eklenmez. Yetersiz ölçümde puan ve belirsizlik aralığı üretilmez.
- Odak ve soru ön plan süreleri arka planı ve 15 saniyeden uzun gözlenmeyen boşluğu çalışma saymaz. Strict Mode duvar süresi arka planda devam eder; yenileme/son tarih/otomatik bitiş/cevap değişimi/yeni-tekrar ayrımı 20 çekirdek testinde doğrulanır. Gerçek tam deneme içeriği kabulü yapılmış değildir.
- Tam JSON yedeği şema/hash/çakışma denetiminden geçer. Bozuk dosya onay veya kısmi yazma başlatmaz. Yeni profil ayrı veritabanlarında hazırlanır; etkin işaretçi ancak hazırlık bitince tek transaction ile değişir. Önceki profil silinmez. Farklı veritabanlarının bütün yazılarının tek transaction olduğu iddia edilmez.
- Gerçek Türkçe Unicode fontlu PDF indirilip PDF parser ile açılır; uzun içerik sayfalara bölünür. PDF geri yükleme kaynağı değildir.
- İçe aktarılan `Approved` etiketi yayın yetkisi sayılmaz. Soru/cevap/kaynak ve ölçüm metadata'sı gerçek paketle eşleşmelidir. Bilinmeyen aktif deneme korunur; doğrulanmamış geçmiş sonuç bağımsız ölçüm etiketi/tahmin kazanmaz.
- Mevzuat kontrolü başarısızken önceki başarılı tarih korunur. Kaynak kimlik takma adları resmî URL ile eşleşir. Yeni kontrol referansı değişse bile eski sorular yeniden onaylanmadan canlanmaz. Kaynak değişimi geçmiş sonuçları değiştirmez.

## İncelemede yakalanıp düzeltilenler

400 soru kabulünden önce Q52/Q67 (657 koşul/istisna), Anayasa süre ve çoğunluk kökleri, O01 birim çeldiricileri, İskân Q88 eksik kaynak paragrafı ve DSİ özel rejimi sınırları düzeltildi. Zor etiketleri kota için yapay yükseltilmedi. O01 A38/A106 anlamsal tekrar nedeniyle bekler. Ayrı yedek incelemesindeki güncel can değeri, geçmiş deneme bağımsızlık etiketi ve eski/yeni güven denetimi farkları uygulamada giderildi.

Bir eski test ilk konunun onaysız olduğunu varsayıyordu; O01 yayımlandığında test boş yayın deposu fixture'ıyla doğru biçimde sınırlandı. PDF uzun rapor testi, eşzamanlı 23 süreç ve tarayıcı yükünde 5 saniyeyi aştı; Vitest iki işçiyle çalışır ve test değişmeden yaklaşık 1,4 saniyede geçti. WebKit çevrimdışı akışında seçenek metnindeki “devam et” ifadesi gevşek düğme seçicisini çakıştırdı; seçici tam erişilebilir ada bağlandı. Hatalar başarı gibi raporlanmadı.

## Açık kabul işleri

- **İçerik:** 400/2.400 çalışma sorusu; 0/3.000 tamamlanmış deneme sorusu; 0/30 deneme. 246 doğrulanmış korunan parça tam deneme değildir. O05/O06/T02 üretimi ve ayrı incelemesi sürer. 5.400 nihai hedef tamamlanmadı.
- **Kapsam:** 24 konuda 166 alt konu/176 başlangıç hedefi taslağı ve dört bankanın ayrı hedefleri var. Nihai kapsam paydası, bütün yürürlük/geçiş değerlendirmesi ve öğrenme hâkimiyeti kabulü eksik.
- **Kaynak:** 24 not dosyası hash'li; 657 Word çıkarım farkı ve O04 renkli kutu/OCR bütünlük açığı sürüyor. Tam görsel dosya kabulü verilmedi.
- **Çıkmış:** 9 resmî kitapçık, 480 anahtar eşleşmesi, 580 gözlenen pozisyon; Accepted 0, uygun benzersiz N bilinmiyor. Tam metin yeniden yayımı kullanım hakkı izni bekler. 2020 tam kitapçığı varmış gibi soru üretilmez.
- **Tarih/işletim:** 01.01.2027 kesimi gelecekte; hazırlık sürümüdür. Zamanlanmış workflow varsayılan dala alınmadan sürekli çalışır sayılmaz. Sunucu/API olmadan PWA kapalıyken resmî kaynak taraması yapılmaz. Yeni HTTPS canlı yayın yapılmadı.
- **Cihaz/güvenlik:** Fiziksel iPhone kurulumu/gerçek Safari, depolama tahliyesi ve nihai güvenlik/performans kabulü bekler. Yerel cevap anahtarlarının mutlak gizliliği iddia edilmez.

Kanıtlar: [test-results.json](test-results.json), [browser-acceptance-report.json](browser-acceptance-report.json), [WEBKIT_REPORT.md](WEBKIT_REPORT.md), [content-inventory.json](content-inventory.json), [content-publication-report.json](content-publication-report.json), [protected-exam-publication-report.json](protected-exam-publication-report.json), [security-audit.json](security-audit.json), [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md). Tarihî başlangıç bulguları [PHASE_0_REPORT.md](PHASE_0_REPORT.md) içinde korunur.
