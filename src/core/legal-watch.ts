import { canPublishQuestion, type Question, type SourceSnapshot } from './content';

/** Legal observations never publish a legal edition, amend content or rewrite results. */
export const LEGAL_CUTOFF_DATE = '2027-01-01';
export const LEGAL_WATCH_SCHEMA_VERSION = 1;
/** Public exact identities, mirrored from official-source-registry.json and regression checked. */
export const OFFICIAL_WATCH_IDENTITIES: Readonly<Record<string,{documentId:string;type:'KANUN'|'CB_KARARNAME'|'KKY';sourceId:string}>> = Object.fromEntries([
  ['O01','114832','CB_KARARNAME'],['O02','102924','KANUN'],['O03','103165','KANUN'],['O05','103128','KANUN'],['O06','103584','KANUN'],
  ['O07','103047','KANUN'],['O08','102940','KANUN'],['O09','102938','KANUN'],['O10','344872','KANUN'],['O11','103705','KANUN'],
  ['O12','104383','KANUN'],['O13','104308','KANUN'],['O14','103161','KANUN'],['O15','103459','KANUN'],['O16','103150','KANUN'],
  ['T01','103146','KANUN'],['T02','104236','KANUN'],['T03','102937','KANUN'],['T04','103102','KANUN'],['T05','103830','KKY'],
  ['T06','102999','KANUN'],['T07','106395','KKY'],['T08','105519','KKY'],
].map(([topicId,documentId,type])=>[topicId,{documentId,type:type as 'KANUN'|'CB_KARARNAME'|'KKY',sourceId:`SRC-OFFICIAL-${topicId==='O02'?'657':topicId}-UYAP`}]));
export type CheckResult = 'Verified' | 'Failed';
export type SourceChange = 'Unchanged' | 'ContentChanged' | 'TransportOnlyChanged' | 'FirstObservation' | 'Failed';
export interface LegalDates {
  originalPublicationDate: string | null;
  /** Publication of the particular amendment, not publication of the original instrument. */
  amendmentPublicationDate: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  transitionalProvisions: string | null;
  transitionReviewStatus: 'VerifiedNone' | 'Verified' | 'Pending';
}
export interface SourceObservation {
  id: string;
  sourceId: string;
  topicId: string;
  officialDocumentId: string;
  officialType: string;
  sourceUrl: string;
  checkedAt: string;
  result: CheckResult;
  parseVerified: boolean;
  httpStatus: number | null;
  responseByteLength: number;
  declaredMimeType: string | null;
  rawResponseSHA256: string | null;
  decodedContentSHA256: string | null;
  officialContentVersion: string | number | null;
  baselineSnapshotId: string | null;
  baselineRawResponseSHA256: string | null;
  baselineDecodedContentSHA256: string | null;
  baselineOfficialContentVersion: string | number | null;
  change: SourceChange;
  /** Null means article-level localization is unknown: review the source conservatively. */
  changedArticleNumbers: number[] | null;
  legalDates: LegalDates;
  error: string | null;
}
export interface LegalWatchBatch {
  schemaVersion: 1;
  kind: 'GYSOfficialSourceCheck';
  id: string;
  startedAt: string;
  completedAt: string;
  requestedTopicIds: string[];
  observations: SourceObservation[];
  complete: boolean;
  legalEdition: 'preparation';
  examCutoffDate: '2027-01-01';
  examVersionFinalized: false;
}
export interface CutoffAssessment {
  phase: 'Preparation' | 'CutoffReached';
  applicability: 'NeedsReview' | 'AfterCutoffExcluded' | 'NotEffectiveAtCutoff' | 'CandidateAtCutoff';
  final: false;
  reason: string;
}
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HASH = /^[a-f0-9]{64}$/;
const TOPIC = /^(?:O(?:0[1-9]|1[0-6])|T0[1-8])$/;
const officialURL = (value: string) => /^https:\/\/(?:mevzuat\.adalet\.gov\.tr\/mevzuat\/\d+|www\.mevzuat\.gov\.tr\/|mevzuat\.gov\.tr\/|www\.resmigazete\.gov\.tr\/|resmigazete\.gov\.tr\/)/.test(value);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isoTime = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
function dateOrNull(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v !== 'string' || !DATE.test(v)) return false;
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === v;
}
function assertDates(v: unknown): asserts v is LegalDates {
  if (!record(v) || !['originalPublicationDate','amendmentPublicationDate','effectiveFrom','effectiveUntil'].every(k => dateOrNull(v[k]))
    || !(v.transitionalProvisions === null || typeof v.transitionalProvisions === 'string')
    || !['VerifiedNone','Verified','Pending'].includes(String(v.transitionReviewStatus))
    || (v.transitionReviewStatus === 'Verified' && !(typeof v.transitionalProvisions === 'string' && v.transitionalProvisions.trim()))) throw new Error('Yayın, yürürlük veya geçiş bilgisi geçersiz.');
}
/** This is routing evidence, never a legal approval of an amendment. */
export function assessCutoff(dates: LegalDates, today: string): CutoffAssessment {
  assertDates(dates);
  if (!dateOrNull(today) || !today) throw new Error('Geçersiz kontrol tarihi.');
  const phase = today < LEGAL_CUTOFF_DATE ? 'Preparation' : 'CutoffReached';
  const result = (applicability: CutoffAssessment['applicability'], reason: string): CutoffAssessment => ({phase,applicability,final:false,reason});
  if (!dates.amendmentPublicationDate) return result('NeedsReview','Değişikliği yayımlayan düzenlemenin tarihi doğrulanmadı. Teknik kayıt tarihi hukuki tarih değildir.');
  if (dates.amendmentPublicationDate > LEGAL_CUTOFF_DATE) return result('AfterCutoffExcluded','Değişiklik kesim tarihinden sonra yayımlanmış; sınav sürümü sessizce değiştirilmez.');
  if (!dates.effectiveFrom || dates.transitionReviewStatus === 'Pending') return result('NeedsReview','Yürürlük tarihi veya geçiş hükümleri ayrıca doğrulanmalı.');
  if (dates.effectiveFrom > LEGAL_CUTOFF_DATE || (dates.effectiveUntil !== null && dates.effectiveUntil < LEGAL_CUTOFF_DATE)) return result('NotEffectiveAtCutoff','Hükmün kesim tarihindeki yürürlüğü ayrıca incelenmeli.');
  return result('CandidateAtCutoff',phase === 'Preparation' ? 'Hazırlık adayı; kesim tarihi gelecekte ve nihai sınav sürümü henüz sabitlenmedi.' : 'Yayın ve yürürlük tarihleri uygun aday; geçiş hükümleri ve sınav kapsamı insan incelemesi gerektirir.');
}
/** Derive semantic change from actual parsed bytes, not a process exit code or a timestamp. */
export function classifySourceChange(observation: Pick<SourceObservation,'result'|'parseVerified'|'decodedContentSHA256'|'rawResponseSHA256'|'baselineDecodedContentSHA256'|'baselineRawResponseSHA256'|'officialContentVersion'|'baselineOfficialContentVersion'>): SourceChange {
  if (observation.result !== 'Verified' || !observation.parseVerified) return 'Failed';
  if (!observation.baselineDecodedContentSHA256) return 'FirstObservation';
  if (observation.decodedContentSHA256 !== observation.baselineDecodedContentSHA256
    || (observation.baselineOfficialContentVersion !== null && String(observation.officialContentVersion) !== String(observation.baselineOfficialContentVersion))) return 'ContentChanged';
  return observation.rawResponseSHA256 !== observation.baselineRawResponseSHA256 ? 'TransportOnlyChanged' : 'Unchanged';
}
/** Bounded import of untrusted local/server artifacts; no HTML is ever rendered. */
export function validateLegalWatchBatch(input: unknown): LegalWatchBatch {
  if (!record(input) || input.schemaVersion !== 1 || input.kind !== 'GYSOfficialSourceCheck'
    || typeof input.id !== 'string' || !/^[\w:.-]{1,200}$/.test(input.id)
    || !isoTime(input.startedAt) || !isoTime(input.completedAt) || Date.parse(input.completedAt) < Date.parse(input.startedAt)
    || input.legalEdition !== 'preparation' || input.examCutoffDate !== LEGAL_CUTOFF_DATE || input.examVersionFinalized !== false
    || typeof input.complete !== 'boolean' || !Array.isArray(input.requestedTopicIds) || !input.requestedTopicIds.length || input.requestedTopicIds.length > 23
    || input.requestedTopicIds.some(v => typeof v !== 'string' || !TOPIC.test(v) || v === 'O04')
    || new Set(input.requestedTopicIds).size !== input.requestedTopicIds.length
    || !Array.isArray(input.observations) || input.observations.length !== input.requestedTopicIds.length) throw new Error('Mevzuat kontrol raporu şeması geçersiz.');
  const ids = new Set<string>(); const topics = new Set<string>();
  for (const v of input.observations) {
    if (!record(v) || typeof v.id !== 'string' || !/^[\w:.-]{1,240}$/.test(v.id) || ids.has(v.id)
      || typeof v.sourceId !== 'string' || !/^SRC-OFFICIAL-[\w-]{1,100}$/.test(v.sourceId)
      || typeof v.topicId !== 'string' || !input.requestedTopicIds.includes(v.topicId) || topics.has(v.topicId)
      || typeof v.officialDocumentId !== 'string' || !/^\d{1,12}$/.test(v.officialDocumentId)
      || !['KANUN','CB_KARARNAME','KKY'].includes(String(v.officialType))
      || typeof v.sourceUrl !== 'string' || !officialURL(v.sourceUrl) || !isoTime(v.checkedAt)
      || Date.parse(v.checkedAt) < Date.parse(input.startedAt) || Date.parse(v.checkedAt) > Date.parse(input.completedAt)
      || !['Verified','Failed'].includes(String(v.result)) || typeof v.parseVerified !== 'boolean'
      || !(v.httpStatus === null || (Number.isInteger(v.httpStatus) && Number(v.httpStatus) >= 100 && Number(v.httpStatus) <= 599))
      || !Number.isSafeInteger(v.responseByteLength) || Number(v.responseByteLength) < 0 || Number(v.responseByteLength) > 16 * 1024 * 1024
      || !(v.declaredMimeType === null || typeof v.declaredMimeType === 'string')
      || !['rawResponseSHA256','decodedContentSHA256','baselineRawResponseSHA256','baselineDecodedContentSHA256'].every(k => v[k] === null || (typeof v[k] === 'string' && HASH.test(v[k] as string)))
      || !['officialContentVersion','baselineOfficialContentVersion'].every(k => v[k] === null || typeof v[k] === 'string' || Number.isSafeInteger(v[k]))
      || !(v.baselineSnapshotId === null || (typeof v.baselineSnapshotId === 'string' && v.baselineSnapshotId.length <= 240))
      || !(v.changedArticleNumbers === null || (Array.isArray(v.changedArticleNumbers) && v.changedArticleNumbers.length <= 3000 && v.changedArticleNumbers.every(n => Number.isInteger(n) && n > 0)))
      || !(v.error === null || (typeof v.error === 'string' && v.error.length <= 1000))) throw new Error('Mevzuat kaynak gözlemi geçersiz.');
    assertDates(v.legalDates);
    const o = v as unknown as SourceObservation;
    const identity=OFFICIAL_WATCH_IDENTITIES[o.topicId];
    if (!identity || identity.documentId!==o.officialDocumentId || identity.type!==o.officialType || identity.sourceId!==o.sourceId
      || o.sourceUrl!==`https://mevzuat.adalet.gov.tr/mevzuat/${identity.documentId}` || o.id!==`${input.id}:${o.topicId}`) throw new Error('Kayıtlı resmî kaynak kimliği eşleşmiyor.');
    if (o.change !== classifySourceChange(o) || (o.result === 'Verified' && (!o.parseVerified || o.httpStatus !== 200 || !o.responseByteLength || !o.rawResponseSHA256 || !o.decodedContentSHA256
      || !['text/html','application/pdf'].includes(o.declaredMimeType ?? '') || !/^[1-9]\d{0,14}$/.test(String(o.officialContentVersion)) || o.error !== null))
      || (o.result === 'Failed' && (o.parseVerified || !o.error))) throw new Error('Başarılı kontrol kanıtı veya değişiklik sınıflaması tutarsız.');
    ids.add(o.id); topics.add(o.topicId);
  }
  const complete = input.observations.every(v => (v as SourceObservation).result === 'Verified');
  if (input.complete !== complete) throw new Error('Tamamlanmamış kontrol başarılı gösterilemez.');
  return structuredClone(input) as unknown as LegalWatchBatch;
}
export interface LegalDependency {
  sourceId: string;
  articleNumbers?: number[];
  legalProvisionIds?: string[];
  learningObjectiveIds?: string[];
  questionIds?: string[];
  optionIds?: string[];
  explanationIds?: string[];
  flashcardIds?: string[];
  comparisonRowIds?: string[];
}
export interface RevalidationItem {
  id: string;
  observationId: string;
  sourceId: string;
  topicId: string;
  reason: 'SourceContentChanged';
  status: 'ValidationPending';
  runtimeContentStatus: 'Outdated';
  affected: Required<Omit<LegalDependency,'sourceId'|'articleNumbers'>>;
  requiresWholeSourceReview: boolean;
  createdAt: string;
  /** Separate explicit publication can supersede content; this event cannot. */
  publicationApplied: false;
}
export function buildImpact(observation: SourceObservation, dependencies: readonly LegalDependency[]): RevalidationItem | null {
  if (observation.result !== 'Verified' || observation.change !== 'ContentChanged') return null;
  const related = dependencies.filter(d => d.sourceId === observation.sourceId && (observation.changedArticleNumbers === null
    || !d.articleNumbers?.length || d.articleNumbers.some(n => observation.changedArticleNumbers!.includes(n))));
  const collect = (key: keyof RevalidationItem['affected']) => [...new Set(related.flatMap(d => d[key] ?? []))].sort();
  return {id:`REVALIDATE:${observation.id}`,observationId:observation.id,sourceId:observation.sourceId,topicId:observation.topicId,
    reason:'SourceContentChanged',status:'ValidationPending',runtimeContentStatus:'Outdated',
    affected:{legalProvisionIds:collect('legalProvisionIds'),learningObjectiveIds:collect('learningObjectiveIds'),questionIds:collect('questionIds'),optionIds:collect('optionIds'),explanationIds:collect('explanationIds'),flashcardIds:collect('flashcardIds'),comparisonRowIds:collect('comparisonRowIds')},
    requiresWholeSourceReview:observation.changedArticleNumbers === null,createdAt:observation.checkedAt,publicationApplied:false};
}
export type ComparisonKind = 'durations' | 'authorities' | 'remedies' | 'historical';
export interface ComparisonFact {
  id: string;
  kind: ComparisonKind;
  topicId: string;
  title: string;
  value: string;
  startingEvent?: string;
  historicalValue?: string;
  currentValue?: string | null;
  currentOptionsHaveAnswer?: boolean;
  legalProvisionId: string;
  sourceSnapshotId: string;
  sourceUrl: string;
  sourceLocator: string;
  quote: string;
  verificationStatus: 'Approved' | 'Pending';
  origin: 'ApprovedContent' | 'VerifiedSourceFact';
}
export type ComparisonTables = Record<ComparisonKind, ComparisonFact[]>;
/** No lexical guessing of deadlines, powers, exceptions or old/new answers. */
export function buildComparisonTables(facts: readonly ComparisonFact[]): ComparisonTables {
  const tables: ComparisonTables = {durations:[],authorities:[],remedies:[],historical:[]};
  for (const fact of facts) {
    if (fact.verificationStatus !== 'Approved') continue;
    if (!Object.hasOwn(tables,fact.kind) || !TOPIC.test(fact.topicId) || !fact.id || !fact.title || !fact.value
      || !fact.legalProvisionId || !fact.sourceSnapshotId || !officialURL(fact.sourceUrl) || !fact.sourceLocator || !fact.quote.trim()
      || !['ApprovedContent','VerifiedSourceFact'].includes(fact.origin)
      || (fact.kind === 'durations' && !fact.startingEvent)
      || (fact.kind === 'historical' && (!fact.historicalValue || !Object.hasOwn(fact,'currentValue')))) throw new Error('Karşılaştırma satırı kaynak/inceleme kanıtı eksik.');
    if (Object.values(tables).some(rows => rows.some(row => row.id === fact.id))) throw new Error('Yinelenen karşılaştırma kimliği.');
    tables[fact.kind].push(structuredClone(fact));
  }
  return tables;
}
export interface ComparisonProvision {
  legalProvisionId: string;
  sourceSnapshotId: string;
  articleNumber: number;
  title: string;
  sourceLocator: string;
  rawResponseSHA256: string;
  verificationStatus: string;
  text: string;
  paragraphs?: {text:string;sourceLocator?:string;presentInFullOfficialDocument?:boolean}[];
}
/**
 * Conservative 657 preparation comparisons: display exact published source paragraphs.
 * A related Approved question plus its verified snapshot is required. No sentence is
 * converted into a novel legal summary, date or historical answer. Missing facts stay empty.
 */
