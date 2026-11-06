# Mevzuat nöbetçisi ve kaynaklı karşılaştırmalar

Nöbetçi, resmî kaynağın teknik olarak değişip değişmediğini gözlemler. Hukuki değişikliği kendiliğinden onaylamaz, sınav sürümü yayımlamaz, sorunun `Approved` alanını değiştirmez ve geçmiş deneme sonuçlarını yeniden hesaplamaz. 06.11.2026 tarihinde sınav kesimi **01.01.2027 gelecektedir**; bütün raporlar hazırlık sürümüdür ve `examVersionFinalized:false` taşır.

## Gerçek kaynak ve son kontrol

Kaynak kimlikleri `data/official-source-registry.json` dosyasındaki exact eşleşmelerden alınır: 23 mevzuat, 1 tarih konusu. O04'e kanun numarası uydurulmaz. Cumhurbaşkanlığı kararnamesi `CB_KARARNAME`, yönetmelikler `KKY`, kanunlar `KANUN` türündedir; örneğin 4483 için ilgili belge ID'si `103459` kullanılır. Aynı numaralı başka belge seçilmez. İstemcideki küçük `OFFICIAL_WATCH_IDENTITIES` listesi kayıtla regresyon testinde eşleştirilir.

06.11.2026 **14:12:22 UTC** gerçek tam taraması: **23/23 başarı**, **0 içerik/sürüm değişikliği**. Ham yanıt hash'lerinin farklı olması, değişen taşıma metadata'sı nedeniyle tek başına mevzuat değişikliği sayılmadı; decode edilmiş içerik hash'i ve teknik içerik sürümü değişmedi. Bu sonuç hukuki yürürlük veya 24 konunun kapsam incelemesinin tamamlandığı anlamına gelmez. Makine raporu `.local-reports/legal-watch.json`, değişmez raporlar `.local-reports/legal-watch-observations/` altındadır. Bunlar Git dışında yereldir; uygun açık metadata raporu ayrıca açıkça uygulamaya yayımlanabilir.

İlk tam taramada iki resmî başlıkta `MALİ/MALÎ` ve `İSKAN/İSKÂN` yazım farkı tam eşleşmeyi engelledi; o deneme **21/23, başarısız tam tarama** olarak saklandı. Kimlik karşılaştırmasında Unicode/düzeltme işareti normalizasyonu eklendikten sonra yeni tam tarama 23/23 oldu. Kaynak baytları ve hukuki metin değiştirilmedi. Eski Word `Windows-1254` deklarasyonu taşıyan bazı HTML gövdeleri aslında UTF-8 olduğundan önce strict UTF-8, sonra bildirilen kodlama denenir; hatalı harfler replacement ile gizlenmez.

## Çalıştırma

```bash
python3 scripts/check-official-sources.py
python3 scripts/check-official-sources.py --topics O02 O12 T08 --timeout 15 --workers 3
python3 -m unittest discover -s tests -p test_legal_watch.py -v
npx vitest run tests/legal-watch.test.ts
```

Python standart kütüphanesi, açık ve salt okunur UYAP `getDocumentContent` API'sine `POST` yapar; bu istek belge okur, uzak veri değiştirmez. Gizli anahtar, OAuth, Drive erişimi veya kullanıcı ilerlemesi gerekmez. Ortam proxy'si ve TLS doğrulaması korunur. Varsayılan yanıt sınırı kaynak başına 8 MiB, azami 16 MiB; timeout 20 saniye, azami 30; işçi 3, azami 4'tür. Dış sunucuya redirect reddedilir. `O04`, kayıt dışı konu, yinelenen konu veya keyfî URL kabul edilmez.

Başarı için HTTP 200, boş olmayan/sınır içi yanıt, geçerli JSON zarfı, gerçek teknik sürüm, strict base64, desteklenen MIME, okunabilir belge gövdesi, ilgili resmî başlık ve madde metni birlikte gerekir. HTML/JavaScript kabuğu ve hata zarfı başarısızdır. PDF gelirse `%PDF-` imzası ve `pdftotext` ile başarılı metin çıkarımı gerekir; araç yoksa PDF başarı gösterilmez. Her kaynak hatası raporda kalır; tek hata bile `complete:false` ve süreç çıkış kodu 1 üretir.

Doğrulanan yeni ham yanıt ve decode edilmiş belge `.local-sources/legal-watch/<rawSHA>/` içine create-only olarak yazılır. Aynı hash yoluna farklı bayt yazılmaz. Önceki sürümler korunur; `legal-watch.json` yalnız en son raporun kolay erişim kopyasıdır, değişmez gözlem günlüğünün yerine geçmez. Genel rapora kaynak metni, Drive belgesi veya özel kaynak konumu gömülmez.

