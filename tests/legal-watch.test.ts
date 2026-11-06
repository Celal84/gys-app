import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assessCutoff, buildComparisonTables, buildImpact, classifySourceChange, comparisonTablesFromApprovedContent, OFFICIAL_WATCH_IDENTITIES, validateLegalWatchBatch, type ComparisonFact, type LegalDates, type LegalWatchBatch, type SourceObservation } from '../src/core/legal-watch';
import { createLegalWatchStore, fetchLegalWatchArtifact, validateLegalWatchBackup, type LegalWatchStore } from '../src/legal-watch-store';
import registry from '../data/official-source-registry.json';
import approvedContent from '../public/content/O02.json';
import sourceFacts from '../data/public-legal-sources/657-provisions.json';
import type { Question, SourceSnapshot } from '../src/core/content';

const unknownDates: LegalDates={originalPublicationDate:'1965-07-23',amendmentPublicationDate:null,effectiveFrom:null,effectiveUntil:null,transitionalProvisions:null,transitionReviewStatus:'Pending'};
const hash=(letter:string)=>letter.repeat(64);
function observation(overrides:Partial<SourceObservation>={}): SourceObservation {
  return {id:'batch:O02',sourceId:'SRC-OFFICIAL-657-UYAP',topicId:'O02',officialDocumentId:'102924',officialType:'KANUN',sourceUrl:'https://mevzuat.adalet.gov.tr/mevzuat/102924',checkedAt:'2026-11-06T12:00:01Z',result:'Verified',parseVerified:true,httpStatus:200,responseByteLength:3000,declaredMimeType:'text/html',rawResponseSHA256:hash('a'),decodedContentSHA256:hash('b'),officialContentVersion:503,baselineSnapshotId:'SRC-OFFICIAL-657-UYAP-20261106-old',baselineRawResponseSHA256:hash('a'),baselineDecodedContentSHA256:hash('b'),baselineOfficialContentVersion:503,change:'Unchanged',changedArticleNumbers:null,legalDates:{...unknownDates},error:null,...overrides};
}
function batch(id='batch',item=observation()): LegalWatchBatch {
  return {schemaVersion:1,kind:'GYSOfficialSourceCheck',id,startedAt:'2026-11-06T12:00:00Z',completedAt:'2026-11-06T12:00:02Z',requestedTopicIds:['O02'],observations:[{...item,id:`${id}:O02`}],complete:item.result==='Verified',legalEdition:'preparation',examCutoffDate:'2027-01-01',examVersionFinalized:false};
}
const changed=()=>observation({decodedContentSHA256:hash('c'),change:'ContentChanged'});
const stores:LegalWatchStore[]=[];
const store=(name=`legal-${crypto.randomUUID()}`)=>{const value=createLegalWatchStore(name);stores.push(value);return value;};
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(stores.splice(0).map(s=>s.close()));});

