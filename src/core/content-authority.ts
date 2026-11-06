import type { AttemptQuestion } from '../attempt-store';
import type { Question, SourceSnapshot } from './content';
import type { StartStrictInput, StrictRecord } from '../strict-store';

/** Backup validation proves shape, never publication authority. Compare with trusted bundled bytes. */
export function canonicalJSON(value: unknown): string {
  if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonicalJSON(v)).join(',')+'}';
  return JSON.stringify(value);
}
export function matchesPublishedStudy(saved:AttemptQuestion,question:Question,snapshot:SourceSnapshot):boolean {
  return saved.id===question.id&&saved.version===question.version&&saved.topicId===question.topicId
    &&saved.text===question.text&&saved.correctOptionId===question.correctOptionId&&saved.explanation===question.explanation
    &&saved.sourceSnapshotId===snapshot.id&&saved.sourceContentHash===snapshot.contentHash&&saved.sourceUrl===snapshot.sourceUrl
    &&saved.sourceLocator===question.sourceLocator&&saved.legalEdition===snapshot.legalEdition
    &&(!saved.learningObjectiveId||saved.learningObjectiveId===question.learningObjectiveId)
    &&(!saved.difficulty||saved.difficulty===question.difficulty)&&(!saved.cognitiveType||saved.cognitiveType===question.cognitiveType)
    &&saved.options.length===question.options.length&&saved.options.every(o=>question.options.some(p=>p.id===o.id&&p.text===o.text));
}
export function matchesPublishedExam(saved:Pick<StrictRecord,'definition'|'questions'|'snapshots'>,pack:StartStrictInput):boolean {
  return canonicalJSON(saved.definition)===canonicalJSON(pack.definition)
    &&canonicalJSON(saved.questions)===canonicalJSON(pack.questions)&&canonicalJSON(saved.snapshots)===canonicalJSON(pack.snapshots);
}
