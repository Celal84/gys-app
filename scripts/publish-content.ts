import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { canPublishQuestion, publicationIssues, type Question, type SourceSnapshot } from '../src/core/content';
import { TOPICS } from '../src/core/curriculum';

const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const norm=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').trim();
const readJSON=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
export interface Fact {ruleId:string;sourceSnapshotId:string;sourceContentHash:string;sourceQuote:string;sourceQuoteSHA256:string;sourceLocator:string;requiredSourceFragments:string[];correctOptionId:string;normalizedCorrectText:string;distractorOptionIds:string[];preparationOnly:boolean;contextLegalProvisionIds?:string[];contextSourceEvidence?:{legalProvisionId:string;sourceQuote:string;sourceQuoteSHA256:string;sourceLocator:string}[]}
export interface Candidate extends Question {expectedFacts:Fact;distractorExplanations:{optionId:string;explanation:string;conceptId:string}[]}
export interface ReviewedScope {status:'Approved';articleNumber:number;legalProvisionId:string;learningObjectiveId:string;evidenceLocator:string}
export interface Review {scopeMapping?:ReviewedScope;questionId:string;candidateSha256:string;decision:string;checkedBy:string;checkedAt:string;sourceQuote:string;sourceLocator:string;notes:unknown}
export interface Objective {id:string;topicId:string;legalReference?:{article:number}|null;articleNumber?:number;legalProvisionId?:string;sourceSnapshotId?:string}
export interface Provision {legalProvisionId:string;articleNumber:number;examScope:boolean|null;text:string}
export interface Artifact {path:string;sha256:string;articleNumber?:number;legalProvisionId?:string}
export interface BatchConfig {candidateFile:string;rulesFile:string;sourceFile:string;auditFile:string;reviewFile:string;objectiveFile?:string;topicId:string;sourcePool:'A'|'B'}
export interface BatchContext {config:BatchConfig;source:{snapshot:{sourceSnapshotId:string;rawResponseSHA256:string;decodedHTMLSHA256?:string};provisions:Provision[]};artifacts:Artifact[];sourceTexts:Record<string,string>;objectives:Objective[];reviews:Review[];rules:(Fact&{questionId:string;learningObjectiveId:string;articleNumber:number})[];reviewFileUnchanged:boolean;rulesFileUnchanged:boolean}

function reviewedScope(question:Candidate,review?:Review){
 const scope=review?.scopeMapping;
 return review?.decision==='Pass'&&scope?.status==='Approved'&&scope.articleNumber===question.articleNumber&&scope.legalProvisionId===question.legalProvisionId&&scope.learningObjectiveId===question.learningObjectiveId&&typeof scope.evidenceLocator==='string'&&scope.evidenceLocator.trim().length>0?scope:undefined;
}

