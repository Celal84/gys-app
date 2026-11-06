import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { canPublishQuestion, publicationIssues, type Question, type SourceSnapshot } from '../src/core/content';

const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const norm=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').trim();
const readJSON=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
interface Fact {ruleId:string;sourceSnapshotId:string;sourceContentHash:string;sourceQuote:string;sourceQuoteSHA256:string;sourceLocator:string;requiredSourceFragments:string[];correctOptionId:string;normalizedCorrectText:string;distractorOptionIds:string[];preparationOnly:boolean}
interface Candidate extends Question {expectedFacts:Fact;distractorExplanations:{optionId:string;explanation:string;conceptId:string}[]}
interface Review {questionId:string;candidateSha256:string;decision:string;checkedBy:string;checkedAt:string;sourceQuote:string;sourceLocator:string;notes:unknown}
const candidate=await readJSON('data/content-candidates/657-starter.json') as {batch:{id:string};questions:Candidate[];snapshots:SourceSnapshot[]};
const source=await readJSON('data/public-legal-sources/657-provisions.json') as {snapshot:{sourceSnapshotId:string;rawResponseSHA256:string};provisions:{legalProvisionId:string;articleNumber:number;examScope:boolean;text:string;paragraphs:{text:string;htmlParagraphIndex:number}[]}[]};
const review=await readJSON('data/reviews/657-starter-review.json') as {reviews:Review[]};
const catalog=await readJSON('data/curriculum-map.json') as {learningObjectives:{id:string;topicId:string;legalReference:{article:number}|null}[]};
const sourceAudit=await readJSON('data/public-legal-sources/657-source-audit.json');
if(hash(await readFile('data/public-legal-sources/657-provisions.json'))!==sourceAudit.publicProvisionFileSHA256)throw new Error('Official provision file changed after extraction audit');
// Source artifact verification is a required precondition, not merely an approval string.
const artifacts=(sourceAudit.artifacts || sourceAudit.records) as {path:string;sha256:string}[]|undefined;
if(!Array.isArray(artifacts)||!artifacts.length)throw new Error('Reproducible official source artifacts missing');
for(const artifact of artifacts){if(!artifact.path.startsWith('data/public-legal-sources/'))throw new Error('Unsafe artifact path');if(hash(await readFile(artifact.path))!==artifact.sha256)throw new Error(`Official artifact changed: ${artifact.path}`);}
const sourceTexts:Record<string,string>=JSON.parse(execFileSync('python3',['scripts/extract_official_html.py',...artifacts.map(a=>a.path)],{encoding:'utf8'}));
const verifiedSnapshots=candidate.snapshots.map(snapshot=>{
 if(snapshot.id!==source.snapshot.sourceSnapshotId||snapshot.contentHash!==source.snapshot.rawResponseSHA256||snapshot.legalEdition!=='preparation')throw new Error('Official preparation snapshot mismatch');
 return {...snapshot,verificationStatus:'Verified' as const};
});
const approved:Question[]=[];const outcomes:unknown[]=[];const now=new Date().toISOString();
for(const question of candidate.questions){
 const issues:string[]=[];const fact=question.expectedFacts;const checked=review.reviews.find(r=>r.questionId===question.id);
 const provision=source.provisions.find(p=>p.legalProvisionId===question.legalProvisionId);
 const artifact=(sourceAudit.artifacts as {articleNumber:number;path:string}[]).find(a=>a.articleNumber===question.articleNumber);
 if(!artifact||!norm(sourceTexts[artifact.path]).includes(norm(fact.sourceQuote)))issues.push('Source quote absent from immutable official HTML bytes');
 if(question.sourcePool!=='B'||question.topicId!=='O02')issues.push('Starter package is only O02 bank B');
 if(!checked||checked.decision!=='Pass')issues.push('Independent review is not Pass');
 if(checked?.candidateSha256!==hash(JSON.stringify(question)))issues.push('Candidate changed after independent review');
 if(!checked?.checkedBy||checked.checkedBy===question.generatedBy)issues.push('Independent reviewer identity missing');
 if(!provision?.examScope||provision.articleNumber!==question.articleNumber||question.articleNumber!<1||question.articleNumber!>212)issues.push('Out of explicit source/syllabus scope');
 if(!provision||!norm(provision.text).includes(norm(fact.sourceQuote))||hash(fact.sourceQuote)!==fact.sourceQuoteSHA256)issues.push('Official quotation proof failed');
 if(checked&&(!provision||!norm(provision.text).includes(norm(checked.sourceQuote))))issues.push('Reviewer quotation is not in official source');
 if(!fact.requiredSourceFragments.every(fragment=>norm(fact.sourceQuote).includes(norm(fragment))))issues.push('Required legal fact absent');
 if(fact.sourceSnapshotId!==question.sourceSnapshotId||fact.sourceContentHash!==source.snapshot.rawResponseSHA256||fact.sourceLocator!==question.sourceLocator||fact.correctOptionId!==question.correctOptionId||!fact.preparationOnly)issues.push('Source/rule identity mismatch');
 const correct=question.options.find(o=>o.id===question.correctOptionId);
 if(!correct||norm(correct.text).toLocaleLowerCase('tr')!==fact.normalizedCorrectText)issues.push('Stable answer/expected fact mismatch');
 if(fact.distractorOptionIds.length!==4||new Set(fact.distractorOptionIds).size!==4||question.options.some(o=>o.id!==question.correctOptionId&&!fact.distractorOptionIds.includes(o.id)))issues.push('Distractor coverage incomplete');
 if(question.distractorExplanations.length!==4||fact.distractorOptionIds.some(id=>!question.distractorExplanations.some(d=>d.optionId===id&&d.explanation&&d.conceptId)))issues.push('Distractor explanation missing');
 const objective=catalog.learningObjectives.find(o=>o.id===question.learningObjectiveId);
 if(!objective||objective.topicId!==question.topicId||objective.legalReference?.article!==question.articleNumber)issues.push('Source-linked objective missing');
 if(!issues.length&&checked){
  const published={...question,verificationStatus:'Approved' as const,verificationEvidence:[
   {id:`${fact.ruleId}-checked`,method:'rule-check' as const,checkedBy:'official-quote-rule-check-v1',checkedAt:now,sourceSnapshotId:question.sourceSnapshotId,sourceContentHash:fact.sourceContentHash,sourceLocator:question.sourceLocator,correctOptionId:question.correctOptionId,conclusion:'pass' as const,evidence:`Exact official quotation SHA256 ${fact.sourceQuoteSHA256}; source fragments, stable answer, four distractor IDs and objective/article link checked by scripts/publish-content.ts. This rule alone is not legal approval.`},
   {id:`REVIEW-${question.id}`,method:'official-provision-comparison' as const,checkedBy:checked.checkedBy,checkedAt:checked.checkedAt,sourceSnapshotId:question.sourceSnapshotId,sourceContentHash:fact.sourceContentHash,sourceLocator:question.sourceLocator,correctOptionId:question.correctOptionId,conclusion:'pass' as const,evidence:JSON.stringify({candidateSha256:checked.candidateSha256,sourceQuote:checked.sourceQuote,notes:checked.notes,reviewFile:'data/reviews/657-starter-review.json'})}
  ]};
  const snapshot=verifiedSnapshots.find(s=>s.id===published.sourceSnapshotId);
  if(canPublishQuestion(published,snapshot))approved.push(published);else issues.push(...publicationIssues(published,snapshot));
 }
 outcomes.push({questionId:question.id,decision:issues.length?'ValidationPending':'Approved',issues});
}
// Structural objective/cognitive duplicate checks are an additional barrier; semantic review is separate.
if(new Set(approved.map(q=>norm(q.text).toLocaleLowerCase('tr'))).size!==approved.length)throw new Error('Duplicate approved text');
if(new Set(approved.map(q=>q.learningObjectiveId+':'+q.cognitiveType)).size!==approved.length)throw new Error('Duplicate objective/cognitive operation');
await writeFile('data/approved-content.json',JSON.stringify({questions:approved,snapshots:approved.length?verifiedSnapshots:[]},null,2)+'\n');
const topics=[];
await mkdir('public/content',{recursive:true});
for(const topicId of [...new Set(approved.map(q=>q.topicId))]){
 const questions=approved.filter(q=>q.topicId===topicId);
 const text=JSON.stringify({schemaVersion:1,questions,snapshots:verifiedSnapshots});
 const path=`content/${topicId}.json`;await writeFile(`public/${path}`,text);
 topics.push({topicId,count:questions.length,questionIds:questions.map(q=>q.id),path,sha256:hash(text)});
}
await writeFile('data/content-manifest.json',JSON.stringify({schemaVersion:1,contentEdition:'preparation',totalApproved:approved.length,topics},null,2)+'\n');
await writeFile('docs/content-publication-report.json',JSON.stringify({schemaVersion:1,batchId:candidate.batch.id,checkedAt:now,generated:candidate.questions.length,approved:approved.length,pending:candidate.questions.length-approved.length,sourceArtifactsChecked:artifacts.length,independentReview:true,outcomes},null,2)+'\n');
console.log(`Content checked: ${approved.length}/${candidate.questions.length} Approved; ${artifacts.length} source artifacts hashed.`);
