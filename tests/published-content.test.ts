import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import content from '../data/approved-content.json';
import config from '../data/publication-batches.json';
import manifest from '../data/content-manifest.json';
import { canPublishQuestion, type Question, type SourceSnapshot } from '../src/core/content';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const batches=await Promise.all(config.batches.map(async batch=>({
 candidate:JSON.parse(await readFile(batch.candidateFile,'utf8')),
 review:JSON.parse(await readFile(batch.reviewFile,'utf8')),
 audit:JSON.parse(await readFile(batch.auditFile,'utf8')),
 candidateFileHash:hash(await readFile(batch.candidateFile)),
 rulesFileHash:hash(await readFile(batch.rulesFile))
})));
it('real packages contain only separately reviewed, source-linked questions and preserve bank quotas',()=>{
 expect(content.questions.length).toBe(batches.reduce((n,batch)=>n+batch.candidate.questions.length,0));
 expect(new Set(content.questions.map(q=>q.id)).size).toBe(content.questions.length);
 for(const raw of content.questions){
  const question=raw as unknown as Question;const snapshot=content.snapshots.find(s=>s.id===question.sourceSnapshotId) as SourceSnapshot;
  expect(canPublishQuestion(question,snapshot)).toBe(true);expect(question.sourcePool).toBe('B');
  const batch=batches.find(b=>b.candidate.questions.some((q:{id:string})=>q.id===question.id))!;
  const candidate=batch.candidate.questions.find((q:{id:string})=>q.id===question.id)!;const review=batch.review.reviews.find((r:{questionId:string})=>r.questionId===question.id)!;
  expect(batch.review.candidateFileSHA256).toBe(batch.candidateFileHash);
  if(batch.review.rulesFileSHA256)expect(batch.review.rulesFileSHA256).toBe(batch.rulesFileHash);
  expect(review.candidateSha256).toBe(hash(JSON.stringify(candidate)));expect(review.decision).toBe('Pass');
  expect(question.verificationEvidence.map(e=>e.method)).toContain('rule-check');expect(question.verificationEvidence.map(e=>e.method)).toContain('official-provision-comparison');
  expect(snapshot.legalEdition).toBe('preparation');
 }
 for(const topic of manifest.topics)expect(topic.count).toBeLessThanOrEqual(100);
 expect(content.questions.filter(q=>q.topicId==='O02')).toHaveLength(100);
});
it('the inline-footnote source clause remains supported without dropping the statutory footnote',()=>{
 const question=content.questions.find(q=>q.id==='Q-O02-B-0015');expect(question).toBeDefined();
 expect(question!.expectedFacts.sourceQuote).toContain('[187]');
});
it('published topic chunk bytes match the small manifest and all source artifact hashes',async()=>{
 expect(manifest.totalApproved).toBe(content.questions.length);
 for(const topic of manifest.topics){const bytes=await readFile('public/'+topic.path);expect(hash(bytes)).toBe(topic.sha256);expect(JSON.parse(bytes.toString()).questions).toHaveLength(topic.count);}
 for(const batch of batches)for(const artifact of batch.audit.artifacts)expect(hash(await readFile(artifact.path))).toBe(artifact.sha256);
});