/** Pure fail-closed checks shared by publication and tamper regression tests. */
export function validateCandidate(question:Candidate, context:BatchContext):string[]{
 const {config,source,artifacts,sourceTexts,objectives,reviews,rules}=context;
 const issues:string[]=[];const fact=question.expectedFacts;const checked=reviews.find(r=>r.questionId===question.id);
 if(!fact)return ['Expected source fact missing'];
 const provision=source.provisions.find(p=>p.legalProvisionId===question.legalProvisionId);
 const matchingArtifacts=artifacts.filter(a=>(a.legalProvisionId===question.legalProvisionId)||(a.articleNumber===question.articleNumber)||(!a.legalProvisionId&&a.articleNumber===undefined));
 if(!matchingArtifacts.some(a=>norm(sourceTexts[a.path]||'').includes(norm(fact.sourceQuote))))issues.push('Source quote absent from immutable official HTML bytes');
 if(question.sourcePool!==config.sourcePool||question.topicId!==config.topicId)issues.push('Batch topic/pool mismatch');
 if(!context.reviewFileUnchanged||!context.rulesFileUnchanged)issues.push('Batch bytes changed after independent review');
 if(!checked||checked.decision!=='Pass')issues.push('Independent review is not Pass');
 if(checked?.candidateSha256!==hash(JSON.stringify(question)))issues.push('Candidate changed after independent review');
 if(!checked?.checkedBy||checked.checkedBy===question.generatedBy)issues.push('Independent reviewer identity missing');
 const approvedScope=reviewedScope(question,checked);
 if((!provision?.examScope&&!approvedScope)||provision?.articleNumber!==question.articleNumber)issues.push('Out of explicit source/syllabus scope');
 const topic=TOPICS.find(t=>t.id===question.topicId);
 if(!topic)issues.push('Unknown topic');
 if(topic?.scope.status==='bounded'&&(!Number.isInteger(question.articleNumber)||question.articleNumber!<topic.scope.articles![0]||question.articleNumber!>topic.scope.articles![1]))issues.push('Outside explicit article boundary');
 // Additional topics remain blocked until their own explicit mapping is approved; a whole law is never inferred in scope.
 if(topic?.scope.status!=='bounded'&&!approvedScope)issues.push('Scope mapping is not approved');
 if(!provision||!norm(provision.text).includes(norm(fact.sourceQuote))||hash(fact.sourceQuote)!==fact.sourceQuoteSHA256)issues.push('Official quotation proof failed');
 if(checked&&(!provision||!norm(provision.text).includes(norm(checked.sourceQuote))||checked.sourceLocator!==question.sourceLocator))issues.push('Reviewer quotation/locator is not in official source');
 for(const id of fact.contextLegalProvisionIds||[])if(!source.provisions.some(p=>p.legalProvisionId===id))issues.push('Context legal provision missing');
 for(const contextFact of fact.contextSourceEvidence||[]){
  const contextProvision=source.provisions.find(p=>p.legalProvisionId===contextFact.legalProvisionId);
  const contextArtifacts=artifacts.filter(a=>a.legalProvisionId===contextFact.legalProvisionId||a.articleNumber===contextProvision?.articleNumber||(!a.legalProvisionId&&a.articleNumber===undefined));
  if(!contextProvision||!contextFact.sourceLocator||hash(contextFact.sourceQuote)!==contextFact.sourceQuoteSHA256||!norm(contextProvision.text).includes(norm(contextFact.sourceQuote))||!contextArtifacts.some(a=>norm(sourceTexts[a.path]||'').includes(norm(contextFact.sourceQuote))))issues.push('Context quotation proof failed');
 }
 if(!Array.isArray(fact.requiredSourceFragments)||!fact.requiredSourceFragments.length||!fact.requiredSourceFragments.every(fragment=>norm(fact.sourceQuote).includes(norm(fragment))))issues.push('Required legal fact absent');
 if(fact.sourceSnapshotId!==question.sourceSnapshotId||fact.sourceContentHash!==source.snapshot.rawResponseSHA256||fact.sourceLocator!==question.sourceLocator||fact.correctOptionId!==question.correctOptionId||!fact.preparationOnly)issues.push('Source/rule identity mismatch');
 const rule=rules.find(r=>r.questionId===question.id);
 if(!rule||rule.learningObjectiveId!==question.learningObjectiveId||rule.articleNumber!==question.articleNumber||Object.entries(fact).some(([key,value])=>JSON.stringify(rule[key as keyof typeof rule])!==JSON.stringify(value)))issues.push('Separate rule file differs from candidate fact');
 const correct=question.options.find(o=>o.id===question.correctOptionId);
 if(!correct||norm(correct.text).toLocaleLowerCase('tr')!==fact.normalizedCorrectText)issues.push('Stable answer/expected fact mismatch');
 if(fact.distractorOptionIds.length!==4||new Set(fact.distractorOptionIds).size!==4||question.options.some(o=>o.id!==question.correctOptionId&&!fact.distractorOptionIds.includes(o.id)))issues.push('Distractor coverage incomplete');
 if(question.distractorExplanations.length!==4||fact.distractorOptionIds.some(id=>!question.distractorExplanations.some(d=>d.optionId===id&&d.explanation&&d.conceptId)))issues.push('Distractor explanation missing');
 const objective=objectives.find(o=>o.id===question.learningObjectiveId);
 if(!objective||objective.topicId!==question.topicId||(objective.legalReference?.article??objective.articleNumber)!==question.articleNumber||(objective.legalProvisionId&&objective.legalProvisionId!==question.legalProvisionId)||(objective.sourceSnapshotId&&objective.sourceSnapshotId!==question.sourceSnapshotId))issues.push('Source-linked objective missing');
 return issues;
}

