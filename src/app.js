import { TOPICS, daysUntilExam } from './core/curriculum';
import historicalCatalog from '../data/historical-catalog.json';
import contentManifest from '../data/content-manifest.json';
import { createContentRepository } from './content-repository';
import { createAttemptStore } from './attempt-store';
import { readWorkspace, saveWorkspace, validateQuestions, prepareBackup, restoreBackup } from './storage.js';

    const LEGACY_CURRICULUM = [
      // A) ORTAK KONULAR (%70 - 70 Soru)
      { code: "G01", cat: "Genel %70", topic: "1 Sayılı CBK (Bakanlık Teşkilat ve Görevleri)", shortTitle: "1 Sayılı CBK (Md. 97-126)", weight: 8, icon: "🏛️" },
      { code: "G02", cat: "Genel %70", topic: "657 Sayılı Devlet Memurları Kanunu", shortTitle: "657 Devlet Memurları K.", weight: 8, icon: "👔" },
      { code: "G03", cat: "Genel %70", topic: "2872 Sayılı Çevre Kanunu", shortTitle: "2872 Çevre Kanunu", weight: 5, icon: "🌿" },
      { code: "G04", cat: "Genel %70", topic: "5018 Sayılı Kamu Mali Yönetimi Kanunu", shortTitle: "5018 Kamu Mali Yönetimi", weight: 5, icon: "💰" },
      { code: "G05", cat: "Genel %70", topic: "2577 Sayılı İdari Yargılama Usulü Kanunu", shortTitle: "2577 İYUK", weight: 5, icon: "⚖️" },
      { code: "G06", cat: "Genel %70", topic: "2709 Sayılı T.C. Anayasası", shortTitle: "2709 T.C. Anayasası", weight: 4, icon: "🇹🇷" },
      { code: "G07", cat: "Genel %70", topic: "Atatürk İlkeleri ve İnkılap Tarihi", shortTitle: "Atatürk İlkeleri ve İnkılap", weight: 4, icon: "📜" },
      { code: "G08", cat: "Genel %70", topic: "5393 Sayılı Belediye Kanunu", shortTitle: "5393 Belediye Kanunu", weight: 4, icon: "🏙️" },
      { code: "G09", cat: "Genel %70", topic: "7552 Sayılı İklim Kanunu", shortTitle: "7552 İklim Kanunu", weight: 4, icon: "🌍" },
      { code: "G10", cat: "Genel %70", topic: "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu", shortTitle: "6331 İş Sağlığı ve Güvenliği", weight: 4, icon: "🦺" },
      { code: "G11", cat: "Genel %70", topic: "4483 Sayılı Memurların Yargılanması Kanunu", shortTitle: "4483 Memur Yargılanması", weight: 4, icon: "🔍" },
      { code: "G12", cat: "Genel %70", topic: "3194 Sayılı İmar Kanunu", shortTitle: "3194 İmar Kanunu", weight: 4, icon: "🏗️" },
      { code: "G13", cat: "Genel %70", topic: "4735 Sayılı Kamu İhale Sözleşmeleri Kanunu", shortTitle: "4735 İhale Sözleşmeleri K.", weight: 3, icon: "📝" },
      { code: "G14", cat: "Genel %70", topic: "4982 Sayılı Bilgi Edinme Hakkı Kanunu", shortTitle: "4982 Bilgi Edinme Hakkı", weight: 3, icon: "ℹ️" },
      { code: "G15", cat: "Genel %70", topic: "6698 Sayılı KVKK", shortTitle: "6698 KVKK", weight: 3, icon: "🔐" },
      { code: "G16", cat: "Genel %70", topic: "4734 Sayılı Kamu İhale Kanunu", shortTitle: "4734 Kamu İhale Kanunu", weight: 2, icon: "📑" },
      // B) ŞUBE MÜDÜRÜ TEKNİK (%30 - 30 Soru)
      { code: "T01", cat: "Teknik %30", topic: "5543 Sayılı İskân Kanunu", shortTitle: "5543 İskân Kanunu", weight: 4, icon: "🏘️" },
      { code: "T02", cat: "Teknik %30", topic: "775 Sayılı Gecekondu Kanunu", shortTitle: "775 Gecekondu Kanunu", weight: 4, icon: "🏚️" },
      { code: "T03", cat: "Teknik %30", topic: "3621 Sayılı Kıyı Kanunu", shortTitle: "3621 Kıyı Kanunu", weight: 4, icon: "🌊" },
      { code: "T04", cat: "Teknik %30", topic: "4708 Sayılı Yapı Denetimi Hakkında Kanun", shortTitle: "4708 Yapı Denetimi K.", weight: 4, icon: "🏢" },
      { code: "T05", cat: "Teknik %30", topic: "2942 Sayılı Kamulaştırma Kanunu", shortTitle: "2942 Kamulaştırma K.", weight: 4, icon: "📐" },
      { code: "T06", cat: "Teknik %30", topic: "Sıfır Atık Yönetmeliği", shortTitle: "Sıfır Atık Yönetmeliği", weight: 4, icon: "♻️" },
      { code: "T07", cat: "Teknik %30", topic: "ÇED Yönetmeliği", shortTitle: "ÇED Yönetmeliği", weight: 3, icon: "🏭" },
      { code: "T08", cat: "Teknik %30", topic: "Planlı Alanlar İmar Yönetmeliği", shortTitle: "Planlı Alanlar İmar Yön.", weight: 3, icon: "🗺️" }
    ];

    // Preserve the legacy topic names as progress keys; expose canonical syllabus IDs.
    export const DEFAULT_CURRICULUM = [0,1,5,6,15,12,2,7,3,8,13,14,9,4,10,11,16,17,18,19,22,20,23,21]
      .map((legacyIndex, i) => ({ ...LEGACY_CURRICULUM[legacyIndex], code: TOPICS[i].id, weight: TOPICS[i].examWeight }));

    // 24 Konunun tamamı için gömülü başlangıç GYS soruları
    export const SEED_QUESTIONS = [
      { id: 101, cat: "Genel %70", topic: "1 Sayılı CBK (Bakanlık Teşkilat ve Görevleri)", weight: 8, q: "1 sayılı Cumhurbaşkanlığı Kararnamesine göre aşağıdakilerden hangisi Çevre, Şehircilik ve İklim Değişikliği Bakanlığının hizmet birimlerinden biri değildir?", opts: ["Yerel Yönetimler Genel Müdürlüğü", "Milli Emlak Genel Müdürlüğü", "Mesleki Hizmetler Genel Müdürlüğü", "İller Bankası Anonim Şirketi", "Çevresel Etki Değerlendirmesi, İzin ve Denetim Genel Müdürlüğü"], ans: 3, exp: "İller Bankası A.Ş. Bakanlığın bağlı kuruluşu/ilgili kuruluşu statüsündedir; doğrudan merkez hizmet birimi değildir (CBK Md. 100)." },
      { id: 102, cat: "Genel %70", topic: "657 Sayılı Devlet Memurları Kanunu", weight: 8, q: "657 sayılı Kanuna göre aday memurluk süresi en az ve en çok ne kadardır?", opts: ["6 ay - 1 yıl", "1 yıl - 2 yıl", "1 yıl - 3 yıl", "6 ay - 2 yıl", "2 yıl - 3 yıl"], ans: 1, exp: "657 sayılı DMK Madde 54 uyarınca adaylık süresi bir yıldan az iki yıldan çok olamaz." },
      { id: 103, cat: "Genel %70", topic: "2872 Sayılı Çevre Kanunu", weight: 5, q: "2872 sayılı Çevre Kanunu'na göre çevrenin korunması ve kirliliğin önlenmesi amacıyla kullanılan temel ilkelerden 'kirleten öder' ilkesi uyarınca harcamalar kime aittir?", opts: ["Sadece Bakanlığa", "İlgili Belediyeye", "Kirletene veya bozulmaya neden olana", "Hazine ve Maliye Bakanlığına", "Valiliğe"], ans: 2, exp: "2872 sayılı Kanun Madde 3/g uyarınca kirlenme ve bozulmanın önlenmesi, sınırlandırılması ve giderilmesi harcamaları kirletene aittir." },
      { id: 104, cat: "Genel %70", topic: "5018 Sayılı Kamu Mali Yönetimi Kanunu", weight: 5, q: "5018 sayılı Kanuna göre bütçe ödeneklerinin kullanılmasında harcama talimatı verme yetkisi kime aittir?", opts: ["Muhasebe Yetkilisi", "Gerçekleştirme Görevlisi", "Üst Yönetici", "Harcama Yetkilisi", "İç Denetçi"], ans: 3, exp: "5018 sayılı Kanun Madde 31-32 uyarınca bütçeden harcama yapılabilmesi harcama yetkilisinin harcama talimatı vermesiyle mümkündür." },
      { id: 105, cat: "Genel %70", topic: "2577 Sayılı İdari Yargılama Usulü Kanunu", weight: 5, q: "2577 sayılı İYUK'a göre özel kanunlarında ayrı süre gösterilmeyen hallerde Danıştayda ve idare mahkemelerinde dava açma süresi kaç gündür?", opts: ["15 gün", "30 gün", "45 gün", "60 gün", "90 gün"], ans: 3, exp: "2577 sayılı İYUK Madde 7 uyarınca Danıştayda ve idare mahkemelerinde genel dava açma süresi 60 gündür (vergi mahkemelerinde 30 gün)." },
      { id: 106, cat: "Genel %70", topic: "2709 Sayılı T.C. Anayasası", weight: 4, q: "1982 Anayasası'na göre Cumhurbaşkanı yardımcıları ve bakanlar kime karşı sorumludur?", opts: ["TBMM'ye", "Anayasa Mahkemesine", "Cumhurbaşkanına", "Danıştaya", "Yargıtaya"], ans: 2, exp: "Anayasa Madde 106 uyarınca Cumhurbaşkanı yardımcıları ve bakanlar, Cumhurbaşkanına karşı sorumludur." },
      { id: 107, cat: "Genel %70", topic: "Atatürk İlkeleri ve İnkılap Tarihi", weight: 4, q: "Misak-ı Milli kararları aşağıdaki meclis veya kongrelerin hangisinde kabul edilmiştir?", opts: ["Erzurum Kongresi", "Sivas Kongresi", "Son Osmanlı Mebusan Meclisi", "I. TBMM", "Amasya Görüşmeleri"], ans: 2, exp: "Misak-ı Milli 28 Ocak 1920'de Son Osmanlı Mebusan Meclisi'nde kabul edilmiştir." },
      { id: 108, cat: "Genel %70", topic: "5393 Sayılı Belediye Kanunu", weight: 4, q: "5393 sayılı Belediye Kanunu'na göre bir yerleşim yerinde belediye kurulabilmesi için nüfusun en az kaç olması gerekir?", opts: ["2.000", "5.000", "10.000", "20.000", "50.000"], ans: 1, exp: "5393 sayılı Kanun Madde 4 uyarınca nüfusu 5.000 ve üzerinde olan yerleşim birimlerinde belediye kurulabilir." },
      { id: 109, cat: "Genel %70", topic: "7552 Sayılı İklim Kanunu", weight: 4, q: "7552 sayılı İklim Kanunu kapsamında sera gazı emisyonlarının azaltımı ve net sıfır emisyon hedefi doğrultusunda ulusal koordinasyonu sağlayan temel mekanizma aşağıdakilerden hangisidir?", opts: ["Emisyon Ticaret Sistemi (ETS) ve İklim Değişikliği Başkanlığı koordinasyonu", "Yalnızca Büyükşehir Belediyeleri", "İl Özel İdareleri", "Kıyı Emniyeti Genel Müdürlüğü", "Tapu ve Kadastro Genel Müdürlüğü"], ans: 0, exp: "7552 sayılı İklim Kanunu ulusal net sıfır emisyon hedefi, ETS ve İklim Değişikliği Başkanlığı koordinasyon esaslarını düzenler." },
      { id: 110, cat: "Genel %70", topic: "6331 Sayılı İş Sağlığı ve Güvenliği Kanunu", weight: 4, q: "6331 sayılı Kanuna göre çok tehlikeli sınıfta yer alan işyerlerinde acil durum planları en geç kaç yılda bir yenilenir?", opts: ["1 yıl", "2 yıl", "3 yıl", "4 yıl", "6 yıl"], ans: 1, exp: "Acil durum planları; çok tehlikeli sınıfta 2, tehlikeli sınıfta 4, az tehlikeli sınıfta 6 yılda bir yenilenir." },
      { id: 111, cat: "Genel %70", topic: "4483 Sayılı Memurların Yargılanması Kanunu", weight: 4, q: "4483 sayılı Kanuna göre yetkili merci, soruşturma izni konusundaki kararını suçun öğrenilmesinden itibaren ön inceleme dahil en geç kaç gün içinde verir (zorunlu ek süre hariç)?", opts: ["15 gün", "30 gün", "45 gün", "60 gün", "90 gün"], ans: 1, exp: "4483 sayılı Kanun Madde 7 uyarınca yetkili merci 30 gün içinde karar verir; zorunlu hallerde 15 günü geçmemek üzere bir defa uzatılabilir." },
      { id: 112, cat: "Genel %70", topic: "3194 Sayılı İmar Kanunu", weight: 4, q: "3194 sayılı İmar Kanunu'na göre Düzenleme Ortaklık Payı (DOP) oranı, düzenlemeye tabi tutulan yerlerin düzenlemeden önceki yüzölçümünün en fazla yüzde kaçı kadar olabilir?", opts: ["%35", "%40", "%45", "%50", "%25"], ans: 2, exp: "3194 sayılı İmar Kanunu Madde 18 uyarınca DOP oranı %45'i geçemez." },
      { id: 113, cat: "Genel %70", topic: "4735 Sayılı Kamu İhale Sözleşmeleri Kanunu", weight: 3, q: "4735 sayılı Kanuna göre yapım işlerinde birim fiyat sözleşmelerde, sözleşme bedelinin yüzde kaçına kadar oran dahilinde süre uzatımı ve iş artışı yapılabilir?", opts: ["%10", "%20", "%30", "%40", "%50"], ans: 1, exp: "4735 sayılı Kanun Madde 24 uyarınca yapım işlerinde birim fiyat sözleşmelerde %20'ye (Cumhurbaşkanı kararıyla %40'a) kadar iş artışı yapılabilir." },
      { id: 114, cat: "Genel %70", topic: "4982 Sayılı Bilgi Edinme Hakkı Kanunu", weight: 3, q: "4982 sayılı Kanuna göre kurum ve kuruluşlar bilgi edinme başvurularını kural olarak kaç iş günü içinde cevaplandırır?", opts: ["7 iş günü", "10 iş günü", "15 iş günü", "30 iş günü", "60 iş günü"], ans: 2, exp: "4982 sayılı Kanun Madde 11 uyarınca başvurular 15 iş günü içinde (başka kurumdan görüş alınacaksa 30 iş günü) cevaplandırılır." },
      { id: 115, cat: "Genel %70", topic: "6698 Sayılı KVKK", weight: 3, q: "6698 sayılı KVKK'ya göre veri sorumlusu, kendisine yöneltilen başvuruları en geç kaç gün içinde ücretsiz olarak sonuçlandırır?", opts: ["10 gün", "15 gün", "30 gün", "45 gün", "60 gün"], ans: 2, exp: "6698 sayılı KVKK Madde 13 uyarınca veri sorumlusu talepleri en geç 30 gün içinde sonuçlandırır." },
      { id: 116, cat: "Genel %70", topic: "4734 Sayılı Kamu İhale Kanunu", weight: 2, q: "4734 sayılı Kamu İhale Kanunu'na göre aşağıdakilerden hangisi temel ihale usullerinden biridir?", opts: ["Çerçeve Anlaşma", "Dinamik Alım Sistemi", "Belli İstekliler Arasında İhale Usulü", "Elektronik Eksiltme", "Doğrudan Temin"], ans: 2, exp: "4734 sayılı Kanun Madde 18'e göre temel ihale usulleri: Açık ihale, Belli istekliler arasında ihale ve Pazarlık usulüdür." },
      { id: 201, cat: "Teknik %30", topic: "5543 Sayılı İskân Kanunu", weight: 4, q: "5543 sayılı İskân Kanunu'na göre iskân edilen ailelere verilen taşınmaz mallar, tahsis tarihinden itibaren kaç yıl süreyle hiçbir suretle satılamaz, bağışlanamaz ve haczedilemez?", opts: ["3 yıl", "5 yıl", "10 yıl", "15 yıl", "20 yıl"], ans: 2, exp: "5543 sayılı İskân Kanunu Madde 21 uyarınca verilen taşınmazlar 10 yıl süreyle satılamaz, bağışlanamaz ve haczedilemez." },
      { id: 202, cat: "Teknik %30", topic: "775 Sayılı Gecekondu Kanunu", weight: 4, q: "775 sayılı Gecekondu Kanunu uyarınca tahsis edilen arsalar üzerine hak sahiplerince ne kadar süre içinde bina yapımına başlanması zorunludur?", opts: ["6 ay", "1 yıl", "2 yıl", "3 yıl", "5 yıl"], ans: 1, exp: "775 sayılı Kanun Madde 27 uyarınca tahsis tarihinden itibaren 1 yıl içinde bina yapımına başlanması şarttır." },
      { id: 203, cat: "Teknik %30", topic: "3621 Sayılı Kıyı Kanunu", weight: 4, q: "3621 sayılı Kıyı Kanunu'na göre uygulama imar planı yapılacak yerlerde sahil şeridinin derinliği kıyı kenar çizgisinden itibaren en az kaç metredir?", opts: ["20 metre", "50 metre", "100 metre", "150 metre", "200 metre"], ans: 2, exp: "3621 sayılı Kıyı Kanunu Madde 4 uyarınca sahil şeridi kıyı kenar çizgisinden itibaren yatay olarak en az 100 metre genişliğindeki alandır." },
      { id: 204, cat: "Teknik %30", topic: "4708 Sayılı Yapı Denetimi Hakkında Kanun", weight: 4, q: "4708 sayılı Kanuna göre yapı denetim kuruluşlarının yapıların taşıyıcı sisteminden dolayı sorumluluk süresi, yapı kullanma izninin alındığı tarihten itibaren kaç yıldır?", opts: ["2 yıl", "5 yıl", "10 yıl", "15 yıl", "20 yıl"], ans: 3, exp: "4708 sayılı Kanun Madde 3 uyarınca taşıyıcı sistemden dolayı 15 yıl, taşıyıcı olmayan diğer kısımlardan dolayı 2 yıl sorumluluk vardır." },
      { id: 205, cat: "Teknik %30", topic: "2942 Sayılı Kamulaştırma Kanunu", weight: 4, q: "2942 sayılı Kamulaştırma Kanunu'na göre kamulaştırma işlemlerinin tamamlanmasından itibaren idarece kaç yıl içinde kamulaştırma amacına uygun hiçbir işlem yapılmazsa eski malik geri alma hakkını kullanabilir?", opts: ["1 yıl", "3 yıl", "5 yıl", "10 yıl", "15 yıl"], ans: 2, exp: "2942 sayılı Kanun Madde 23 uyarınca kamulaştırma bedelinin kesinleşmesinden itibaren 5 yıl içinde amaca uygun işlem yapılmazsa geri alma hakkı doğar." },
      { id: 206, cat: "Teknik %30", topic: "Sıfır Atık Yönetmeliği", weight: 4, q: "Sıfır Atık Yönetmeliği'ne göre kağıt-karton atıkların biriktirildiği ekipmanlarda kullanılan standart renk aşağıdakilerden hangisidir?", opts: ["Mavi", "Sarı", "Yeşil", "Gri", "Kahverengi"], ans: 0, exp: "Sıfır Atık Yönetmeliği uyarınca Kağıt/Karton için Mavi, Plastik için Sarı, Cam için Yeşil, Metal için Gri, Organik atıklar için Kahverengi kullanılır." },
      { id: 207, cat: "Teknik %30", topic: "ÇED Yönetmeliği", weight: 3, q: "ÇED Yönetmeliği'ne göre 'ÇED Olumlu' kararı verilen bir projede kaç yıl içinde mücbir sebep olmaksızın yatırıma başlanmazsa karar geçersiz sayılır?", opts: ["2 yıl", "3 yıl", "5 yıl", "7 yıl", "10 yıl"], ans: 3, exp: "ÇED Yönetmeliği uyarınca 'ÇED Olumlu' kararı verilen projelerde 7 yıl içinde yatırıma başlanmaması halinde karar geçersiz sayılır." },
      { id: 208, cat: "Teknik %30", topic: "Planlı Alanlar İmar Yönetmeliği", weight: 3, q: "Planlı Alanlar İmar Yönetmeliği'ne göre yapı ruhsatı alınan binalarda ruhsat tarihinden itibaren kaç yıl içinde inşaata başlanması ve kaç yıl içinde bitirilmesi zorunludur?", opts: ["1 yıl başlama - 3 yıl bitirme", "2 yıl başlama - 5 yıl bitirme", "2 yıl başlama - 10 yıl bitirme", "3 yıl başlama - 5 yıl bitirme", "1 yıl başlama - 5 yıl bitirme"], ans: 1, exp: "Ruhsat tarihinden itibaren 2 yıl içinde inşaata başlanması ve 5 yıl içinde inşaatın tamamlanması zorunludur." }
    ];

    export function gysApp(dependencies = {}) {
      const repository = dependencies.repository || createContentRepository(contentManifest);
      // Keep database connections outside Alpine's reactive proxies.
      const attemptStore = dependencies.attemptStore || (typeof indexedDB === 'undefined' ? null : createAttemptStore());
      let baselineState = null;
      const clone = value => JSON.parse(JSON.stringify(value));
      return {
        activeTab: 'home',
        historicalCatalog,
        notice: '',
        storageBlocked: false,
        loadingContent: false,
        savingAnswer: false,
        activeAttempt: null,
        completedAttempts: [],
        journalProgress: null,
        filterCat: 'ALL',
        curriculum: JSON.parse(JSON.stringify(DEFAULT_CURRICULUM)),
        questions: [],
        state: {
          xp: 0,
          dailyXP: 0,
          streak: 0,
          lastActiveDate: null,
          hearts: 5,
          totalAnswered: 0,
          totalCorrect: 0,
          topicStats: {}, // { topic: { answered: 0, correct: 0 } }
          mistakes: {},   // { qId: { wrongCount: 1, streak: 0, lastWrong: timestamp } }
          customWeights: {},
          settings: {
            quizSize: 10,
            dailyGoal: 100,
            mixMistakes: true,
            examMode: false,
            sound: true
          }
        },
        quiz: {
          active: false,
          summary: false,
          title: '',
          items: [],
          index: 0,
          selected: null,
          checked: false,
          isCorrect: false,
          correctCount: 0
        },

        async initApp() {
          // Original v1 keys are read-only. All future writes use one versioned envelope.
          const loaded = readWorkspace(localStorage, this.state);
          this.state = loaded.state;
          baselineState = clone(loaded.state);
          this.storageBlocked = Boolean(loaded.error);
          this.notice = loaded.error || '';
          this.questions = loaded.questions || [...SEED_QUESTIONS];

          // Opening the app is not evidence of studying. Only an answer marks an active day.
          const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
          if (this.state.lastActiveDate !== today) this.state.dailyXP = 0;

          // Aynı klasörde questions.json varsa otomatik birleştir
          try {
            const res = await fetch('./questions.json');
            if (res.ok) {
              const extData = await res.json();
              if (Array.isArray(extData) && extData.length > 0) {
                this.mergeQuestions(extData, false);
              }
            }
          } catch {}
          if (attemptStore) {
            try {
              await this.refreshJournalProgress();
              this.completedAttempts = await attemptStore.listCompleted();
              const active = await attemptStore.getActive();
              if (active) { this.activeAttempt = active; this.notice = 'Yarım kalan çalışma kaydedildi. Devam düğmesiyle sürdürebilirsiniz.'; }
            } catch (error) { this.notice = 'Çalışma kayıtları açılamadı: ' + error.message; }
          }
        },

        saveState() {
          if (this.storageBlocked) {
            this.notice = 'Yerel kayıt okunamadı. Veriler korunuyor; geri yükleme öncesi yedek alın.';
            return;
          }
          try { saveWorkspace(localStorage, baselineState ? { ...baselineState, settings: clone(this.state.settings),hearts:this.state.hearts } : this.state, this.questions); }
          catch { this.notice = 'Kayıt yapılamadı. Depolama alanını kontrol edin ve yedek alın.'; }
        },

        mergeQuestions(newItems, persist = true) {
          const normalized = validateQuestions(newItems);
          const map = new Map(this.questions.map(q => [String(q.id), q]));
          // Existing versions are retained. Conflicting imports need a later review workflow.
          for (const q of normalized) {
            const old = map.get(String(q.id));
            if (old && JSON.stringify({ ...old, verificationStatus: 'ValidationPending' }) !== JSON.stringify(q)) {
              throw new Error('Aynı kimlikte farklı soru var; mevcut sürüm korundu.');
            }
            map.set(String(q.id), q);
          }
          const next = Array.from(map.values());
          if (persist) {
            if (this.storageBlocked) throw new Error('Yerel kayıt korunuyor; yeni içerik yazılamaz.');
            // Commit persistent bytes first; failed writes must not change the visible bank.
            saveWorkspace(localStorage, baselineState ? {...baselineState,settings:clone(this.state.settings),hearts:this.state.hearts} : this.state, next);
          }
          this.questions = next;
        },

        studyQuestions() {
          return repository.loadedChunks().flatMap(chunk => chunk.questions.map(q => {
            const topic = DEFAULT_CURRICULUM.find(t => t.code === q.topicId);
            const source = chunk.snapshots.find(s => s.id === q.sourceSnapshotId);
            return { id: q.id, version: q.version, topicId: q.topicId,
              q: q.text, opts: q.options.map(o => o.text), optionIds: q.options.map(o => o.id),
              correctOptionId: q.correctOptionId,
              ans: q.options.findIndex(o => o.id === q.correctOptionId), exp: q.explanation,
              topic: topic.topic, cat: topic.cat, weight: topic.weight,
              distractorExplanations: q.distractorExplanations || {},
              sourceUrl: source.sourceUrl, sourceLocator: q.sourceLocator,sourceSnapshotId:q.sourceSnapshotId,sourceContentHash:source.contentHash,legalEdition:source.legalEdition };
          }));
        },
        approvedQuestionCount() { return repository.totalCount(); },
        questionCompletionLabel() {
          const published=new Set(contentManifest.topics.flatMap(t=>t.questionIds||[]));
          if(!published.size)return 'Henüz onaylı paket yok';
          const solved=(this.journalProgress?.solvedQuestionIds||[]).filter(id=>published.has(id)).length;
          return solved+'/'+published.size+' benzersiz soru';
        },
        daysUntilExam() { return daysUntilExam(); },
        topicAccuracyLabel(topic) {
          const value = this.getTopicMastery(topic);
          return value === null ? 'Ölçülmedi' : '%' + value;
        },
        overallAccuracyLabel() {
          return this.state.totalAnswered ? '%' + this.overallAccuracy() : 'Ölçülmedi';
        },

        filteredTopics() {
          const list = this.filterCat === 'ALL'
            ? this.curriculum
            : this.curriculum.filter(c => c.cat === this.filterCat);
          return [...list].sort((a, b) => b.weight - a.weight);
        },

        getQuestionCount(topicName) {
          const topic = DEFAULT_CURRICULUM.find(t => t.topic === topicName);
          return topic ? repository.countFor(topic.code) : 0;
        },

        getTopicMastery(topicName) {
          const st = this.state.topicStats[topicName];
          if (!st || !st.answered) return null;
          return Math.round((st.correct / st.answered) * 100);
        },

        overallAccuracy() {
          if (!this.state.totalAnswered) return 0;
          return Math.round((this.state.totalCorrect / this.state.totalAnswered) * 100);
        },

        estimatedGysScore() {
          // Legacy aggregates cannot distinguish first encounters, objectives or repeat effects.
          return 'Veri yetersiz';
        },

        weakestTopics() {
          return this.curriculum
            .map(c => ({
              ...c,
              acc: this.getTopicMastery(c.topic),
              ans: this.state.topicStats[c.topic]?.answered || 0
            }))
            .filter(c => c.ans > 0)
            .sort((a, b) => (a.acc - b.acc) || (b.weight - a.weight))
            .slice(0, 3);
        },

        mistakeList() {
          const list = [];
          for (const [idStr, meta] of Object.entries(this.state.mistakes)) {
            const qObj = meta.question ? this.fromSavedQuestion(meta.question) : this.studyQuestions().find(q => String(q.id) === String(idStr));
            if (qObj) list.push({ qObj, ...meta });
          }
          return list.sort((a, b) => (b.qObj.weight - a.qObj.weight) || (b.wrongCount - a.wrongCount));
        },

        isMistakeQuestion(qId) {
          return Boolean(qId && this.state.mistakes[qId]);
        },

        // Konu Bazlı Ders Başlat (%30 Hata Serpiştirmeli)
        async startTopicQuiz(topicItem) {
          if (this.loadingContent) return;
          if (this.activeAttempt) { this.notice = 'Önce yarım kalan çalışmayı sürdürün veya sonucunu kaydederek bitirin.'; return; }
          this.loadingContent = true;
          try { await repository.loadTopic(topicItem.code); }
          catch (error) { this.notice = error.message; return; }
          finally { this.loadingContent = false; }
          if (this.state.settings.examMode && this.state.hearts <= 0) {
            this.state.hearts = 5;
          }
          const size = this.state.settings.quizSize || 10;
          const pool = this.studyQuestions().filter(q => q.topic === topicItem.topic);
          if (!pool.length) { this.notice = 'Bu konuda onaylı soru henüz yok. Kaynak doğrulaması bekleniyor.'; return; }

          const selected = [];
          if (this.state.settings.mixMistakes) {
            const topicMistakes = this.mistakeList()
              .map(m => pool.find(q => q.id === m.qObj.id && q.version === m.qObj.version))
              .filter(Boolean);
            const mistakeQuota = Math.min(topicMistakes.length, Math.max(1, Math.floor(size * 0.3)));
            selected.push(...this.shuffle(topicMistakes).slice(0, mistakeQuota));
          }

          const remaining = pool.filter(q => !selected.some(s => s.id === q.id));
          selected.push(...this.shuffle(remaining).slice(0, size - selected.length));

          await this.launchQuiz(topicItem.shortTitle, this.shuffle(selected).map(q => this.shuffleOptions(q)));
        },

        shuffleOptions(question) {
          if (!question.optionIds) return question;
          const options=this.shuffle(question.opts.map((text,i)=>({text,id:question.optionIds[i]})));
          return {...question,opts:options.map(o=>o.text),optionIds:options.map(o=>o.id),ans:options.findIndex(o=>o.id===question.correctOptionId)};
        },
        fromSavedQuestion(q) {
          const topic=DEFAULT_CURRICULUM.find(t=>t.code===q.topicId);
          return {id:q.id,version:q.version,topicId:q.topicId,topic:q.topic,cat:topic?.cat,weight:q.weight,
            q:q.text,opts:q.options.map(o=>o.text),optionIds:q.options.map(o=>o.id),correctOptionId:q.correctOptionId,
            ans:q.options.findIndex(o=>o.id===q.correctOptionId),exp:q.explanation,sourceUrl:q.sourceUrl,sourceLocator:q.sourceLocator,
            sourceSnapshotId:q.sourceSnapshotId,sourceContentHash:q.sourceContentHash,legalEdition:q.legalEdition};
        },

        // Sadece Hataları Eritme Testi
        async startMistakeQuiz() {
          if (this.activeAttempt) { this.notice = 'Önce yarım kalan çalışmayı tamamlayın.'; return; }
          try {
            const topics=new Set(this.mistakeList().map(m=>m.qObj.topicId).filter(Boolean));
            await Promise.all([...topics].map(id=>repository.loadTopic(id)));
            const approved=this.studyQuestions();
            const mItems=this.mistakeList().map(m=>approved.find(q=>q.id===m.qObj.id&&q.version===m.qObj.version)).filter(Boolean).slice(0,15);
            if(!mItems.length){this.notice='Bu geçmiş sorular için güncel onaylı paket eşleşmesi bulunamadı.';return;}
            await this.launchQuiz('Yanlışları tekrar',this.shuffle(mItems).map(q=>this.shuffleOptions(q)));
          } catch(error){this.notice=error.message;}
        },

        // GYS Ağırlıklı Genel Simülasyon
        startWeightedExam() {
          this.notice = 'Tam deneme henüz hazır değil. Her konuda yeterli onaylı soru ve Strict Mode testleri tamamlandığında açılacak.';
        },

        async launchQuiz(title, items) {
          if (!items || items.length === 0) return;
          if (attemptStore) {
            try {
              this.activeAttempt = await attemptStore.start({title, mode:'study', questions:items.map(q => ({
                id:String(q.id),version:q.version,topicId:q.topicId,topic:q.topic,weight:q.weight,text:q.q,
                options:q.opts.map((text,i) => ({id:q.optionIds[i],text})),correctOptionId:q.correctOptionId,
                explanation:q.exp,sourceUrl:q.sourceUrl,sourceLocator:q.sourceLocator,
                sourceSnapshotId:q.sourceSnapshotId,sourceContentHash:q.sourceContentHash,legalEdition:q.legalEdition
              }))});
            } catch (error) { this.notice = error.message; return; }
          } else if (typeof window !== 'undefined') { this.notice = 'IndexedDB kullanılamıyor; güvenilir kayıt için çalışma başlatılmadı.'; return; }
          this.notice = '';
          this.quiz = {
            active: true,
            summary: false,
            title,
            items,
            index: 0,
            selected: null,
            checked: false,
            isCorrect: false,
            correctCount: 0
          };
        },

        currentQ() {
          return this.quiz.items[this.quiz.index] || null;
        },

        selectOption(idx) {
          if (this.quiz.checked || this.savingAnswer) return;
          this.quiz.selected = idx;
          if (navigator.vibrate) navigator.vibrate(10);
        },

        getOptionClass(idx) {
          if (!this.quiz.checked) {
            return this.quiz.selected === idx ? 'btn-3d-selected' : 'btn-3d-card text-gray-100';
          }
          const ans = this.currentQ()?.ans;
          if (idx === ans) return 'btn-3d-correct';
          if (idx === this.quiz.selected && idx !== ans) return 'btn-3d-wrong';
          return 'btn-3d-card opacity-50';
        },

        recordActiveDay() {
          const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' });
          const today = formatter.format(new Date());
          if (this.state.lastActiveDate === today) return;
          const yesterday = formatter.format(new Date(Date.now() - 86400000));
          this.state.streak = this.state.lastActiveDate === yesterday ? this.state.streak + 1 : 1;
          this.state.dailyXP = 0;
          this.state.lastActiveDate = today;
        },

        async checkAnswer() {
          if (this.quiz.selected === null || this.quiz.checked || this.savingAnswer) return;
          const q = this.currentQ();
          const correct = this.quiz.selected === q.ans;
          if (attemptStore && this.activeAttempt) {
            this.savingAnswer = true;
            try {
              this.activeAttempt = await attemptStore.saveAnswer(this.activeAttempt.id, {
                questionId:String(q.id),selectedOptionId:q.optionIds[this.quiz.selected],expectedRevision:this.activeAttempt.revision
              });
              this.quiz.checked = true; this.quiz.isCorrect = correct;
              this.quiz.correctCount = this.activeAttempt.answers.filter(a => a.correct).length;
              await this.refreshJournalProgress(); this.playTone(correct);
              if(!correct&&this.state.settings.examMode){this.state.hearts=Math.max(0,this.state.hearts-1);this.saveState();}
            } catch (error) { this.notice = error.message; }
            finally { this.savingAnswer = false; }
            return;
          }
          this.quiz.checked = true;
          this.quiz.isCorrect = correct;

          this.recordActiveDay();
          // İstatistik güncelle
          this.state.totalAnswered += 1;
          if (!this.state.topicStats[q.topic]) {
            this.state.topicStats[q.topic] = { answered: 0, correct: 0 };
          }
          this.state.topicStats[q.topic].answered += 1;

          if (correct) {
            this.quiz.correctCount += 1;
            this.state.totalCorrect += 1;
            this.state.topicStats[q.topic].correct += 1;
            this.state.xp += 10;
            this.state.dailyXP += 10;
            this.playTone(true);

            // Hata havuzundaysa seri artır, 2 olunca sil
            if (this.state.mistakes[q.id]) {
              this.state.mistakes[q.id].streak += 1;
              if (this.state.mistakes[q.id].streak >= 2) {
                delete this.state.mistakes[q.id];
              }
            }
          } else {
            this.playTone(false);
            if (navigator.vibrate) navigator.vibrate([60, 40, 80]);
            if (this.state.settings.examMode && this.state.hearts > 0) {
              this.state.hearts -= 1;
            }
            // Hata havuzuna ekle veya sıfırla
            const prev = this.state.mistakes[q.id] || { wrongCount: 0, streak: 0 };
            this.state.mistakes[q.id] = {
              wrongCount: prev.wrongCount + 1,
              streak: 0,
              lastWrong: Date.now()
            };
          }
          this.saveState();
        },

        async nextQuestion() {
          if (this.savingAnswer || !this.quiz.checked) return;
          if (attemptStore && this.activeAttempt) {
            try {
              if(this.state.settings.examMode&&this.state.hearts<=0){
                await this.finishStudy();this.state.hearts=5;this.saveState();return;
              }
              if (this.quiz.index + 1 < this.quiz.items.length) {
                this.savingAnswer=true;
                try {
                  this.activeAttempt = await attemptStore.setCursor(this.activeAttempt.id,this.quiz.index+1,this.activeAttempt.revision);
                  this.applyAttempt(this.activeAttempt);
                } finally { this.savingAnswer=false; }
              } else { await this.finishStudy(); }
            } catch (error) { this.notice = error.message; }
            return;
          }
          if (this.state.settings.examMode && this.state.hearts <= 0) {
            alert('Sınav modunda canların tükendi! Tur sonlandırılıyor.');
            this.state.hearts = 5;
            this.quiz.active = false;
            this.quiz.summary = true;
            this.saveState();
            return;
          }
          if (this.quiz.index + 1 < this.quiz.items.length) {
            this.quiz.index += 1;
            this.quiz.selected = null;
            this.quiz.checked = false;
            this.quiz.isCorrect = false;
          } else {
            this.quiz.active = false;
            this.quiz.summary = true;
          }
        },

        applyAttempt(attempt) {
          this.activeAttempt = attempt;
          const items = attempt.questions.map(q => ({id:q.id,version:q.version,topicId:q.topicId,
            q:q.text,opts:q.options.map(o=>o.text),optionIds:q.options.map(o=>o.id),correctOptionId:q.correctOptionId,
            ans:q.options.findIndex(o=>o.id===q.correctOptionId),exp:q.explanation,topic:q.topic,weight:q.weight,
            sourceUrl:q.sourceUrl,sourceLocator:q.sourceLocator,sourceSnapshotId:q.sourceSnapshotId,sourceContentHash:q.sourceContentHash,legalEdition:q.legalEdition}));
          const current=items[attempt.cursor];
          const answer=attempt.answers.find(a=>a.questionId===current.id);
          this.quiz={active:attempt.status==='active',summary:attempt.status==='completed',title:attempt.title,
            items,index:attempt.cursor,selected:answer?current.optionIds.indexOf(answer.selectedOptionId):null,
            checked:Boolean(answer),isCorrect:answer?.correct||false,correctCount:attempt.answers.filter(a=>a.correct).length,
            result:attempt.result,attemptNumber:attempt.attemptNumber,isFirstAttempt:attempt.isFirstAttempt};
        },
        async trustedAttempt(attempt) {
          await Promise.all([...new Set(attempt.questions.map(q=>q.topicId))].map(id=>repository.loadTopic(id)));
          const approved=this.studyQuestions();
          return attempt.questions.every(saved=>{
            const current=approved.find(q=>q.id===saved.id&&q.version===saved.version);
            if(!current||current.q!==saved.text||current.exp!==saved.explanation||current.correctOptionId!==saved.correctOptionId
              ||current.topicId!==saved.topicId||current.topic!==saved.topic||current.weight!==saved.weight
              ||current.sourceSnapshotId!==saved.sourceSnapshotId||current.sourceContentHash!==saved.sourceContentHash
              ||current.sourceUrl!==saved.sourceUrl||current.sourceLocator!==saved.sourceLocator)return false;
            return saved.options.length===current.opts.length&&saved.options.every(option=>{
              const index=current.optionIds.indexOf(option.id);return index>=0&&current.opts[index]===option.text;
            });
          });
        },
        async resumeStudy() {
          if (!attemptStore || !this.activeAttempt) return;
          try {
            const saved=await attemptStore.load(this.activeAttempt.id);
            if(saved){
              if(!await this.trustedAttempt(saved)){this.notice='Kayıtlı sorular güncel onaylı paketle eşleşmiyor. Geçmiş kayıt korunur; çalışma sürdürülmedi.';return;}
              if(this.state.settings.examMode)this.state.hearts=Math.max(0,5-saved.answers.filter(a=>!a.correct).length);
              this.applyAttempt(saved);
            }
          }
          catch(error) { this.notice=error.message; }
        },
        async finishStudy() {
          if (!attemptStore || !this.activeAttempt || this.savingAnswer) return;
          this.savingAnswer=true;
          try {
            const saved=await attemptStore.finish(this.activeAttempt.id,this.activeAttempt.revision);
            this.applyAttempt(saved);this.activeAttempt=null;
            this.completedAttempts=await attemptStore.listCompleted();await this.refreshJournalProgress();
          } catch(error) { this.notice=error.message; }
          finally { this.savingAnswer=false; }
        },
        async refreshJournalProgress() {
          if (!attemptStore?.getProgress || !baselineState) return;
          const progress=await attemptStore.getProgress(); this.journalProgress=progress;
          this.state.totalAnswered=baselineState.totalAnswered+progress.totalAnswered;
          this.state.totalCorrect=baselineState.totalCorrect+progress.totalCorrect;
          this.state.xp=baselineState.xp+progress.xp;
          this.state.streak=progress.lastActiveDate?progress.streak:baselineState.streak;
          this.state.lastActiveDate=progress.lastActiveDate||baselineState.lastActiveDate;
          const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date());
          this.state.dailyXP=(baselineState.lastActiveDate===today?baselineState.dailyXP:0)+progress.dailyXP;
          this.state.topicStats=clone(baselineState.topicStats);
          for(const [topic,stats] of Object.entries(progress.topicStats)) {
            if(!DEFAULT_CURRICULUM.some(t=>t.topic===topic))continue;
            const old=Object.hasOwn(this.state.topicStats,topic)?this.state.topicStats[topic]:{answered:0,correct:0};
            this.state.topicStats[topic]={answered:old.answered+stats.answered,correct:old.correct+stats.correct};
          }
          this.state.mistakes={...clone(baselineState.mistakes),...progress.mistakes};
        },
        async viewAttempt(id) {
          if(!attemptStore)return;
          try{const live=this.activeAttempt;const saved=await attemptStore.load(id);if(saved){this.applyAttempt(saved);this.activeAttempt=live;}}
          catch(error){this.notice=error.message;}
        },

        closeQuiz() {
          this.quiz.active = false;
        },

        // Web Audio API ile sıfır harici dosyayla Duolingo ses efekti
        playTone(isSuccess) {
          if (!this.state.settings.sound) return;
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            if (isSuccess) {
              osc.frequency.setValueAtTime(587.33, ctx.currentTime);
              osc.frequency.setValueAtTime(880, ctx.currentTime + 0.09);
            } else {
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(220, ctx.currentTime);
              osc.frequency.setValueAtTime(165, ctx.currentTime + 0.12);
            }
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
          } catch {}
        },

        shuffle(arr) {
          const a = [...arr];
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          return a;
        },

        // Yönetim Paneli İşlevleri
        importQuestionsJson(event) {
          const file = event.target.files[0];
          if (!file) return;
          if (file.size > 32 * 1024 * 1024) { this.notice = 'Dosya 32 MB sınırını aşıyor; mevcut veriler korundu.'; return; }
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const parsed = JSON.parse(e.target.result);
              if (!Array.isArray(parsed)) throw new Error('Soru dizisi gerekli');
              if (Array.isArray(parsed)) {
                this.mergeQuestions(parsed);
                this.notice = parsed.length + ' soru inceleme kuyruğuna alındı; onaylı içerik olarak yayımlanmadı.';
              }
            } catch {
              this.notice = 'Geçersiz veya çakışan soru dosyası. Mevcut kayıtlar korundu.';
            }
          };
          reader.readAsText(file);
        },

        exportBackup() {
          const payload = {
            schemaVersion: 1,
            state: baselineState ? {...baselineState,settings:clone(this.state.settings),hearts:this.state.hearts} : this.state,
            questions: this.questions
          };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'gys_duo_yedek.json';
          a.click();
          URL.revokeObjectURL(url);
        },

        async exportStudyBackup() {
          if(!attemptStore){this.notice='Çalışma veritabanı kullanılamıyor.';return;}
          try{
            const data=await attemptStore.exportJournal();
            const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
            const a=document.createElement('a');a.href=url;a.download='gys-calisma-gunlugu.json';a.click();URL.revokeObjectURL(url);
          }catch(error){this.notice=error.message;}
        },
        async importStudyBackup(event) {
          const file=event.target.files[0];if(!file||!attemptStore)return;
          if(file.size>32*1024*1024){this.notice='Dosya32 MB sınırını aşıyor.';return;}
          try{
            const result=await attemptStore.importJournal(JSON.parse(await file.text()));
            await this.refreshJournalProgress();this.completedAttempts=await attemptStore.listCompleted();this.activeAttempt=await attemptStore.getActive();
            this.notice=result.imported+' yeni çalışma kaydı birleştirildi. Mevcut kayıtlar silinmedi.';
          }catch(error){this.notice='Çalışma yedeği yüklenemedi: '+error.message;}
        },

        importBackup(event) {
          const file = event.target.files[0];
          if (!file) return;
          if (file.size > 32 * 1024 * 1024) { this.notice = 'Dosya 32 MB sınırını aşıyor; mevcut veriler korundu.'; return; }
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = prepareBackup(JSON.parse(e.target.result), { schemaVersion: 1, state: this.state, questions: this.questions });
              if (!confirm(`Doğrulanan yedek: ${data.state.totalAnswered} cevap ve ${data.questions.length} soru kaydı. Cihazdaki ${this.state.totalAnswered} cevaplık ilerlemenin yerini alacak. Devam edilsin mi? Önceki kayıt korunur.`)) return;
              const restored = restoreBackup(localStorage, data, { schemaVersion: 1, state: this.state, questions: this.questions });
              baselineState=clone(restored.state);
              this.state = restored.state;
              this.questions = restored.questions;
              this.storageBlocked = false;
              this.notice = 'Eski kayıt ve ayarlar geri yüklendi. Yeni çalışma günlüğü ayrı korunur.';
              this.refreshJournalProgress().catch(error=>{this.notice=error.message;});
            } catch {
              this.notice = 'Yedek geçersiz, çakışıyor veya yazılamadı. Mevcut kayıtlar korundu.';
            }
          };
          reader.readAsText(file);
        },

        saveCustomWeights() { this.notice = 'Resmî 70/30 dağılımı sabittir.'; },
        resetWeights() { this.curriculum = DEFAULT_CURRICULUM.map(t => ({ ...t })); },
        resetAllProgress() { this.notice = 'İlerleme silme bu sürümde kapalıdır.'; }
      };
    }