describe('legal source observations and explicit revalidation',()=>{
  it('pins all exact official IDs, real instrument types and source IDs to the checked registry',()=>{
    expect(Object.keys(OFFICIAL_WATCH_IDENTITIES)).toHaveLength(23);
    for (const entry of registry.entries) {
      if (entry.topicId==='O04') continue;
      const identity=OFFICIAL_WATCH_IDENTITIES[entry.topicId];
      expect(identity.documentId).toBe(entry.identity?.officialDocumentId ?? entry.officialDocumentId);
      expect(identity.type).toBe(entry.identity?.observedType ?? 'KANUN');
      if (entry.snapshot) expect(identity.sourceId).toBe(entry.snapshot.sourceSnapshotId.replace(/-\d{8}-[a-f0-9]{12}$/,''));
    }
  });
  it('keeps preparation and cutoff dates distinct from service version dates',()=>{
    expect(assessCutoff(unknownDates,'2026-11-06')).toMatchObject({phase:'Preparation',applicability:'NeedsReview',final:false});
    const dates={...unknownDates,amendmentPublicationDate:'2026-11-05',effectiveFrom:'2026-11-06',transitionReviewStatus:'VerifiedNone' as const};
    expect(assessCutoff(dates,'2026-11-06')).toMatchObject({phase:'Preparation',applicability:'CandidateAtCutoff',final:false});
    expect(assessCutoff({...dates,amendmentPublicationDate:'2027-01-02'},'2027-02-01').applicability).toBe('AfterCutoffExcluded');
    expect(assessCutoff({...dates,effectiveFrom:'2027-01-03'},'2027-02-01').applicability).toBe('NotEffectiveAtCutoff');
    expect(assessCutoff({...dates,transitionReviewStatus:'Pending'},'2027-02-01').applicability).toBe('NeedsReview');
    expect(()=>assessCutoff({...dates,effectiveFrom:'2026-02-31'},'2026-11-06')).toThrow();
  });
  it('does not confuse transport-only differences with legal content changes',()=>{
    expect(classifySourceChange(observation({rawResponseSHA256:hash('d')}))).toBe('TransportOnlyChanged');
    expect(classifySourceChange(observation({officialContentVersion:504}))).toBe('ContentChanged');
    expect(classifySourceChange(observation({decodedContentSHA256:hash('e')}))).toBe('ContentChanged');
    expect(classifySourceChange(observation({baselineDecodedContentSHA256:null}))).toBe('FirstObservation');
  });
  it('rejects HTTP-only, zero-byte, incomplete and malformed success reports',()=>{
    expect(validateLegalWatchBatch(batch())).toEqual(batch());
    for(const field of [{responseByteLength:0},{parseVerified:false},{httpStatus:403},{decodedContentSHA256:null}]) {
      expect(()=>validateLegalWatchBatch(batch('bad',observation(field)))).toThrow();
    }
    expect(()=>validateLegalWatchBatch({...batch(),requestedTopicIds:['O02','T08']})).toThrow();
    expect(()=>validateLegalWatchBatch({...batch(),complete:false})).toThrow();
    expect(()=>validateLegalWatchBatch({...batch(),examVersionFinalized:true})).toThrow();
  });
  it('maps article changes to all linked assets without changing question/result objects',()=>{
    const oldQuestion={id:'q1',verificationStatus:'Approved',version:1};const oldResult={score:85,sourceSnapshotId:'old'};
    const before=structuredClone({oldQuestion,oldResult});
    const dependency={sourceId:'SRC-OFFICIAL-657-UYAP',articleNumbers:[135],legalProvisionIds:['LP-657-135'],learningObjectiveIds:['lo135'],questionIds:['q1'],optionIds:['q1-option-a'],explanationIds:['q1-explanation'],flashcardIds:['card1'],comparisonRowIds:['remedy1']};
    expect(buildImpact({...changed(),changedArticleNumbers:[135]},[dependency])?.affected).toMatchObject({questionIds:['q1'],optionIds:['q1-option-a'],flashcardIds:['card1'],comparisonRowIds:['remedy1'],learningObjectiveIds:['lo135']});
    expect(buildImpact({...changed(),changedArticleNumbers:[102]},[dependency])?.affected.questionIds).toEqual([]);
    expect(buildImpact(changed(),[dependency])).toMatchObject({requiresWholeSourceReview:true,status:'ValidationPending',runtimeContentStatus:'Outdated',publicationApplied:false});
    expect(buildImpact(observation({change:'TransportOnlyChanged',rawResponseSHA256:hash('c')}),[dependency])).toBeNull();
    expect({oldQuestion,oldResult}).toEqual(before);
  });
  it('builds four tables from explicit approved facts and keeps no-current-answer historical rows',()=>{
    const base:ComparisonFact={id:'duration1',kind:'durations',topicId:'O02',title:'Synthetic test',value:'Quoted duration',startingEvent:'Quoted start',legalProvisionId:'LP-test',sourceSnapshotId:'snapshot-test',sourceUrl:'https://mevzuat.adalet.gov.tr/mevzuat/102924',sourceLocator:'test article',quote:'Synthetic test quote',verificationStatus:'Approved',origin:'VerifiedSourceFact'};
    const facts=[base,{...base,id:'authority',kind:'authorities' as const},{...base,id:'remedy',kind:'remedies' as const},{...base,id:'history',kind:'historical' as const,historicalValue:'Historical quote',currentValue:null,currentOptionsHaveAnswer:false},{...base,id:'unverified',verificationStatus:'Pending' as const}];
    const tables=buildComparisonTables(facts);
    expect(Object.values(tables).map(v=>v.length)).toEqual([1,1,1,1]);
    expect(tables.historical[0].currentOptionsHaveAnswer).toBe(false);
    expect(()=>buildComparisonTables([{...base,sourceLocator:''}])).toThrow();
    expect(()=>buildComparisonTables([{...base,startingEvent:undefined}])).toThrow();
  });
  it('grounds useful preparation comparisons in exact approved 657 source paragraphs without protected exam leaks',()=>{
    const questions=approvedContent.questions as Question[];const snapshots=approvedContent.snapshots as SourceSnapshot[];
    const tables=comparisonTablesFromApprovedContent(questions,snapshots,sourceFacts.provisions);
    expect(tables.durations).toHaveLength(1);expect(tables.authorities).toHaveLength(2);expect(tables.remedies).toHaveLength(2);expect(tables.historical).toEqual([]);
    for (const fact of Object.values(tables).flat()) {
      const provision=sourceFacts.provisions.find(p=>p.legalProvisionId===fact.legalProvisionId)!;
      expect(provision.text).toContain(fact.quote);expect(fact.value).toBe(fact.quote);
    }
    expect(comparisonTablesFromApprovedContent(questions.map(q=>({...q,sourcePool:'A',examId:'protected'})),snapshots,sourceFacts.provisions).durations).toEqual([]);
    expect(comparisonTablesFromApprovedContent(questions,snapshots,sourceFacts.provisions.map(p=>({...p,verificationStatus:'Pending'}))).durations).toEqual([]);
  });
});

