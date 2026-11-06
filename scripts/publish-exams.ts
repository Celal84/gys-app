/** Protected content is staged outside PWA assets. No fragment can become a study-bank chunk. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TOPICS } from '../src/core/curriculum';
import { canPublishQuestion, validateExamQuestions, type Question, type SourceSnapshot } from '../src/core/content';
import type { StrictExamDefinition } from '../src/strict-store';
import { validateCandidate, type Candidate, type BatchConfig, type BatchContext, type Artifact } from './publish-content';

const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('tr').replace(/\s+/g,' ').trim();
const readJSON=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const examIdPattern=/^EXAM-(?:0[1-9]|[12]\d|30)$/;
interface ExamConfig {schemaVersion:1;plannedExamCount:30;batches:BatchConfig[];examReviews:{examId:string;reviewFile:string}[]}
export interface CompleteExamReview {
 examId:string;version:number;checkedBy:string;checkedAt:string;decision:'Pass'|'NeedsReview';
 contentSHA256:string;fullExamDistribution:'Pass'|'NeedsReview';duplicateReview:'Pass'|'NeedsReview';
 protectedPoolIsolation:'Pass'|'NeedsReview';notes:string[];
}
export interface StagedQuestion extends Question {expectedFacts?:Candidate['expectedFacts']}
export interface ExamReadiness {
 id:string;ready:boolean;questionCount:number;commonCount:number;technicalCount:number;
 perTopic:{topicId:string;required:number;verified:number;deficit:number;excess:number}[];issues:string[];contentSHA256:string;
}
export function examContentFingerprint(questions:readonly Question[],snapshots:readonly SourceSnapshot[]):string {
 return hash(JSON.stringify({questions:[...questions].sort((a,b)=>a.id.localeCompare(b.id)),snapshots:[...snapshots].sort((a,b)=>a.id.localeCompare(b.id))}));
}
/** Detect exact and fact/operation overlap independently of an author's renamed question IDs. */
function factKey(question:StagedQuestion):string|undefined {
 const fact=question.expectedFacts;
 return fact?JSON.stringify([question.legalProvisionId,fact.sourceQuoteSHA256,normalize(fact.normalizedCorrectText),question.cognitiveType]):undefined;
}
export function protectedIsolationIssues(protectedQuestions:readonly StagedQuestion[],studyQuestions:readonly StagedQuestion[]):string[]{
 const issues:string[]=[];const ids=new Set<string>();const texts=new Set<string>();const objectives=new Set<string>();const facts=new Set<string>();
 const studyIds=new Set(studyQuestions.map(q=>q.id));const studyTexts=new Set(studyQuestions.map(q=>normalize(q.text)));
 const studyObjectives=new Set(studyQuestions.map(q=>q.learningObjectiveId+':'+q.cognitiveType));const studyFacts=new Set(studyQuestions.map(factKey).filter(Boolean));
 for(const q of protectedQuestions){
  if(q.sourcePool!=='A')issues.push(`Protected pool leakage: ${q.id}`);
  if(!q.examId||!examIdPattern.test(q.examId))issues.push(`Invalid protected exam identity: ${q.id}`);
  const text=normalize(q.text),objective=q.learningObjectiveId+':'+q.cognitiveType,fact=factKey(q);
  if(ids.has(q.id)||studyIds.has(q.id))issues.push(`Repeated question identity: ${q.id}`);
  if(texts.has(text)||studyTexts.has(text))issues.push(`Repeated question text: ${q.id}`);
  if(objectives.has(objective)||studyObjectives.has(objective))issues.push(`Repeated objective/cognitive operation: ${q.id}`);
  if(fact&&(facts.has(fact)||studyFacts.has(fact)))issues.push(`Repeated source fact/cognitive operation: ${q.id}`);
  ids.add(q.id);texts.add(text);objectives.add(objective);if(fact)facts.add(fact);
 }
 for(const topic of TOPICS)if(protectedQuestions.filter(q=>q.topicId===topic.id).length>topic.mockQuestionQuota)issues.push(`Protected topic quota exceeded: ${topic.id}`);
 return issues;
}
/** A review of a single topic cannot stand in for the independent complete-exam review. */
export function evaluateExamReadiness(examId:string,questions:readonly Question[],snapshots:readonly SourceSnapshot[],review?:CompleteExamReview):ExamReadiness {
 const issues=validateExamQuestions(questions,snapshots);if(!examIdPattern.test(examId)||questions.some(q=>q.examId!==examId))issues.push('Invalid complete exam identity');
 const perTopic=TOPICS.map(topic=>{const verified=questions.filter(q=>q.topicId===topic.id).length;return{topicId:topic.id,required:topic.examWeight,verified,deficit:Math.max(0,topic.examWeight-verified),excess:Math.max(0,verified-topic.examWeight)};});
 const fingerprint=examContentFingerprint(questions,snapshots);
 if(!review||review.examId!==examId||review.decision!=='Pass'||review.fullExamDistribution!=='Pass'||review.duplicateReview!=='Pass'||review.protectedPoolIsolation!=='Pass'
  ||review.contentSHA256!==fingerprint||!Number.isInteger(review.version)||review.version<1||!review.checkedBy||questions.some(q=>q.generatedBy===review.checkedBy)
  ||!Number.isFinite(Date.parse(review.checkedAt))||!Array.isArray(review.notes)||!review.notes.some(n=>typeof n==='string'&&n.trim()))issues.push('Independent complete-exam distribution/duplicate review missing or stale');
 return{id:examId,ready:issues.length===0,questionCount:questions.length,commonCount:questions.filter(q=>q.topicId.startsWith('O')).length,technicalCount:questions.filter(q=>q.topicId.startsWith('T')).length,perTopic,issues,contentSHA256:fingerprint};
}
function safeDataPath(path:string):boolean{return typeof path==='string'&&path.startsWith('data/')&&!path.includes('..')&&!path.includes('\\');}
async function writeAtomic(path:string,text:string){await mkdir(dirname(path),{recursive:true});const temporary=path+'.pending';await writeFile(temporary,text);await rename(temporary,path);}

