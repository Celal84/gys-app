import {it,expect} from 'vitest';
import {matchesPublishedExam,matchesPublishedStudy} from '../src/core/content-authority';
import content from '../data/approved-content.json';
import type {Question,SourceSnapshot} from '../src/core/content';
import type {AttemptQuestion} from '../src/attempt-store';
import type {StartStrictInput} from '../src/strict-store';
it('uses published source and answer bytes rather than imported verification labels',()=>{
 const q=content.questions[0] as Question,s=content.snapshots[0] as SourceSnapshot;
 const saved:AttemptQuestion={id:q.id,version:q.version,topicId:q.topicId,topic:'fixture display',weight:8,text:q.text,options:[...q.options].reverse(),correctOptionId:q.correctOptionId,explanation:q.explanation,sourceSnapshotId:s.id,sourceContentHash:s.contentHash,sourceUrl:s.sourceUrl,sourceLocator:q.sourceLocator,legalEdition:s.legalEdition,learningObjectiveId:q.learningObjectiveId};
 expect(matchesPublishedStudy(saved,q,s)).toBe(true);
 expect(matchesPublishedStudy({...saved,text:'Forged'},q,s)).toBe(false);
 expect(matchesPublishedStudy({...saved,learningObjectiveId:'fake-target'},q,s)).toBe(false);
 expect(matchesPublishedStudy({...saved,sourceContentHash:'f'.repeat(64)},q,s)).toBe(false);
});
it('does not accept an imported protected exam after a key or source edition is changed',()=>{
 const pack={definition:{id:'fixture',version:1,title:'fixture',questionIds:[],verificationStatus:'Verified',verifiedAt:'2026-11-06T00:00:00Z',verificationEvidence:'fixture'},questions:[content.questions[0]],snapshots:content.snapshots} as StartStrictInput;
 expect(matchesPublishedExam(structuredClone(pack),pack)).toBe(true);
 const fake=structuredClone(pack);fake.questions[0].correctOptionId='forged';expect(matchesPublishedExam(fake,pack)).toBe(false);
});
