export type TopicId = `O${string}` | `T${string}`;
export type TopicGroup = 'common' | 'technical';
export interface Topic {
  id: TopicId;
  title: string;
  group: TopicGroup;
  examWeight: number;
  mockQuestionQuota: number;
  bankQuestionQuota: 100;
  /** A document title alone does not establish which articles are in scope. */
  scope: { status: 'bounded' | 'mapping-pending'; articles?: readonly [number, number]; description: string };
}

const definitions: readonly [TopicId, string, number][] = [
  ['O01', '1 sayılı Cumhurbaşkanlığı Kararnamesi — ÇŞİDB teşkilat ve görevleri', 8],
  ['O02', '657 sayılı Devlet Memurları Kanunu', 8],
  ['O03', '2709 sayılı Türkiye Cumhuriyeti Anayasası', 4],
  ['O04', 'Atatürk İlkeleri ve İnkılap Tarihi', 4],
  ['O05', '4734 sayılı Kamu İhale Kanunu', 2],
  ['O06', '4735 sayılı Kamu İhale Sözleşmeleri Kanunu', 3],
  ['O07', '2872 sayılı Çevre Kanunu', 5],
  ['O08', '5393 sayılı Belediye Kanunu', 4],
  ['O09', '5018 sayılı Kamu Mali Yönetimi ve Kontrol Kanunu', 5],
  ['O10', '7552 sayılı İklim Kanunu', 4],
  ['O11', '4982 sayılı Bilgi Edinme Hakkı Kanunu', 3],
  ['O12', '6698 sayılı Kişisel Verilerin Korunması Kanunu', 3],
  ['O13', '6331 sayılı İş Sağlığı ve Güvenliği Kanunu', 4],
  ['O14', '2577 sayılı İdari Yargılama Usulü Kanunu', 5],
  ['O15', '4483 sayılı Memurlar ve Diğer Kamu Görevlilerinin Yargılanması Hakkında Kanun', 4],
  ['O16', '3194 sayılı İmar Kanunu', 4],
  ['T01', '5543 sayılı İskân Kanunu', 4],
  ['T02', '775 sayılı Gecekondu Kanunu', 4],
  ['T03', '3621 sayılı Kıyı Kanunu', 4],
  ['T04', '4708 sayılı Yapı Denetimi Hakkında Kanun', 4],
  ['T05', 'Çevresel Etki Değerlendirmesi Yönetmeliği', 3],
  ['T06', '2942 sayılı Kamulaştırma Kanunu', 4],
  ['T07', 'Planlı Alanlar İmar Yönetmeliği', 3],
  ['T08', 'Sıfır Atık Yönetmeliği', 4],
];

export const TOPICS: readonly Topic[] = Object.freeze(definitions.map(([id, title, examWeight]) => Object.freeze({
  id, title, group: id.startsWith('O') ? 'common' as const : 'technical' as const,
  examWeight, mockQuestionQuota: examWeight * 30, bankQuestionQuota: 100 as const,
  scope: Object.freeze(id === 'O01'
    ? { status: 'bounded' as const, articles: [97, 126] as const, description: '97–126. maddeler' }
    : id === 'O02'
      ? { status: 'bounded' as const, articles: [1, 212] as const, description: '1–212. maddeler' }
      : { status: 'mapping-pending' as const, description: id === 'O03'
        ? 'Genel Esaslar; Temel Haklar ve Ödevler; Devletin Temel Organları. Alt kapsam eşleştirmesi bekleniyor.'
        : id === 'O04' ? 'Dönem, olay, kurum, tarih ve neden-sonuç kapsam haritası bekleniyor.'
          : 'Resmî müfredat ve kaynakla alt konu/madde kapsam eşleştirmesi bekleniyor; bütün maddeler otomatik dahil değildir.' }),
})));

export const EXAM_CONFIG = Object.freeze({
  id: 'csidb-2027-sube-muduru-teknik',
  examDate: '2027-02-27',
  timeZone: 'Europe/Istanbul',
  questionCount: 100,
  durationMinutes: 150,
  commonQuestions: 70,
  technicalQuestions: 30,
  optionCount: 5,
  passingScore: 60,
  personalTarget: 85,
  wrongAnswerPenalty: 0,
  legalCutoffDate: '2027-01-01',
  /** Cutoff is in the future at initial setup; never label the final legal edition fixed. */
  legalEditionStatus: 'preparation' as const,
  announcementUrl: 'https://kariyerkapisi.gov.tr/IlanDetay?i=232d3886-9af8-4b69-a802-b393f13a600d',
});

/** Calendar day difference, independent of the visitor's local time zone and DST. */
export function daysUntilExam(now = new Date()): number {
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: EXAM_CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => localDate.find(p => p.type === type)?.value;
  const today = Date.UTC(Number(part('year')), Number(part('month')) - 1, Number(part('day')));
  return Math.ceil((Date.parse(`${EXAM_CONFIG.examDate}T00:00:00Z`) - today) / 86_400_000);
}