export async function publishContent(configFile='data/publication-batches.json'){
 const config=await readJSON(configFile) as {schemaVersion:number;batches:BatchConfig[]};
 if(config.schemaVersion!==1||!Array.isArray(config.batches)||!config.batches.length)throw new Error('Publication batch configuration missing');
 const catalog=await readJSON('data/curriculum-map.json') as {learningObjectives:Objective[]};
 const registry=await readJSON('data/official-source-registry.json') as {entries:{topicId:string;officialDocumentId?:string;rawResponseSHA256?:string;identity?:{officialDocumentId:string};snapshot?:{rawResponseSHA256:string}}[]};
 const approved:Question[]=[];const snapshotMap=new Map<string,SourceSnapshot>();const batchReports:unknown[]=[];const outcomes:unknown[]=[];const now=new Date().toISOString();let generated=0;let sourceArtifactsChecked=0;
 for(const batch of config.batches){
  if(batch.sourcePool!=='B')throw new Error('Study publisher accepts bank B only; protected exams use a separate complete-exam publication gate');
  const [candidate,source,review,rules,sourceAudit,objectiveData]=await Promise.all([
   readJSON(batch.candidateFile),readJSON(batch.sourceFile),readJSON(batch.reviewFile),readJSON(batch.rulesFile),readJSON(batch.auditFile),batch.objectiveFile?readJSON(batch.objectiveFile):Promise.resolve(null)
  ]);
  if(hash(await readFile(batch.sourceFile))!==sourceAudit.publicProvisionFileSHA256)throw new Error(`Official provision file changed after extraction audit: ${batch.sourceFile}`);
  const artifacts=(sourceAudit.artifacts||sourceAudit.records) as Artifact[]|undefined;
  if(!Array.isArray(artifacts)||!artifacts.length)throw new Error('Reproducible official source artifacts missing');
  await Promise.all(artifacts.map(async artifact=>{
   if(!artifact.path.startsWith('data/public-legal-sources/snapshots/')||artifact.path.includes('..'))throw new Error('Unsafe artifact path');
   if(hash(await readFile(artifact.path))!==artifact.sha256)throw new Error(`Official artifact changed: ${artifact.path}`);
  }));
  const sourceTexts:Record<string,string>=JSON.parse(execFileSync('python3',['scripts/extract_official_html.py',...artifacts.map(a=>a.path)],{encoding:'utf8',maxBuffer:16*1024*1024}));
  const verifiedSnapshots=(candidate.snapshots as SourceSnapshot[]).map(snapshot=>{
   if(snapshot.id!==source.snapshot.sourceSnapshotId||snapshot.contentHash!==source.snapshot.rawResponseSHA256||snapshot.legalEdition!=='preparation')throw new Error('Official preparation snapshot mismatch');
   return {...snapshot,decodedContentHash:source.snapshot.decodedHTMLSHA256||sourceAudit.decodedFullHTMLSHA256,verificationStatus:'Verified' as const};
  });
  for(const snapshot of verifiedSnapshots){
   const official=registry.entries.find(entry=>entry.topicId===batch.topicId);
   const officialId=official?.identity?.officialDocumentId||official?.officialDocumentId;
   const officialHash=official?.snapshot?.rawResponseSHA256||official?.rawResponseSHA256;
   if(!officialId||snapshot.sourceUrl!==`https://mevzuat.adalet.gov.tr/mevzuat/${officialId}`||snapshot.contentHash!==officialHash)throw new Error('Source does not match the exact official topic identity and registered preparation snapshot');
   const previous=snapshotMap.get(snapshot.id);
   // One legal snapshot can have several independently archived selected-article batches.
   if(previous&&['sourceId','sourceUrl','contentHash','version','legalEdition'].some(key=>previous[key as keyof SourceSnapshot]!==snapshot[key as keyof SourceSnapshot]))throw new Error('Conflicting immutable snapshot identity');
   if(!previous)snapshotMap.set(snapshot.id,snapshot);
  }
  const context:BatchContext={config:batch,source,artifacts,sourceTexts,objectives:[...catalog.learningObjectives,...(objectiveData?.objectives||objectiveData?.learningObjectives||[])],reviews:review.reviews,rules:rules.rules,
   reviewFileUnchanged:review.candidateFileSHA256===hash(await readFile(batch.candidateFile)),
   rulesFileUnchanged:!review.rulesFileSHA256||review.rulesFileSHA256===hash(await readFile(batch.rulesFile))};
  let batchApproved=0;
  for(const question of candidate.questions as Candidate[]){
   const issues=validateCandidate(question,context);const fact=question.expectedFacts;const checked=context.reviews.find(r=>r.questionId===question.id);
   if(!issues.length&&checked){
    const scope=reviewedScope(question,checked);
    const published={...question,...(scope?{scopeMapping:{status:'Approved' as const,evidenceLocator:scope.evidenceLocator}}:{}),verificationStatus:'Approved' as const,verificationEvidence:[
     {id:`${fact.ruleId}-checked`,method:'rule-check' as const,checkedBy:'official-quote-rule-check-v1',checkedAt:checked.checkedAt,sourceSnapshotId:question.sourceSnapshotId,sourceContentHash:fact.sourceContentHash,sourceLocator:question.sourceLocator,correctOptionId:question.correctOptionId,conclusion:'pass' as const,evidence:`Exact official quotation SHA256 ${fact.sourceQuoteSHA256}; immutable HTML, rule file, stable answer, four distractor IDs and objective/article link checked. This rule alone is not legal approval.`},
     {id:`REVIEW-${question.id}`,method:'official-provision-comparison' as const,checkedBy:checked.checkedBy,checkedAt:checked.checkedAt,sourceSnapshotId:question.sourceSnapshotId,sourceContentHash:fact.sourceContentHash,sourceLocator:question.sourceLocator,correctOptionId:question.correctOptionId,conclusion:'pass' as const,evidence:JSON.stringify({candidateSha256:checked.candidateSha256,sourceQuote:checked.sourceQuote,notes:checked.notes,reviewFile:batch.reviewFile})}
    ]};
    const snapshot=snapshotMap.get(published.sourceSnapshotId);
    if(canPublishQuestion(published,snapshot)){approved.push(published);batchApproved++;}else issues.push(...publicationIssues(published,snapshot));
   }
   outcomes.push({batchId:candidate.batch.id,questionId:question.id,decision:issues.length?'ValidationPending':'Approved',issues});
  }
  generated+=candidate.questions.length;sourceArtifactsChecked+=artifacts.length;
  batchReports.push({batchId:candidate.batch.id,topicId:batch.topicId,generated:candidate.questions.length,approved:batchApproved,pending:candidate.questions.length-batchApproved,sourceArtifactsChecked:artifacts.length,reviewFile:batch.reviewFile});
 }
 if(new Set(approved.map(q=>q.id)).size!==approved.length)throw new Error('Duplicate approved question identity');
 if(new Set(approved.map(q=>norm(q.text).toLocaleLowerCase('tr'))).size!==approved.length)throw new Error('Duplicate approved text');
 if(new Set(approved.map(q=>q.learningObjectiveId+':'+q.cognitiveType)).size!==approved.length)throw new Error('Duplicate objective/cognitive operation');
 for(const topic of TOPICS)if(approved.filter(q=>q.topicId===topic.id).length>100)throw new Error(`Bank quota exceeded: ${topic.id}`);
 const verifiedSnapshots=[...snapshotMap.values()].filter(s=>approved.some(q=>q.sourceSnapshotId===s.id));
 await writeFile('data/approved-content.json',JSON.stringify({questions:approved,snapshots:verifiedSnapshots},null,2)+'\n');
 const topics=[];await mkdir('public/content',{recursive:true});
 for(const topicId of [...new Set(approved.map(q=>q.topicId))]){
  const questions=approved.filter(q=>q.topicId===topicId);const snapshots=verifiedSnapshots.filter(s=>questions.some(q=>q.sourceSnapshotId===s.id));
  const text=JSON.stringify({schemaVersion:1,questions,snapshots});const path=`content/${topicId}.json`;await writeFile(`public/${path}`,text);
  topics.push({topicId,count:questions.length,questionIds:questions.map(q=>q.id),sourceSnapshots:snapshots.map(s=>({...s,count:questions.filter(q=>q.sourceSnapshotId===s.id).length})),path,sha256:hash(text)});
 }
 await writeFile('data/content-manifest.json',JSON.stringify({schemaVersion:1,contentEdition:'preparation',totalApproved:approved.length,topics},null,2)+'\n');
 const candidateInventory=new Map<string,{question:Candidate;file:string;fileSha256:string}>();
 const duplicateCandidateIds:string[]=[];
 for(const name of (await readdir('data/content-candidates')).sort()){
  if(!name.endsWith('.json'))continue;
  const path=`data/content-candidates/${name}`;const bytes=await readFile(path);const draft=JSON.parse(bytes.toString('utf8'));
  if(!draft.batch||!Array.isArray(draft.questions))continue;
  for(const q of draft.questions as Candidate[])if(q&&typeof q.id==='string'&&['A','B'].includes(q.sourcePool)){
   const previous=candidateInventory.get(q.id);
   if(previous&&JSON.stringify(previous.question)!==JSON.stringify(q))duplicateCandidateIds.push(q.id);
   if(!previous)candidateInventory.set(q.id,{question:q,file:path,fileSha256:hash(bytes)});
  }
 }
 const matchedIndependentReviews=new Map<string,{reviewFile:string;decision:string}>();
 for(const name of (await readdir('data/reviews')).sort()){
  if(!name.endsWith('.json'))continue;
  const reviewFile=`data/reviews/${name}`;const reviewed=await readJSON(reviewFile);
  if(!Array.isArray(reviewed.reviews))continue;
  for(const item of reviewed.reviews as Review[]){
   const candidate=candidateInventory.get(item.questionId);
   if(candidate&&reviewed.candidateFileSHA256===candidate.fileSha256&&item.candidateSha256===hash(JSON.stringify(candidate.question))&&item.checkedBy&&item.checkedBy!==candidate.question.generatedBy)matchedIndependentReviews.set(item.questionId,{reviewFile,decision:item.decision});
  }
 }
 const totalGenerated=candidateInventory.size;const publishedIds=new Set(approved.map(q=>q.id));
 const inventoryRecords=[...candidateInventory.entries()].map(([questionId,{question,file}])=>({questionId,sourcePool:question.sourcePool,topicId:question.topicId,file,
  status:publishedIds.has(questionId)?'Approved':question.verificationStatus==='Draft'?'Draft':['Rejected','Quarantined','Outdated'].includes(question.verificationStatus)?question.verificationStatus:'ValidationPending',
  independentReview:matchedIndependentReviews.get(questionId)||null,published:publishedIds.has(questionId)}));
 const unpublishedCandidates=inventoryRecords.filter(record=>!record.published);
 const reviewPassNotEnabled=unpublishedCandidates.filter(record=>record.independentReview?.decision==='Pass');
 const inventory={schemaVersion:1,checkedAt:now,originalTarget:5400,totalGenerated,approved:approved.length,approvedBank:approved.length,approvedMock:0,
  remainingToApprove:5400-approved.length,remainingToGenerate:Math.max(0,5400-totalGenerated),draft:inventoryRecords.filter(r=>r.status==='Draft').length,
  pending:inventoryRecords.filter(r=>r.status==='ValidationPending').length,rejected:inventoryRecords.filter(r=>r.status==='Rejected').length,
  quarantined:inventoryRecords.filter(r=>r.status==='Quarantined').length,outdated:inventoryRecords.filter(r=>r.status==='Outdated').length,
  historicalAccepted:0,historicalExcludedFromOriginalTarget:true,legacyUnverifiedExcludedFromOriginalTarget:true,
  duplicateCandidateIds:[...new Set(duplicateCandidateIds)],reviewPassNotEnabled,
  topics:TOPICS.map(topic=>({topicId:topic.id,targetBank:100,targetMock:topic.examWeight*30,generatedBank:inventoryRecords.filter(r=>r.topicId===topic.id&&r.sourcePool==='B').length,generatedMock:inventoryRecords.filter(r=>r.topicId===topic.id&&r.sourcePool==='A').length,approvedBank:inventoryRecords.filter(r=>r.topicId===topic.id&&r.sourcePool==='B'&&r.published).length,approvedMock:0})),records:inventoryRecords};
 await writeFile('docs/content-inventory.json',JSON.stringify(inventory,null,2)+'\n');
 await writeFile('docs/content-publication-report.json',JSON.stringify({schemaVersion:1,checkedAt:now,generated:totalGenerated,selectedCandidateCount:generated,approved:approved.length,pending:totalGenerated-approved.length,sourceArtifactsChecked,independentReview:true,batches:batchReports,outcomes,unpublishedCandidates},null,2)+'\n');
 console.log(`Content checked: ${approved.length}/${generated} Approved; ${sourceArtifactsChecked} source artifacts hashed.`);
 return {approved:approved.length,generated};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await publishContent();
