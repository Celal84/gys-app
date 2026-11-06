import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { validateCandidate, type Candidate } from '../scripts/publish-content';
import config from '../data/publication-batches.json';
import candidate from '../data/content-candidates/o02-bank-extension.json';
import source from '../data/public-legal-sources/657-extension-provisions.json';
import sourceAudit from '../data/public-legal-sources/657-extension-source-audit.json';
import objectives from '../data/public-legal-sources/657-extension-objectives.json';
import review from '../data/reviews/o02-bank-extension-review.json';
import rules from '../data/content-candidates/o02-bank-extension-rules.json';
const question=candidate.questions[0] as unknown as Candidate;
const artifact=sourceAudit.artifacts.find(a=>a.articleNumber===question.articleNumber)!;
const sourceTexts=JSON.parse(execFileSync('python3',['scripts/extract_official_html.py',artifact.path],{encoding:'utf8'}));
const context={config:config.batches[1] as unknown as Parameters<typeof validateCandidate>[1]['config'],source,artifacts:[artifact],sourceTexts,objectives:objectives.objectives,reviews:review.reviews,rules:rules.rules,reviewFileUnchanged:true,rulesFileUnchanged:true};
it('keeps the actual separately reviewed extension candidate publishable',()=>{
 expect(validateCandidate(question,context)).toEqual([]);
});
it('blocks answer edits, forged source quotations, self review and file changes after review',()=>{
 const changed=structuredClone(question);changed.correctOptionId=question.options.find(o=>o.id!==question.correctOptionId)!.id;
 expect(validateCandidate(changed,context)).toContain('Candidate changed after independent review');
 const forged=structuredClone(question);forged.expectedFacts.sourceQuote='This is not an official provision.';
 expect(validateCandidate(forged,context)).toContain('Official quotation proof failed');
 expect(validateCandidate(question,{...context,reviews:[{...review.reviews[0],checkedBy:question.generatedBy}]})).toContain('Independent reviewer identity missing');
 expect(validateCandidate(question,{...context,reviewFileUnchanged:false})).toContain('Batch bytes changed after independent review');
 expect(validateCandidate(question,{...context,rulesFileUnchanged:false})).toContain('Batch bytes changed after independent review');
});
it('blocks explicit-scope violations, protected exam leakage and independently stored rule mismatch',()=>{
 expect(validateCandidate({...question,articleNumber:213},context)).toContain('Outside explicit article boundary');
 expect(validateCandidate({...question,sourcePool:'A',examId:'EXAM-01'},context)).toContain('Batch topic/pool mismatch');
 expect(validateCandidate(question,{...context,rules:[{...rules.rules[0],correctOptionId:'forged-answer'}]})).toContain('Separate rule file differs from candidate fact');
});

it('does not treat a generator scope assertion as independent scope approval',()=>{
 const assertion={...question,topicId:'T01' as const,scopeMapping:{status:'Approved' as const,evidenceLocator:'Generator assertion'}};
 expect(validateCandidate(assertion,{...context,config:{...context.config,topicId:'T01'}})).toContain('Scope mapping is not approved');
 const wrongScope={...review.reviews[0],scopeMapping:{status:'Approved' as const,articleNumber:999,legalProvisionId:question.legalProvisionId,learningObjectiveId:question.learningObjectiveId,evidenceLocator:'Different article'}};
 expect(validateCandidate(assertion,{...context,config:{...context.config,topicId:'T01'},reviews:[wrongScope]})).toContain('Scope mapping is not approved');
});