export async function publishExams(configFile='data/exam-publication-batches.json',options:{outputDir?:string;publishPublic?:boolean}={}){
 const config=await readJSON(configFile) as ExamConfig;
 if(config.schemaVersion!==1||config.plannedExamCount!==30||!Array.isArray(config.batches)||!Array.isArray(config.examReviews))throw new Error('Invalid protected publication configuration');
 const outputDir=options.outputDir||'.';const output=(path:string)=>join(outputDir,path);
 const catalog=await readJSON('data/curriculum-map.json');const registry=await readJSON('data/official-source-registry.json');
 const study=await readJSON('data/approved-content.json') as {questions:StagedQuestion[]};
 const staged:Question[]=[];const snapshots=new Map<string,SourceSnapshot>();const outcomes:{questionId:string;issues:string[];status:string}[]=[];let candidates=0;let artifactCount=0;
 for(const batch of config.batches){
  if(batch.sourcePool!=='A')throw new Error('Exam publisher accepts protected A only; B/C cannot fill missing questions');
  for(const path of [batch.candidateFile,batch.rulesFile,batch.sourceFile,batch.auditFile,batch.reviewFile,...(batch.objectiveFile?[batch.objectiveFile]:[])])if(!safeDataPath(path))throw new Error('Unsafe protected batch path');
  const [candidate,source,audit,review,rules,objectives]=await Promise.all([readJSON(batch.candidateFile),readJSON(batch.sourceFile),readJSON(batch.auditFile),readJSON(batch.reviewFile),readJSON(batch.rulesFile),batch.objectiveFile?readJSON(batch.objectiveFile):Promise.resolve(null)]);
  if(!Array.isArray(candidate.questions)||!Array.isArray(candidate.snapshots)||!Array.isArray(review.reviews)||!Array.isArray(rules.rules))throw new Error('Incomplete protected batch');
  if(hash(await readFile(batch.sourceFile))!==audit.publicProvisionFileSHA256)throw new Error('Protected official provision file changed');
  const artifacts=(audit.artifacts||audit.records) as Artifact[];
  if(!Array.isArray(artifacts)||!artifacts.length)throw new Error('Protected source artifacts missing');
  for(const artifact of artifacts){if(!artifact.path.startsWith('data/public-legal-sources/snapshots/')||artifact.path.includes('..')||hash(await readFile(artifact.path))!==artifact.sha256)throw new Error('Protected official artifact hash/path failed');}
  const sourceTexts:Record<string,string>=JSON.parse(execFileSync('python3',['scripts/extract_official_html.py',...artifacts.map(a=>a.path)],{encoding:'utf8',maxBuffer:16*1024*1024}));
  const verifiedSnapshots=(candidate.snapshots as SourceSnapshot[]).map(snapshot=>{
   const official=registry.entries.find((entry:{topicId:string})=>entry.topicId===batch.topicId);const officialId=official?.identity?.officialDocumentId||official?.officialDocumentId;const officialHash=official?.snapshot?.rawResponseSHA256||official?.rawResponseSHA256;
   if(snapshot.id!==source.snapshot.sourceSnapshotId||snapshot.contentHash!==source.snapshot.rawResponseSHA256||snapshot.contentHash!==officialHash||snapshot.sourceUrl!==`https://mevzuat.adalet.gov.tr/mevzuat/${officialId}`||snapshot.legalEdition!=='preparation')throw new Error('Protected exact official snapshot identity failed');
   return{...snapshot,decodedContentHash:source.snapshot.decodedHTMLSHA256,verificationStatus:'Verified' as const};
  });
  for(const snapshot of verifiedSnapshots){const old=snapshots.get(snapshot.id);if(old&&['sourceId','sourceUrl','contentHash','version','legalEdition'].some(k=>old[k as keyof SourceSnapshot]!==snapshot[k as keyof SourceSnapshot]))throw new Error('Conflicting protected immutable source identity');if(!old)snapshots.set(snapshot.id,snapshot);}
  const context:BatchContext={config:batch,source,artifacts,sourceTexts,objectives:[...catalog.learningObjectives,...(objectives?.objectives||objectives?.learningObjectives||[])],reviews:review.reviews,rules:rules.rules,
   reviewFileUnchanged:review.candidateFileSHA256===hash(await readFile(batch.candidateFile)),rulesFileUnchanged:typeof review.rulesFileSHA256==='string'&&review.rulesFileSHA256===hash(await readFile(batch.rulesFile))};
  for(const question of candidate.questions as Candidate[]){
   const issues=validateCandidate(question,context);if(!question.examId||!examIdPattern.test(question.examId))issues.push('Invalid assigned protected exam identity');
   const checked=context.reviews.find(r=>r.questionId===question.id);const fact=question.expectedFacts;
   if(!issues.length&&checked){
    const published:Question={...question,scopeMapping:{status:'Approved',evidenceLocator:checked.scopeMapping?.evidenceLocator||question.scopeMapping?.evidenceLocator||question.sourceLocator},verificationStatus:'Approved',verificationEvidence:[
     {id:fact.ruleId+'-protected-checked',method:'rule-check',checkedBy:'protected-official-quote-rule-check-v1',checkedAt:checked.checkedAt,sourceSnapshotId:question.sourceSnapshotId,sourceContentHash:fact.sourceContentHash,sourceLocator:question.sourceLocator,correctOptionId:question.correctOptionId,conclusion:'pass',evidence:`Immutable official artifact, exact quote SHA256 ${fact.sourceQuoteSHA256}, separate rule, stable answer and objective/scope identity checks passed. This check alone is not legal approval.`},
     {id:'REVIEW-'+question.id,method:'official-provision-comparison',checkedBy:checked.checkedBy,checkedAt:checked.checkedAt,sourceSnapshotId:question.sourceSnapshotId,sourceContentHash:fact.sourceContentHash,sourceLocator:question.sourceLocator,correctOptionId:question.correctOptionId,conclusion:'pass',evidence:JSON.stringify({candidateSha256:checked.candidateSha256,sourceQuote:checked.sourceQuote,notes:checked.notes,reviewFile:batch.reviewFile})}
    ]};
    if(canPublishQuestion(published,snapshots.get(published.sourceSnapshotId)))staged.push(published);else issues.push('Protected item publication structure failed');
   }
   outcomes.push({questionId:question.id,issues,status:issues.length?'ValidationPending':'StagedVerified'});
  }
  candidates+=candidate.questions.length;artifactCount+=artifacts.length;
 }
 const isolation=protectedIsolationIssues(staged,study.questions);if(isolation.length)throw new Error('Protected isolation check failed: '+isolation.join('; '));
 const usedSnapshots=[...snapshots.values()].filter(s=>staged.some(q=>q.sourceSnapshotId===s.id));
 const reviewMap=new Map<string,{review:CompleteExamReview;path:string}>();
 for(const entry of config.examReviews){if(!examIdPattern.test(entry.examId)||!safeDataPath(entry.reviewFile)||reviewMap.has(entry.examId))throw new Error('Invalid/duplicate full-exam review configuration');reviewMap.set(entry.examId,{review:await readJSON(entry.reviewFile),path:entry.reviewFile});}
 const definitions:ExamReadiness[]=[];const readyExams=[];const publicPackages:{path:string;text:string}[]=[];
 for(let n=1;n<=30;n++){
  const id='EXAM-'+String(n).padStart(2,'0');const questions=TOPICS.flatMap(topic=>staged.filter(q=>q.examId===id&&q.topicId===topic.id).sort((a,b)=>a.id.localeCompare(b.id)));const sources=usedSnapshots.filter(s=>questions.some(q=>q.sourceSnapshotId===s.id));const fullReview=reviewMap.get(id);
  const readiness=evaluateExamReadiness(id,questions,sources,fullReview?.review);definitions.push(readiness);
  if(readiness.ready&&fullReview){
   const definition:StrictExamDefinition={id,version:fullReview.review.version,title:'Deneme '+n,questionIds:questions.map(q=>q.id),verificationStatus:'Verified',verifiedAt:fullReview.review.checkedAt,verificationEvidence:JSON.stringify({reviewFile:fullReview.path,contentSHA256:readiness.contentSHA256,checkedBy:fullReview.review.checkedBy,fullExamDistribution:'Pass',duplicateReview:'Pass',protectedPoolIsolation:'Pass',notes:fullReview.review.notes})};
   const text=JSON.stringify({schemaVersion:1,definition,questions,snapshots:sources});const path=`content/exams/${id}.json`;publicPackages.push({path:'public/'+path,text});readyExams.push({id,examId:id,version:definition.version,title:definition.title,questionCount:100,durationMinutes:150,commonQuestions:70,technicalQuestions:30,path,sha256:hash(text)});
  }
 }
 const lastChecked=outcomes.map(row=>contextDate(row.questionId)).filter(Boolean).sort().at(-1)||null;
 function contextDate(id:string){const q=staged.find(q=>q.id===id);return q?.verificationEvidence.map(e=>e.checkedAt).sort().at(-1);}
 const stage={schemaVersion:1,contentEdition:'preparation',stageOnly:true,publicStudyUseAllowed:false,publicFlashcardUseAllowed:false,questions:staged,snapshots:usedSnapshots};
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),sourceReviewLastAt:lastChecked,plannedExamCount:30,candidates,stagedVerifiedQuestions:staged.length,pendingCandidates:candidates-staged.length,readyExamCount:readyExams.length,publishedApprovedMockQuestions:options.publishPublic?readyExams.length*100:0,sourceArtifactsChecked:artifactCount,studyBankUnchanged:true,sourcePoolIsolation:'Pass',independentFullExamReviewRequired:true,definitions,outcomes,readyExams,publicFilesWritten:Boolean(options.publishPublic)};
 // Finish immutable public-byte checks before writing any output. Repository access can
 // still expose staged source files; protection means isolation from PWA learning modes.
 if(options.publishPublic)for(const pack of publicPackages){
  let prior:string|undefined;try{prior=await readFile(output(pack.path),'utf8');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(prior!==undefined&&prior!==pack.text)throw new Error('Published exam bytes are immutable; archive prior version before replacing '+pack.path);
 }
 // The stage outside PWA assets is never counted as delivered exam content.
 await writeAtomic(output('data/approved-exam-content.json'),JSON.stringify(stage,null,2)+'\n');await writeAtomic(output('docs/protected-exam-publication-report.json'),JSON.stringify(report,null,2)+'\n');
 if(options.publishPublic){
  for(const pack of publicPackages)await writeAtomic(output(pack.path),pack.text);
  await writeAtomic(output('data/exam-manifest.json'),JSON.stringify({schemaVersion:1,plannedExamCount:30,readyExams},null,2)+'\n');
 }
 console.log(`Protected content checked: ${staged.length}/${candidates} source-verified items staged outside PWA assets; ${readyExams.length}/30 complete exams ready.`);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await publishExams(undefined,{publishPublic:process.argv.includes('--publish-public')});
