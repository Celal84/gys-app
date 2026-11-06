import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { TOPICS } from '../src/core/curriculum';
import type { Question, SourceSnapshot } from '../src/core/content';
import { validateCandidate, type Candidate, type BatchContext } from '../scripts/publish-content';
import { evaluateExamReadiness, examContentFingerprint, protectedIsolationIssues, publishExams, type CompleteExamReview } from '../scripts/publish-exams';
import config from '../data/exam-publication-batches.json';

const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const clone=<T>(value:T):T=>structuredClone(value);
const temporary:string[]=[];
afterEach(async()=>{await Promise.all(temporary.splice(0).map(path=>rm(path,{recursive:true,force:true})));});

/** Synthetic mechanics only; neither law nor deliverable exam content. */
function synthetic(){
 const snapshot:SourceSnapshot={id:'SYNTHETIC-SOURCE',sourceId:'SYNTHETIC-ONLY',sourceUrl:'https://example.org/synthetic',contentHash:'a'.repeat(64),hashAlgorithm:'sha256',version:'1',readAt:'2026-11-06T00:00:00Z',verificationStatus:'Verified',legalEdition:'preparation'};
 const questions:Question[]=TOPICS.flatMap(topic=>Array.from({length:topic.examWeight},(_,n)=>({id:`SYNTHETIC-${topic.id}-${n}`,version:1,sourcePool:'A',topicId:topic.id,learningObjectiveId:`SYNTHETIC-LO-${topic.id}-${n}`,text:`SYNTHETIC TEST ONLY ${topic.id} ${n}`,options:[1,2,3,4,5].map(n=>({id:String(n),text:'Synthetic option '+n})),correctOptionId:'1',explanation:'Synthetic mechanics only',legalProvisionId:'SYNTHETIC-LP',sourceSnapshotId:snapshot.id,sourceLocator:`synthetic-${topic.id}-${n}`,articleNumber:topic.id==='O01'?97:1,scopeMapping:{status:'Approved',evidenceLocator:'Synthetic scope only'},difficulty:'basic',cognitiveType:'synthetic',scenarioFlag:false,verificationStatus:'Approved',generatedBy:'synthetic-writer',examId:'EXAM-01',verificationEvidence:[{id:`SYNTHETIC-CHECK-${topic.id}-${n}`,method:'rule-check',checkedBy:'synthetic-checker',checkedAt:'2026-11-06T00:00:00Z',sourceSnapshotId:snapshot.id,sourceContentHash:snapshot.contentHash,sourceLocator:`synthetic-${topic.id}-${n}`,correctOptionId:'1',conclusion:'pass',evidence:'Synthetic mechanics proof, not legal approval.'}]})));
 const snapshots=[snapshot];const review:CompleteExamReview={examId:'EXAM-01',version:1,checkedBy:'separate-synthetic-reviewer',checkedAt:'2026-11-06T00:00:00Z',decision:'Pass',contentSHA256:examContentFingerprint(questions,snapshots),fullExamDistribution:'Pass',duplicateReview:'Pass',protectedPoolIsolation:'Pass',notes:['Synthetic complete exam review fixture; never application content.']};
 return{questions,snapshots,review};
}

describe('Complete protected publication gate',()=>{
 it('requires100questions, every canonical topic weight,70/30 and a separate complete-exam review',()=>{
  const s=synthetic();expect(evaluateExamReadiness('EXAM-01',s.questions,s.snapshots,s.review).ready).toBe(true);
  expect(evaluateExamReadiness('EXAM-01',s.questions,s.snapshots).ready).toBe(false);
  const fragment=s.questions.filter(q=>q.topicId==='O03');const result=evaluateExamReadiness('EXAM-01',fragment,s.snapshots,s.review);
  expect(result.ready).toBe(false);expect(result.questionCount).toBe(4);expect(result.perTopic.find(t=>t.topicId==='O02')?.deficit).toBe(8);
  expect(result.perTopic.reduce((n,t)=>n+t.deficit,0)).toBe(96);
  const wrong=clone(s.questions);wrong[0].topicId='O02';wrong[0].articleNumber=1;
  expect(evaluateExamReadiness('EXAM-01',wrong,s.snapshots,s.review).issues).toContain('Wrong distribution: O01');
 });
 it('blocks changed keys, stale complete reviews, self review and missing duplicate-review decisions',()=>{
  const s=synthetic();
  for(const review of [{...s.review,contentSHA256:'b'.repeat(64)},{...s.review,checkedBy:'synthetic-writer'},{...s.review,duplicateReview:'NeedsReview' as const},{...s.review,fullExamDistribution:'NeedsReview' as const},{...s.review,protectedPoolIsolation:'NeedsReview' as const}])expect(evaluateExamReadiness('EXAM-01',s.questions,s.snapshots,review).ready).toBe(false);
  const changed=clone(s.questions);changed[0].correctOptionId='2';expect(evaluateExamReadiness('EXAM-01',changed,s.snapshots,s.review).ready).toBe(false);
  const pending=clone(s.snapshots);pending[0].verificationStatus='Pending';expect(evaluateExamReadiness('EXAM-01',s.questions,pending,s.review).ready).toBe(false);
 });
 it('rejects B/C leakage, repeated IDs/text/objectives, cross-exam reuse and quota overflow',()=>{
  const s=synthetic();expect(protectedIsolationIssues(s.questions,[])).toEqual([]);
  for(const pool of ['B','C'] as const){const q=clone(s.questions[0]);q.sourcePool=pool;expect(protectedIsolationIssues([q],[]).join(' ')).toContain('leakage');}
  const repeat=clone(s.questions[0]);repeat.examId='EXAM-02';expect(protectedIsolationIssues([s.questions[0],repeat],[]).join(' ')).toContain('Repeated question identity');
  const renamed=clone(repeat);renamed.id='SYNTHETIC-RENAMED';expect(protectedIsolationIssues([s.questions[0],renamed],[]).join(' ')).toContain('Repeated question text');
  renamed.text='Different synthetic wording';expect(protectedIsolationIssues([s.questions[0],renamed],[]).join(' ')).toContain('Repeated objective/cognitive');
  const study=clone(s.questions[0]);study.sourcePool='B';expect(protectedIsolationIssues(s.questions,[study]).join(' ')).toContain('Repeated question identity');
  const overflow=Array.from({length:61},(_,i)=>({...clone(s.questions.find(q=>q.topicId==='O05')!),id:'SYNTHETIC-OVER-'+i,text:'SYNTHETIC quota '+i,learningObjectiveId:'SYNTHETIC-OVER-LO-'+i}));expect(protectedIsolationIssues(overflow,[]).join(' ')).toContain('quota exceeded: O05');
 });
 it('does not let new IDs disguise an identical source fact with the same cognitive operation',()=>{
  const s=synthetic();const q={...s.questions[0],expectedFacts:{sourceQuoteSHA256:'c'.repeat(64),normalizedCorrectText:'one'}} as Candidate;
  const renamed={...clone(q),id:'SYNTHETIC-NAMED-AGAIN',text:'Other wording',learningObjectiveId:'SYNTHETIC-NEW-LO',examId:'EXAM-02'};
  expect(protectedIsolationIssues([q,renamed],[]).join(' ')).toContain('Repeated source fact/cognitive operation');
  const bank={...clone(q),sourcePool:'B' as const};expect(protectedIsolationIssues([renamed],[bank]).join(' ')).toContain('Repeated source fact/cognitive operation');
 });
});