## Uygulama API'si ve tarayıcı sınırı

```ts
import { createLegalWatchStore, fetchLegalWatchArtifact } from './legal-watch-store';
const watch = createLegalWatchStore();
const artifact = await fetchLegalWatchArtifact('./content/legal-watch.json');
await watch.importObservation(artifact, dependencies);
const status = await watch.getStatus();
const queue = await watch.listRevalidationQueue();
```

`fetchLegalWatchArtifact` yalnız açıkça yapılandırılan yerel JSON yolunu alır. Eski bir raporun indirilmesi yeni resmî tarama yapılmış gibi gösterilmez; kaynak raporun kendi `completedAt` zamanı gösterilir. Rapor yoksa/boşsa/bozuksa/çevrimdışıysa yeni başarı kaydı oluşturulmaz. İçe aktarılan metadata şema ve tutarlılık denetiminden geçer; bu denetim, ham kaynağı tarayıcıda yeniden indirip doğrulamak veya kriptografik imza doğrulamak anlamına gelmez. Kaynağı belli olmayan dış rapor güvenilir resmî kanıt diye sunulmamalıdır.

06.11.2026'da `Origin:http://localhost:4173` taşıyan gerçek resmî API `OPTIONS` ve `POST` çağrıları HTTP403 döndü. Aynı servise Python'ın secrets içermeyen no-Origin okuması başarılı oldu. Bu nedenle statik PWA'da doğrudan resmî servis erişimi varsayılmaz. Gerçek isteğe bağlı tarama için allowlist kullanan bir aynı-origin sunucu/proxy gerekir; böyle bir hizmet yoksa kullanıcı script raporunu içe aktarır veya güvenilir üretilmiş artifact'i alır. Uygulama kontrolü başlatamadığında bunun nedeni gösterilir ve son başarılı zaman korunur. PWA kapalıyken sürekli tarama iddiası yoktur.

`getStatus()` alanları:

| Alan | Anlam |
| --- | --- |
| `lastAttemptAt` | Başarısız/eksik olabilecek son girişim |
| `lastSuccessfulCheck` | İstenen kaynak kümesinin tamamı gerçekten doğrulanmış son rapor |
| `lastSuccessfulTopicIds` | Bu başarının kapsadığı konular; tek konu tam 23 kaynak taraması değildir |
| `lastSuccessfulFullCheck` | 23 mevzuatın tamamı doğrulanan son rapor |
| `failedSources` | Son girişimdeki açık hata sayısı |
| `changedSources` | Son girişimde içerik/hash veya teknik sürüm değişen kaynak sayısı |
| `pendingRevalidation` | Biriken yeniden inceleme olayları |
| `continuouslyRunningInBackground` | Daima `false` |

`listObservations()` değişmez raporları, `listRevalidationQueue()` etki kuyruğunu verir. `exportData()` ve `importData()` tam yedeğe eklenebilir; saf `validateLegalWatchBackup()` tüm paketi kayıt öncesi denetler. Bozuk veya aynı kimlikte farklı kayıt varsa atomik ret uygulanır. İki sekme aynı gözlemi çakışmasız ekleyebilir; mevcut gözlem üzerine yazılmaz. Nöbetçi ayrı `gys_legal_watch_v1` IndexedDB veritabanını kullanır; sınav cevaplarına veya eski localStorage kayıtlarına yazmaz.

## Etki ve hukuki tarihler

`classifySourceChange` beş karar verir: `Unchanged`, `TransportOnlyChanged`, `ContentChanged`, `FirstObservation`, `Failed`. Değişen raw yanıtın içerik hash'i ve teknik sürümü aynıysa sadece taşıma farkıdır. İlk gözlem, daha önce doğrulanmış bir kaynağın değiştiği iddiası değildir. İlk sürüm, kayıtlı hazırlık snapshot'ını karşılaştırma tabanı tutar; yeni gözlemler bu tabanı veya sınav sürümünü sessizce değiştirmez.

`buildImpact(observation, dependencies)` yalnız doğrulanmış `ContentChanged` olayında madde/kaynak bağından şunları eşleştirir:

- Mevzuat hükümleri ve öğrenme hedefleri
- Sorular, kalıcı seçenek kimlikleri ve açıklamalar
- Ezber kartları ve dört karşılaştırma tablosunun satırları