describe('append-only IndexedDB legal watcher',()=>{
  it('persists observations across connections and preserves last success after offline failure',async()=>{
    const name=`watch-${crypto.randomUUID()}`;const first=store(name);
    expect((await first.getStatus()).lastSuccessfulCheck).toBeNull();
    await first.importObservation(batch());
    await first.close();const reopened=store(name);
    const failure=batch('offline',observation({result:'Failed',parseVerified:false,httpStatus:null,responseByteLength:0,rawResponseSHA256:null,decodedContentSHA256:null,officialContentVersion:null,change:'Failed',error:'Network unavailable',checkedAt:'2026-11-07T12:00:01Z'}));
    failure.startedAt='2026-11-07T12:00:00Z';failure.completedAt='2026-11-07T12:00:02Z';
    await reopened.importObservation(failure);
    expect(await reopened.getStatus()).toMatchObject({lastSuccessfulCheck:'2026-11-06T12:00:02Z',lastAttemptAt:'2026-11-07T12:00:02Z',lastAttemptComplete:false,failedSources:1,continuouslyRunningInBackground:false});
  });
  it('adds immutable impact queue entries, handles repeat import and rejects same-ID overwrites atomically',async()=>{
    const db=store();const input=batch('changed',changed());
    const dependencies=[{sourceId:'SRC-OFFICIAL-657-UYAP',questionIds:['q1'],optionIds:['q1-b'],learningObjectiveIds:['lo1']}];
    await db.importObservation(input,dependencies);
    expect(await db.importObservation(input,dependencies)).toMatchObject({imported:0,total:1});
    input.observations[0].legalDates.effectiveFrom='2026-11-01';
    await expect(db.importObservation(input,dependencies)).rejects.toThrow('eski kayıt korundu');
    expect((await db.listObservations())[0].observations[0].legalDates.effectiveFrom).toBeNull();
    expect((await db.listRevalidationQueue())[0]).toMatchObject({affected:{questionIds:['q1'],optionIds:['q1-b']},publicationApplied:false});
    const output=await db.exportData();output.batches[0].complete=false;
    expect((await db.getStatus()).lastAttemptComplete).toBe(true);
  });
  it('serializes conflicting imports from two tabs without partial writes',async()=>{
    const name=`concurrent-${crypto.randomUUID()}`;const a=store(name);const b=store(name);
    const different=batch();different.observations[0].legalDates.effectiveFrom='2026-11-01';
    const results=await Promise.allSettled([a.importObservation(batch()),b.importObservation(different)]);
    expect(results.filter(v=>v.status==='fulfilled')).toHaveLength(1);
    expect(await a.listObservations()).toHaveLength(1);
  });
  it('round-trips full backup and rejects forged queue state before any import',async()=>{
    const source=store();const destination=store();
    await source.importObservation(batch('changed',changed()),[{sourceId:'SRC-OFFICIAL-657-UYAP',questionIds:['q1']}]);
    const backup=await source.exportData();
    expect(validateLegalWatchBackup(backup)).toEqual(backup);
    await destination.importData(backup);expect(await destination.exportData()).toEqual(backup);
    const forged=structuredClone(backup);forged.revalidationQueue[0].publicationApplied=true as false;
    await expect(store().importData(forged)).rejects.toThrow();
    const corrupt=structuredClone(backup);corrupt.batches.push({...batch('bad'),complete:false});
    await expect(destination.importData(corrupt)).rejects.toThrow();
    expect(await destination.exportData()).toEqual(backup);
  });
  it('only imports explicitly available artifacts and cannot label an offline fetch as a new check',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(batch()),{status:200}));
    expect(await fetchLegalWatchArtifact('./legal-watch.json',fetcher)).toEqual(batch());
    await expect(fetchLegalWatchArtifact('https://untrusted.test/x.json',fetcher)).rejects.toThrow();
    await expect(fetchLegalWatchArtifact('./legal-watch.json',vi.fn().mockResolvedValue(new Response('<html>shell</html>',{status:200})))).rejects.toThrow();
    await expect(fetchLegalWatchArtifact('./legal-watch.json',vi.fn().mockRejectedValue(new Error('Offline')))).rejects.toThrow();
  });
});