const batch=config.batches[0];
const raw=JSON.parse(await readFile(batch.candidateFile,'utf8'));
const source=JSON.parse(await readFile(batch.sourceFile,'utf8'));
const audit=JSON.parse(await readFile(batch.auditFile,'utf8'));
const reviewed=JSON.parse(await readFile(batch.reviewFile,'utf8'));
const rules=JSON.parse(await readFile(batch.rulesFile,'utf8'));
const objectiveData=JSON.parse(await readFile(batch.objectiveFile,'utf8'));
const sourceTexts=JSON.parse(execFileSync('python3',['scripts/extract_official_html.py',...audit.artifacts.map((a:{path:string})=>a.path)],{encoding:'utf8',maxBuffer:16*1024*1024}));
const context:BatchContext={config:{...batch,sourcePool:'A'},source,artifacts:audit.artifacts,sourceTexts,reviews:reviewed.reviews,rules:rules.rules,objectives:objectiveData.learningObjectives,reviewFileUnchanged:true,rulesFileUnchanged:true};

it('the real protected batch fails when independent bytes, answer or official quote evidence is tampered',()=>{
 const q=raw.questions[0] as Candidate;expect(validateCandidate(q,context)).toEqual([]);
 expect(validateCandidate(q,{...context,reviewFileUnchanged:false})).toContain('Batch bytes changed after independent review');
 expect(validateCandidate(q,{...context,rulesFileUnchanged:false})).toContain('Batch bytes changed after independent review');
 const changed=clone(q);changed.options[0].text='Tampered option';expect(validateCandidate(changed,context)).toContain('Candidate changed after independent review');
 expect(validateCandidate(q,{...context,sourceTexts:{}})).toContain('Source quote absent from immutable official HTML bytes');
 const scope=clone(context);scope.reviews[0].scopeMapping=undefined;expect(validateCandidate(q,scope)).toContain('Scope mapping is not approved');
 const own=clone(context);own.reviews[0].checkedBy=q.generatedBy;expect(validateCandidate(q,own)).toContain('Independent reviewer identity missing');
});
it('stages246verified protected items, preserves2review gaps and reports30incomplete exams without changing public files',async()=>{
 const outputDir=await mkdtemp(join(tmpdir(),'gys-protected-publication-'));temporary.push(outputDir);
 const paths=['data/exam-manifest.json','data/content-manifest.json','public/content/O02.json','data/approved-content.json'];const before=await Promise.all(paths.map(path=>readFile(path).then(hash)));
 const report=await publishExams(undefined,{outputDir});
 expect(report.candidates).toBe(248);expect(report.stagedVerifiedQuestions).toBe(246);expect(report.pendingCandidates).toBe(2);expect(report.readyExamCount).toBe(0);expect(report.publishedApprovedMockQuestions).toBe(0);expect(report.publicFilesWritten).toBe(false);
 expect(report.definitions).toHaveLength(30);for(const exam of report.definitions){expect(exam.ready).toBe(false);expect(exam.questionCount).toBeGreaterThanOrEqual(4);expect(exam.questionCount).toBeLessThanOrEqual(12);expect(exam.commonCount).toBe(exam.questionCount);expect(exam.technicalCount).toBe(0);expect(exam.perTopic.reduce((n,t)=>n+t.deficit,0)).toBe(100-exam.questionCount);}
 const staged=JSON.parse(await readFile(join(outputDir,'data/approved-exam-content.json'),'utf8'));expect(staged.stageOnly).toBe(true);expect(staged.publicStudyUseAllowed).toBe(false);expect(staged.questions).toHaveLength(246);expect(staged.questions.some((q:Question)=>['Q-O01-A-0038','Q-O01-A-0106'].includes(q.id))).toBe(false);expect(staged.questions.every((q:Question)=>q.sourcePool==='A'&&q.verificationStatus==='Approved')).toBe(true);
 expect(await Promise.all(paths.map(path=>readFile(path).then(hash)))).toEqual(before);
},15000);
