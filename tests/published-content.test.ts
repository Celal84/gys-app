import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import content from '../data/approved-content.json';
import candidates from '../data/content-candidates/657-starter.json';
import reviews from '../data/reviews/657-starter-review.json';
import sourceAudit from '../data/public-legal-sources/657-source-audit.json';
import manifest from '../data/content-manifest.json';
import { canPublishQuestion, type Question, type SourceSnapshot } from '../src/core/content';
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
it('the real package contains only separately reviewed, rule-checked questions within O02 bounds',()=>{
 expect(content.questions.length).toBeGreaterThan(0);
 for(const raw of content.questions){
  const question=raw as unknown as Question;const snapshot=content.snapshots.find(s=>s.id===question.sourceSnapshotId) as SourceSnapshot;
  expect(canPublishQuestion(question,snapshot)).toBe(true);expect(question.sourcePool).toBe('B');expect(question.articleNumber).toBeLessThanOrEqual(212);
  const candidate=candidates.questions.find(q=>q.id===question.id)!;const review=reviews.reviews.find(r=>r.questionId===question.id)!;
  expect(review.candidateSha256).toBe(hash(JSON.stringify(candidate)));expect(review.decision).toBe('Pass');
  expect(question.verificationEvidence.map(e=>e.method)).toContain('rule-check');expect(question.verificationEvidence.map(e=>e.method)).toContain('official-provision-comparison');
  expect(snapshot.legalEdition).toBe('preparation');
 }
});
it('the inline-footnote source clause remains supported without dropping the statutory footnote',()=>{
 const question=content.questions.find(q=>q.id==='Q-O02-B-0015');expect(question).toBeDefined();
 expect(question!.expectedFacts.sourceQuote).toContain('[187]');
});
it('published topic chunk bytes match the small manifest and keep the full bank out of startup JS',async()=>{
 expect(manifest.totalApproved).toBe(content.questions.length);
 for(const topic of manifest.topics){const bytes=await readFile('public/'+topic.path);expect(hash(bytes)).toBe(topic.sha256);expect(JSON.parse(bytes.toString()).questions).toHaveLength(topic.count);}
 for(const artifact of sourceAudit.artifacts)expect(hash(await readFile(artifact.path))).toBe(artifact.sha256);
});
