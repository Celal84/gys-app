import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttemptConflictError, AttemptInProgressError, CheckedAnswerConflictError, createAttemptStore, type AttemptQuestion, type AttemptStore } from '../src/attempt-store';

const stores: AttemptStore[] = [];
function store(name = `test-attempt-${crypto.randomUUID()}`): AttemptStore {
  const result = createAttemptStore(name); stores.push(result); return result;
}
function question(id: string, topicId = 'O02'): AttemptQuestion {
  return { id, version: 1, topicId, topic: `Topic ${topicId}`, weight: 8, text: `Synthetic test ${id}`,
    options: ['one','two','three','four','five'].map(id => ({id,text:id})), correctOptionId: 'three',
    explanation: 'Synthetic explanation, not real content.', sourceUrl: 'https://example.org/test-only', sourceLocator: 'Test section' };
}
const input = () => ({title:'Synthetic study',mode:'study' as const,questions:[question('q1'),question('q2')]});
afterEach(async () => { vi.restoreAllMocks(); vi.useRealTimers(); await Promise.all(stores.splice(0).map(db => db.close())); });

describe('IndexedDB study journal', () => {
  it('starts empty and persists active snapshots and cursor across connections', async () => {
    const name = `resume-${crypto.randomUUID()}`; const first = store(name);
    expect(await first.getActive()).toBeNull(); expect(await first.listCompleted()).toEqual([]);
    const started = await first.start(input());
    const moved = await first.setCursor(started.id,1,started.revision);
    await first.close(); const reopened = store(name);
    const active = await reopened.getActive();
    expect(active).toMatchObject({id:started.id,cursor:1,revision:moved.revision,status:'active',schemaVersion:1});
    expect(active?.questions).toEqual(input().questions);
    expect(await reopened.load('unknown')).toBeNull();
  });
  it('keeps input and returned object mutations out of persisted question versions', async () => {
    const db=store(); const draft=input(); const started=await db.start(draft);
    draft.questions[0].correctOptionId='one'; draft.questions[0].text='Later edit';
    started.questions[0].text='Caller mutation';
    const active=await db.load(started.id);
    expect(active?.questions[0].text).toBe('Synthetic test q1');
    expect(active?.questions[0].correctOptionId).toBe('three');
  });
  it('stores a stable-option answer once and resumes checked state', async () => {
    const db=store(); const started=await db.start(input());
    const answered=await db.saveAnswer(started.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0,activeTimeMs:12000});
    expect(answered.revision).toBe(1); expect(answered.answers[0]).toMatchObject({questionId:'q1',correct:true,activeTimeMs:12000});
    const repeated=await db.saveAnswer(started.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0});
    expect(repeated.answers).toHaveLength(1); expect(repeated.revision).toBe(1);
    await expect(db.saveAnswer(started.id,{questionId:'q1',selectedOptionId:'one',expectedRevision:1})).rejects.toBeInstanceOf(CheckedAnswerConflictError);
    expect((await db.getActive())?.answers).toHaveLength(1);
  });
  it('serializes two tabs and rejects a stale mutation without losing the committed answer', async () => {
    const name=`tabs-${crypto.randomUUID()}`;const first=store(name);const second=store(name);
    const started=await first.start(input());
    const fromSecond=await second.load(started.id); expect(fromSecond?.revision).toBe(0);
    await first.saveAnswer(started.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0});
    await expect(second.saveAnswer(started.id,{questionId:'q2',selectedOptionId:'one',expectedRevision:0})).rejects.toBeInstanceOf(AttemptConflictError);
    const persisted=await second.load(started.id);
    expect(persisted?.revision).toBe(1); expect(persisted?.answers.map(a=>a.questionId)).toEqual(['q1']);
    await expect(second.finish(started.id,0)).rejects.toBeInstanceOf(AttemptConflictError);
    expect((await first.load(started.id))?.status).toBe('active');
  });
  it('prevents simultaneous starts from producing two active attempts', async () => {
    const name=`start-tabs-${crypto.randomUUID()}`;const a=store(name);const b=store(name);
    const results=await Promise.allSettled([a.start(input()),b.start(input())]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const rejected=results.find(r=>r.status==='rejected');
    expect(rejected?.status==='rejected' && rejected.reason).toBeInstanceOf(AttemptInProgressError);
    expect(await a.getActive()).not.toBeNull();
  });
  it('scores correct, wrong, blanks and topic totals without negative marking', async () => {
    const db=store();const started=await db.start({...input(),questions:[question('q1'),question('q2'),question('q3','T01')]});
    await db.saveAnswer(started.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0});
    await db.saveAnswer(started.id,{questionId:'q2',selectedOptionId:'one',expectedRevision:1});
    const finished=await db.finish(started.id,2);
    expect(finished.result).toMatchObject({correct:1,wrong:1,blank:1,total:3,score:1,accuracyPercent:50});
    expect(finished.result?.perTopic).toEqual([
      {topicId:'O02',topic:'Topic O02',correct:1,wrong:1,blank:0,total:2},
      {topicId:'T01',topic:'Topic T01',correct:0,wrong:0,blank:1,total:1},
    ]);
    expect(await db.getActive()).toBeNull();
    expect((await db.listCompleted())[0]).toMatchObject({id:started.id,questionCount:3,result:finished.result});
    expect((await db.listCompleted())[0]).not.toHaveProperty('questions');
  });
  it('keeps a completed attempt immutable after current content changes and identifies repeats by IDs and versions', async () => {
    const db=store(); const started=await db.start(input());
    const answered=await db.saveAnswer(started.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0});
    const finished=await db.finish(started.id,answered.revision);
    const repeat=await db.start({...input(),questions:[question('q2'),question('q1')]});
    expect(repeat.attemptNumber).toBe(2);expect(repeat.isFirstAttempt).toBe(false);
    await db.finish(repeat.id,0);
    const changed=input();changed.questions[0].version=2;changed.questions[0].correctOptionId='one';
    const next=await db.start(changed);expect(next.attemptNumber).toBe(1);expect(next.isFirstAttempt).toBe(true);
    const old=await db.load(started.id);expect(old?.result).toEqual(finished.result);
    expect(old?.questions[0].correctOptionId).toBe('three');
    await expect(db.saveAnswer(started.id,{questionId:'q2',selectedOptionId:'one',expectedRevision:finished.revision})).rejects.toThrow('Tamamlanmış');
    const retried=await db.finish(started.id,0);expect(retried.revision).toBe(finished.revision);
  });
  it('treats an entirely blank study as unmeasured accuracy while recording blanks', async () => {
    const db=store();const started=await db.start(input());const finished=await db.finish(started.id,0);
    expect(finished.result).toMatchObject({correct:0,wrong:0,blank:2,accuracyPercent:null,score:0});
  });
  it('invalid input or answer causes no partial record or summary write', async () => {
    const db=store();const invalid=input();invalid.questions[0].options[1].id='one';
    await expect(db.start(invalid)).rejects.toThrow();expect(await db.getActive()).toBeNull();
    const started=await db.start(input());
    await expect(db.saveAnswer(started.id,{questionId:'q1',selectedOptionId:'bad-option',expectedRevision:0})).rejects.toThrow('Soru veya seçenek');
    await expect(db.saveAnswer(started.id,{questionId:'q1',selectedOptionId:'one',expectedRevision:0,activeTimeMs:-1})).rejects.toThrow('Geçersiz aktif');
    await expect(db.setCursor(started.id,100,0)).rejects.toThrow('Geçersiz soru konumu');
    const unchanged=await db.load(started.id);expect(unchanged?.revision).toBe(0);expect(unchanged?.answers).toEqual([]);
    expect(await db.listCompleted()).toEqual([]);
  });
  it('stable correct option survives an option-order shuffle in the saved snapshot', async () => {
    const db=store();const shuffled=input();shuffled.questions[0].options.reverse();
    const started=await db.start(shuffled);
    const answered=await db.saveAnswer(started.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0});
    expect(answered.answers[0].correct).toBe(true);
  });
  it('aggregates progress with idempotent answers and retains mistake snapshots until two correct recalls', async () => {
    const db=store();let attempt=await db.start(input());
    expect((await db.getProgress()).totalAnswered).toBe(0);
    attempt=await db.saveAnswer(attempt.id,{questionId:'q1',selectedOptionId:'one',expectedRevision:0});
    await db.saveAnswer(attempt.id,{questionId:'q1',selectedOptionId:'one',expectedRevision:0});
    let progress=await db.getProgress();
    expect(progress).toMatchObject({totalAnswered:1,totalCorrect:0,uniqueSolved:1,firstEncounterAnswered:1,firstEncounterCorrect:0,xp:0,streak:1});
    expect(progress.mistakes.q1).toMatchObject({wrongCount:1,streak:0,question:question('q1')});
    await db.finish(attempt.id,attempt.revision);
    for(let recall=0;recall<2;recall++) {
      attempt=await db.start(input());
      attempt=await db.saveAnswer(attempt.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0});
      await db.finish(attempt.id,attempt.revision);
    }
    progress=await db.getProgress();
    expect(progress).toMatchObject({totalAnswered:3,totalCorrect:2,uniqueSolved:1,xp:20,dailyXP:20});
    expect(progress.topicStats['Topic O02']).toEqual({answered:3,correct:2});
    expect(progress.mistakes).toEqual({});
  });
  it('answer, summary revision and progress roll back together if the progress write fails', async () => {
    const db=store();const attempt=await db.start(input());
    const original=IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:unknown,key?:IDBValidKey) {
      return this.name==='progress' ? this.add(value,key) : original.call(this,value,key);
    });
    await expect(db.saveAnswer(attempt.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0})).rejects.toThrow();
    vi.restoreAllMocks();
    expect((await db.load(attempt.id))?.answers).toEqual([]);
    expect((await db.load(attempt.id))?.revision).toBe(0);
    expect((await db.getProgress()).totalAnswered).toBe(0);
  });
  it('exports and merges a full journal without duplicates and rebuilds aggregate progress', async () => {
    const donor=store();const attempt=await donor.start(input());
    const answered=await donor.saveAnswer(attempt.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0});
    await donor.finish(attempt.id,answered.revision);
    const backup=await donor.exportJournal();const recipient=store();
    expect(await recipient.importJournal(backup)).toEqual({imported:1,totalAttempts:1});
    expect(await recipient.importJournal(backup)).toEqual({imported:0,totalAttempts:1});
    expect((await recipient.getProgress()).totalAnswered).toBe(1);
    expect((await recipient.listCompleted())[0].result?.score).toBe(1);
    backup.attempts[0].questions[0].text='Edited backup';
    await expect(recipient.importJournal(backup)).rejects.toThrow('çakışıyor');
    expect((await recipient.load(attempt.id))?.questions[0].text).toBe('Synthetic test q1');
  });
  it('rejects corrupt backup scores and multiple active imports without changing the journal', async () => {
    const donor=store();const attempt=await donor.start(input());await donor.finish(attempt.id,0);
    const invalid=await donor.exportJournal();invalid.attempts[0].result!.score=999;
    const recipient=store();await expect(recipient.importJournal(invalid)).rejects.toThrow('sonuç özeti');
    expect(await recipient.listCompleted()).toEqual([]);
    const active=await donor.start(input());const backup=await donor.exportJournal();
    const local=await recipient.start(input());
    await expect(recipient.importJournal(backup)).rejects.toThrow('Birden fazla aktif');
    expect((await recipient.getActive())?.id).toBe(local.id);
    expect(await recipient.load(active.id)).toBeNull();expect(await recipient.listCompleted()).toEqual([]);
    expect((await recipient.getProgress()).totalAnswered).toBe(0);
  });

  it('additively migrates a v1 journal without deleting old snapshots or answers', async () => {
    const donor=store();let attempt=await donor.start(input());
    attempt=await donor.saveAnswer(attempt.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0});
    attempt=await donor.finish(attempt.id,attempt.revision);
    const name=`old-schema-${crypto.randomUUID()}`;
    await new Promise<void>((resolve,reject)=> {
      const request=indexedDB.open(name,1);
      request.onupgradeneeded=()=> {
        const db=request.result;
        const attempts=db.createObjectStore('attempts',{keyPath:'id'});attempts.createIndex('status','status');
        const summaries=db.createObjectStore('summaries',{keyPath:'id'});summaries.createIndex('status','status');summaries.createIndex('contentKey','contentKey');
      };
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=> {
        const db=request.result;const tx=db.transaction('attempts','readwrite');tx.objectStore('attempts').put(attempt);
        tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
      };
    });
    const migrated=store(name);expect((await migrated.load(attempt.id))?.answers).toEqual(attempt.answers);
    expect((await migrated.load(attempt.id))?.result).toEqual(attempt.result);
    expect((await migrated.getProgress()).totalAnswered).toBe(1);
    expect((await migrated.getProgress()).totalCorrect).toBe(1);
    expect((await migrated.listCompleted())[0].id).toBe(attempt.id);
  });

  it('shows zero daily XP on a new Istanbul day without treating an app read as study', async () => {
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-06T20:59:59Z'));
    const db=store();let attempt=await db.start(input());
    attempt=await db.saveAnswer(attempt.id,{questionId:'q1',selectedOptionId:'three',expectedRevision:0});
    expect((await db.getProgress()).dailyXP).toBe(10);
    vi.setSystemTime(new Date('2026-11-06T21:00:01Z'));
    const opened=await db.getProgress();expect(opened.dailyXP).toBe(0);expect(opened.lastActiveDate).toBe('2026-11-06');
    expect(opened.streak).toBe(1);expect(opened.xp).toBe(10);
    await db.saveAnswer(attempt.id,{questionId:'q2',selectedOptionId:'three',expectedRevision:attempt.revision});
    const studied=await db.getProgress();expect(studied.dailyXP).toBe(10);expect(studied.lastActiveDate).toBe('2026-11-07');expect(studied.streak).toBe(2);
  });

});
