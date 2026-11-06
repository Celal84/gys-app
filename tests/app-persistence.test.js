import { it, expect, vi, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createAttemptStore } from '../src/attempt-store';
import { gysApp, DEFAULT_CURRICULUM } from '../src/app.js';
const q={id:'persist-fixture',version:1,sourcePool:'B',topicId:'O02',learningObjectiveId:'fixture-target',text:'Sentetik kayıt testi?',options:['a','b','c','d','e'].map(id=>({id,text:id})),correctOptionId:'b',explanation:'Yalnız test açıklaması.',sourceSnapshotId:'fixture-source',sourceLocator:'Sentetik test konumu',difficulty:'basic',cognitiveType:'recall',scenarioFlag:false,verificationStatus:'Approved',generatedBy:'fixture',verificationEvidence:[],legalProvisionId:'fixture-law'};
const chunk={schemaVersion:1,questions:[q],snapshots:[{id:'fixture-source',sourceUrl:'https://example.com/official-fixture',contentHash:'a'.repeat(64),legalEdition:'preparation'}]};
const repository=()=>({totalCount:()=>1,countFor:id=>id==='O02'?1:0,loadedChunks:()=>[chunk],loadTopic:async()=>chunk});
function memory(){const m=new Map();return{getItem:key=>m.get(key)??null,setItem:(key,value)=>m.set(key,value)}}
afterEach(()=>vi.unstubAllGlobals());
it('resumes a checked answer without double-counting XP, protects legacy baseline and finishes immutable history',async()=>{
 vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('localStorage',memory());vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 const store=createAttemptStore('app-resume-integration');
 const app=gysApp({attemptStore:store,repository:repository()});await app.initApp();app.state.settings.sound=false;
 await app.startTopicQuiz(DEFAULT_CURRICULUM[1]);
 app.selectOption(app.currentQ().ans);await app.checkAnswer();
 expect(app.state.totalAnswered).toBe(1);expect(app.state.xp).toBe(10);
 app.saveState();
 const restored=gysApp({attemptStore:store,repository:repository()});await restored.initApp();
 expect(restored.state.totalAnswered).toBe(1);expect(restored.state.xp).toBe(10);
 await restored.resumeStudy();expect(restored.quiz.checked).toBe(true);await restored.checkAnswer();
 expect(restored.state.xp).toBe(10);await restored.nextQuestion();
 expect(restored.quiz.result).toMatchObject({correct:1,wrong:0,blank:0});expect(restored.completedAttempts).toHaveLength(1);
 const third=gysApp({attemptStore:store,repository:repository()});await third.initApp();expect(third.state.totalAnswered).toBe(1);expect(third.state.xp).toBe(10);
 await store.close();
});
it('does not expose an optimistic checked answer when another tab has changed the attempt revision',async()=>{
 vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('localStorage',memory());vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 const store=createAttemptStore('app-conflict-integration');const app=gysApp({attemptStore:store,repository:repository()});await app.initApp();
 await app.startTopicQuiz(DEFAULT_CURRICULUM[1]);
 const saved=app.activeAttempt;await store.finish(saved.id,saved.revision);
 app.selectOption(app.currentQ().ans);await app.checkAnswer();
 expect(app.quiz.checked).toBe(false);expect(app.state.totalAnswered).toBe(0);expect(app.notice).toContain('Tamamlanmış');
 await store.close();
});
it('does not resume forged imported snapshots even when IDs and versions copy an approved question',async()=>{
 vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('localStorage',memory());vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 const original=createAttemptStore('app-original-backup');const creator=gysApp({attemptStore:original,repository:repository()});await creator.initApp();await creator.startTopicQuiz(DEFAULT_CURRICULUM[1]);
 const backup=await original.exportJournal();backup.attempts[0].questions[0].text='Forged question with copied ID';
 const target=createAttemptStore('app-forged-backup');await target.importJournal(backup);
 const app=gysApp({attemptStore:target,repository:repository()});await app.initApp();await app.resumeStudy();
 expect(app.quiz.active).toBe(false);expect(app.notice).toContain('onaylı paketle eşleşmiyor');
 await original.close();await target.close();
});
it('keeps imported display-topic keys out of object prototypes and excludes forged mistakes from practice',async()=>{
 vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('localStorage',memory());vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
 const store=createAttemptStore('app-prototype-backup');const app=gysApp({attemptStore:store,repository:repository()});await app.initApp();
 const question={id:'forged-wrong',version:1,topicId:'O02',topic:'__proto__',weight:8,text:'Synthetic malicious history',options:q.options,correctOptionId:'b',explanation:'Fixture only',sourceUrl:'https://example.com/official-fixture',sourceLocator:'Fixture'};
 const attempt=await store.start({title:'Imported-style fixture',mode:'study',questions:[question]});
 const answered=await store.saveAnswer(attempt.id,{questionId:question.id,selectedOptionId:'a',expectedRevision:0});await store.finish(attempt.id,answered.revision);
 await app.refreshJournalProgress();expect(Object.getPrototypeOf(app.state.topicStats)).toBe(Object.prototype);expect(Object.hasOwn(app.state.topicStats,'__proto__')).toBe(false);
 await app.startTopicQuiz(DEFAULT_CURRICULUM[1]);expect(app.quiz.items.every(item=>item.id!=='forged-wrong')).toBe(true);
 await store.close();
});