export function comparisonTablesFromApprovedContent(questions: readonly Question[], snapshots: readonly SourceSnapshot[], provisions: readonly ComparisonProvision[]): ComparisonTables {
  const facts: ComparisonFact[]=[];
  const selectors:{articleNumber:number;kind:ComparisonKind;prefix:string}[]=[
    {articleNumber:135,kind:'durations',prefix:'İtirazda süre,'},
    {articleNumber:135,kind:'authorities',prefix:'İtiraz mercileri,'},
    {articleNumber:129,kind:'authorities',prefix:'Yüksek disiplin kurulları kendilerine'},
    {articleNumber:135,kind:'remedies',prefix:'Disiplin amirleri tarafından verilen'},
    {articleNumber:135,kind:'remedies',prefix:'Disiplin cezalarına karşı idari yargı'},
  ];
  for (const selector of selectors) {
    const provision=provisions.find(p=>p.articleNumber===selector.articleNumber && p.legalProvisionId===`LP-657-${selector.articleNumber}`);
    if (!provision) continue;
    const question=questions.find(q=>q.topicId==='O02' && q.sourcePool==='B' && q.legalProvisionId===provision.legalProvisionId && q.sourceSnapshotId===provision.sourceSnapshotId
      && canPublishQuestion(q,snapshots.find(s=>s.id===q.sourceSnapshotId)));
    const snapshot=question && snapshots.find(s=>s.id===question.sourceSnapshotId && s.sourceId==='SRC-OFFICIAL-657-UYAP');
    const paragraph=provision.paragraphs?.find(p=>p.text.trim().startsWith(selector.prefix));
    // An article response has its own raw hash; it is not the full-document raw hash.
    if (!snapshot || !HASH.test(provision.rawResponseSHA256) || provision.verificationStatus!=='OfficialTextRetrievedAndCrossCheckedAgainstFullDocument'
      || !paragraph || paragraph.presentInFullOfficialDocument!==true || !provision.text.includes(paragraph.text)) continue;
    facts.push({id:`COMPARISON:${provision.legalProvisionId}:${selector.kind}:${facts.length+1}`,kind:selector.kind,topicId:'O02',title:provision.title,
      value:paragraph.text, ...(selector.kind==='durations'?{startingEvent:'kararın ilgiliye tebliği tarihinden'}:{}), legalProvisionId:provision.legalProvisionId,
      sourceSnapshotId:snapshot.id,sourceUrl:snapshot.sourceUrl,sourceLocator:paragraph.sourceLocator ?? provision.sourceLocator,
      quote:paragraph.text,verificationStatus:'Approved',origin:'ApprovedContent'});
  }
  return buildComparisonTables(facts);
}