Madde farkı kesin ayrıştırılmadığında `changedArticleNumbers:null` ve `requiresWholeSourceReview:true` kullanılır; bütün ilişkili kaynak içeriği yeniden inceleme adayıdır. Hatalı kesin madde listesi üretilmez. Kuyruk kaydı `ValidationPending`, runtime etiketi `Outdated`, `publicationApplied:false` taşır. Yeni çalışmalarda etkilenen içerik bu kuyruk üzerinden kapatılabilir; önceki `Approved` dosyası, soru sürümü ve geçmiş sonuçlar korunur. Yeniden doğrulama ve ayrı açık içerik yayını olmadan eski içerik otomatik olarak güncel ilan edilmez. Ağ hatası içerik değişikliği kanıtı sayılmaz.

Orijinal yayım, değişikliği yapan düzenlemenin yayımı, yürürlük başlangıcı/bitişi ve geçiş hükümleri ayrı alanlardır. Hizmetin `version` veya son kayıt tarihi hukuki yürürlük tarihi değildir. Script bu tarihleri yorumlayarak doldurmaz; bağımsız incelenmeyen alanlar `null`, geçiş durumu `Pending` kalır. `assessCutoff` yönlendirme sağlar: kesim sonrası yayımlanan değişiklik, kesimde yürürlükte olmayan hüküm, inceleme gereken hüküm veya aday hüküm. Yürürlük/geçiş bilinmeden yalnız yayım tarihinden kesin uygulama kararı verilmez. Bu fonksiyon kesim tarihine ulaşılsa bile otomatik nihai hukuki kabul üretmez.

## Kaynaklı dört karşılaştırma tablosu

`buildComparisonTables(approvedFacts)` süre/başlangıç, yetki, başvuru/itiraz/dava ve tarihî/güncel tablolarını kurar. Her satırda hüküm kimliği, snapshot, resmî bağlantı, madde konumu, açık alıntı ve onay gerekir. Bekleyen satırlar yayımlanmaz. Tarihî metin veya yeni seçeneklerde cevap yoksa `currentValue:null` ve `currentOptionsHaveAnswer:false` desteklenir; zorla bir cevap harfi atanmaz.

`comparisonTablesFromApprovedContent(questions,snapshots,provisions)` mevcut onaylı 657 B paketiyle gerçek kaynak paragrafını aynen gösterir: m.135'ten 1 süre/başlangıç, m.129/135'ten 2 yetki, m.135'ten 2 başvuru satırı. Kaynak hash/snapshot/hüküm ve `canPublishQuestion` kapısı korunur. Korunan A denemeleri bu yardımcıya kaynak olamaz. Bunlar hazırlık metnidir; yeni hukuk özeti veya çıkarılmış hukuki görüş değildir. Tarihî/güncel tablo, iki dönemin bağımsız doğrulanmış metni olmadan boş kalır.

## GitHub Actions

`.github/workflows/legal-watch.yml` UTC05:17 günlük kontrol ve elle `workflow_dispatch` tanımlar. `contents:read` izniyle Python testlerini çalıştırır, gerçek açık resmî tarama yapar ve başarı/başarısızlık metadata'sını artifact olarak saklar. Otomatik commit, Drive işlemi, soru onayı, deploy, e-posta veya mesaj gönderimi yapmaz. Schedule çalışması GitHub'ın varsayılan dal/workflow kurallarına tabidir; yalnız PR'da bulunan YAML'ın günlük çalıştığı iddia edilmez. Artifact'in istemciye alınması ve yeni içerik yayını ayrı açık adımdır.

## Doğrulama kapsamı

Watcher testleri kaynak/decode/hash ayrımı, boş yanıt ve HTTP200 kabuğu reddi, yanlış resmî kimlik, byte sınırı, teknik sürüm farkı, bilinmeyen geçiş, kesim sonrası değişiklik, kaynak bağı etki kuyruğu, korunan havuz, değişmez kayıt, sekme çatışması, bozuk yedekte atomik ret ve çevrimdışı hatada son başarının korunmasını kapsar. Fixture metinleri gerçek soru/kanun içeriği sayılmaz. Gerçek cihaz Safari'de bu modülün kabul testi henüz yapılmadı.

06.11.2026 modül doğrulaması: **12/12 Vitest**, **10/10 Python** geçti; TypeScript ve dosya kapsamlı ESLint geçti. Gerçek 23 kaynak kontrolü test fixture'ından ayrı yukarıda raporlandı. Bu faz yeni soru üretmedi/onaylamadı; mevzuat kesimi veya çıkmış soru kullanım hakkı kararı vermedi.
