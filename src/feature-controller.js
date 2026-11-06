import { matchesPublishedStudy, matchesPublishedExam } from './core/content-authority';
import { TOPICS } from './core/curriculum';
import { CURRICULUM_MAP } from './core/curriculum-map';
import { buildForecast, calibrateForecasts } from './core/analytics';
import { buildStudyPlan, DEFAULT_WEEKLY_CAPACITY, validateWeeklyCapacity } from './core/planner';
import { ERROR_REASONS, compareSelfExplanation } from './core/learning';
import { createLearningStore, validateLearningBackup } from './learning-store';
import { createStrictStore, validateStrictJournal } from './strict-store';
import { createFocusStore, validateFocusJournal } from './focus-store';
import { createLegalWatchStore, validateLegalWatchBackup } from './legal-watch-store';
import { comparisonTablesFromApprovedContent, OFFICIAL_WATCH_IDENTITIES } from './core/legal-watch';
import { createFullBackup, prepareFullRestore, createFullBackupStore } from './full-backup';
import { createAttemptStore } from './attempt-store';
import examManifest from '../data/exam-manifest.json';

const copy = value => JSON.parse(JSON.stringify(value));
const clockLabel = ms => { const total=Math.max(0,Math.ceil(ms/1000));return Math.floor(total/60)+':'+String(total%60).padStart(2,'0'); };
const emptyPlanData=()=>({kind:'gys-planner-data',schemaVersion:1,capacities:{...DEFAULT_WEEKLY_CAPACITY},completedSessions:[],forecasts:[],watch:null});
function validatePlanData(value){
  if(!value||value.kind!=='gys-planner-data'||value.schemaVersion!==1||!Array.isArray(value.completedSessions)||!Array.isArray(value.forecasts)||value.completedSessions.length>100000||value.forecasts.length>10000)throw new Error('Plan yedeği geçersiz.');
  validateWeeklyCapacity(value.capacities);
  for(const session of value.completedSessions)if(!/^\d{4}-\d{2}-\d{2}$/.test(session.date)||!Number.isFinite(session.minutes)||session.minutes<0||session.minutes>720)throw new Error('Plan oturumu geçersiz.');
  for(const forecast of value.forecasts)if(!forecast.id||!Number.isFinite(Date.parse(forecast.createdAt))||!Number.isFinite(forecast.score)||forecast.score<0||forecast.score>100||!Array.isArray(forecast.independentMockIds))throw new Error('Tahmin kaydı geçersiz.');
  if(value.watch!==null)validateLegalWatchBackup(value.watch);
  return copy(value);
}
export function profileStorage(original, profile){
  if(!profile)return original;
  const prefix='gys-profile:'+profile.profileId+':';
  return {getItem(key){
    const stored=original.getItem(prefix+key);if(stored!==null)return stored;
    if(key==='gys_duo_state_v1')return JSON.stringify(profile.backup.payload.legacyWorkspace.state);
    if(key==='gys_duo_questions_v1')return JSON.stringify(profile.backup.payload.legacyWorkspace.questions);
    return null;
  },setItem(key,value){original.setItem(prefix+key,value);}};
}
function makeServices(profileId=''){
  const suffix=profileId?':'+profileId:'';
  return {learning:createLearningStore('gys_learning_v1'+suffix),strict:createStrictStore({dbName:'gys_strict_v1'+suffix}),focus:createFocusStore({dbName:'gys_focus_v1'+suffix}),watch:createLegalWatchStore('gys_legal_watch_v1'+suffix)};
}
function saveFile(data,name,type='application/json'){
  const url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
const validators={learning:validateLearningBackup,strict:validateStrictJournal,focus:validateFocusJournal,planner:validatePlanData};

export function createFeatureController({repository,getJournal,getLegacy}){
  const backupStore=createFullBackupStore();
  let services=makeServices();let activeProfile=null;let planData=emptyPlanData();let polling=false;let strictChain=Promise.resolve();let channel=null;const examCache=new Map();
  const preferenceKey=()=> 'gys-feature-settings:'+ (activeProfile?.profileId||'default');
  const loadPreferences=()=>{
    const raw=localStorage.getItem(preferenceKey());
    if(raw)planData=validatePlanData(JSON.parse(raw));
    else if(activeProfile?.backup.payload.planner)planData=validatePlanData(activeProfile.backup.payload.planner);
  };
  const persistPreferences=()=>{localStorage.setItem(preferenceKey(),JSON.stringify({...planData,watch:null}));};
  const profileGuard=async()=>{const current=await backupStore.readActive();if((current?.revision||0)!==(activeProfile?.revision||0))throw new Error('Etkin veri profili başka sekmede değişti. Yenileyerek devam edin.');};
  const withLock=async(mode,callback)=>{
    const run=async()=>{await profileGuard();return callback();};
    return globalThis.navigator?.locks?navigator.locks.request('gys-profile-data',{mode},run):run();
  };
  const strictQueue=callback=>{const promise=strictChain.then(()=>withLock('shared',callback));strictChain=promise.catch(()=>{});return promise;};
  async function registerTopicCards(topicId){
    const chunk=await repository.loadTopic(topicId);if(!chunk)return;
    await services.learning.registerCards({questions:chunk.questions,snapshots:chunk.snapshots});
  }
  async function applyWatch(app){
    const batches=await services.watch.listObservations();repository.setSourceObservations?.(batches.flatMap(batch=>batch.observations));
    app.watchStatus=await services.watch.getStatus();app.revalidationQueue=await services.watch.listRevalidationQueue();
  }
  async function fullSnapshot(){
    const [journal,learning,strict,focus,watch]=await Promise.all([getJournal().exportJournal(),services.learning.exportData(),services.strict.exportData(),services.focus.exportData(),services.watch.exportData()]);
    return createFullBackup({legacyWorkspace:getLegacy(),journal,learning,strict,focus,planner:{...copy(planData),watch}},{validators});
  }
  async function fetchExamPackage(entry){
    if(!entry||!/^content\/exams\/EXAM-\d{2}\.json$/.test(entry.path))throw new Error('Yayımlanmış deneme kaydı bulunamadı.');
    if(examCache.has(entry.sha256))return examCache.get(entry.sha256);
    const response=await fetch('./'+entry.path);if(!response.ok)throw new Error('Deneme paketi alınamadı.');
    const text=await response.text();const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(digest!==entry.sha256)throw new Error('Deneme paketi bütünlük hatası.');
    const pack=JSON.parse(text);examCache.set(entry.sha256,pack);return pack;
  }
  async function trustedExam(record){
    const entry=examManifest.readyExams.find(e=>(e.id||e.examId)===record.definitionId&&e.version===record.definitionVersion);
    if(!entry)return false;
    try{const pack=await fetchExamPackage(entry);return matchesPublishedExam(record,pack)&&pack.snapshots.every(source=>repository.isSourceCurrent?.(source)!==false);}catch{return false;}
  }
  return {
    toolsReady:false,toolMode:'learn',toolBusy:false,toolTopicId:'O02',toolTopics:TOPICS.map(t=>({id:t.id,title:t.title})),
    featureMenu:[{id:'bank',label:'Konu soru bankası'},{id:'learn',label:'Konu öğrenme'},{id:'cards',label:'Ezber kartları'},{id:'review',label:'Akıllı tekrar'},{id:'compare',label:'Mevzuat karşılaştırması'},{id:'plan',label:'Çalışma takvimi'},{id:'analysis',label:'Hata ve başarı analizi'},{id:'exams',label:'Tam denemeler'},{id:'watch',label:'Mevzuat nöbetçisi'},{id:'focus',label:'Odak yönetimi'},{id:'data',label:'Veri ve PDF raporu'}],
    bankDifficulty:'all',bankProvision:'all',featureTheme:'dark',updateAvailable:false,learnRows:[],cards:[],cardRevealed:false,learningStats:null,
    errorReasons:ERROR_REASONS,errorReasonChoice:'',explanationText:'',explanationResult:null,studyPlan:null,capacityDraft:{...DEFAULT_WEEKLY_CAPACITY},
    forecast:null,calibration:null,comparisonTables:{durations:[],authorities:[],remedies:[],historical:[]},comparisonKind:'durations',
    watchStatus:null,revalidationQueue:[],watchChecking:false,focusSession:null,focusDraft:{workMinutes:25,breakMinutes:5},
    strictView:null,strictHistory:[],strictBusy:false,strictCatalog:examManifest,strictReviewIndex:0,strictResultTrusted:false,restoreProposal:null,profileSwitched:false,strictUntrusted:false,
    async loadFeatureProfile(){
      activeProfile=await backupStore.readActive();services=makeServices(activeProfile?.profileId||'');return activeProfile;
    },
    withProfileWrite(callback){return withLock('shared',callback);},
    async initFeatures(){
      loadPreferences();this.capacityDraft=copy(planData.capacities);
      this.featureTheme=['light','dark'].includes(this.state.settings.theme)?this.state.settings.theme:'dark';this.applyTheme(false);
      this.focusDraft=await services.focus.getSettings();this.focusSession=await services.focus.getActive();
      try{const response=await fetch('./content/legal-watch.json');if(response.ok){const batch=await response.json();await services.watch.importObservation(batch);}}catch{/* Keep the last successful local observation. */}
      await applyWatch(this);this.strictView=await services.strict.getActiveView();
      if(this.strictView){const raw=(await services.strict.exportData()).attempts.find(a=>a.id===this.strictView.id);if(!raw||!await trustedExam(raw)){this.strictView=null;this.strictUntrusted=true;this.notice='Aktif deneme yayımlanmış kaynak paketiyle doğrulanamadı. Kayıt korunuyor; tam yedek alabilirsiniz.';}}
      this.strictResultTrusted=Boolean(this.strictView);this.strictHistory=await services.strict.listSummaries();this.toolsReady=true;this.updateAvailable=Boolean(window.__gysUpdateReady);
      if(typeof BroadcastChannel!=='undefined'){channel=new BroadcastChannel('gys-active-profile');channel.onmessage=()=>{this.profileSwitched=true;this.storageBlocked=true;this.notice='Veri profili başka sekmede değişti. Yenileyerek devam edin.';};}
      window.addEventListener('gys-update-ready',()=>{this.updateAvailable=true;});
      const visibility=()=>this.handleFeatureVisibility();document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',()=>this.handleFeatureVisibility(true));window.addEventListener('pageshow',visibility);
      window.setInterval(async()=>{if(polling)return;polling=true;try{
        this.tickStudyTiming?.(!document.hidden);
        if(this.strictView?.status==='active')await this.tickStrict();
        if(this.focusSession?.status==='running')this.focusSession=await withLock('shared',()=>services.focus.tick({now:new Date(),visible:!document.hidden}));
      }catch(error){this.notice=error.message;}finally{polling=false;}},1000);
    },
    applyTheme(save=true){
      document.documentElement.dataset.theme=this.featureTheme;this.state.settings.theme=this.featureTheme;if(save)this.saveState();
    },
    async activateAppUpdate(){
      if(this.savingAnswer||this.strictView?.status==='active'){this.notice='Güncelleme için önce aktif sınavın bitmesini bekleyin.';return;}
      window.dispatchEvent(new Event('gys-apply-update'));
    },
    async openTool(mode){
      if((this.strictView?.status==='active'||this.strictUntrusted)&&mode!=='data'){this.notice='Aktif deneme doğrulanmadan öğrenme ve yardımcı araçlar açılamaz.';return;}
      if(!this.toolsReady){this.notice='Yerel kayıtlar hazırlanıyor.';return;}
      this.activeTab='tools';this.toolMode=mode;this.notice='';this.toolBusy=true;
      try{
        if(mode==='learn'||mode==='bank')await this.loadLearningTopic();
        if(mode==='cards'||mode==='review'){await withLock('shared',()=>registerTopicCards(this.toolTopicId));await this.refreshCards();}
        if(mode==='plan')await this.refreshPlan();
        if(mode==='analysis')await this.refreshAnalysis();
        if(mode==='compare')await this.refreshComparison();
        if(mode==='watch')await applyWatch(this);
        if(mode==='focus'){this.focusSession=await services.focus.getActive();this.focusDraft=await services.focus.getSettings();}
        if(mode==='exams')this.strictHistory=await services.strict.listSummaries();
      }catch(error){this.notice=error.message;}finally{this.toolBusy=false;}
    },
    async loadLearningTopic(){
      const chunk=await repository.loadTopic(this.toolTopicId);this.learnRows=[];
      if(!chunk){this.notice='Bu konuda kaynak ve kapsam incelemesi sürüyor; onaylı öğrenme paketi henüz yok.';return;}
      this.learnRows=chunk.questions.map(question=>({id:question.id,objective:question.learningObjectiveId,difficulty:question.difficulty,title:question.text,answer:question.options.find(o=>o.id===question.correctOptionId).text,explanation:question.explanation,quote:question.expectedFacts?.sourceQuote||'',sourceUrl:chunk.snapshots.find(s=>s.id===question.sourceSnapshotId).sourceUrl,locator:question.sourceLocator}));
    },
    bankProvisions(){return [...new Set(this.learnRows.map(q=>q.locator))];},
    filteredBankCount(){return this.learnRows.filter(q=>(this.bankDifficulty==='all'||q.difficulty===this.bankDifficulty)&&(this.bankProvision==='all'||q.locator===this.bankProvision)).length;},
    startFilteredBank(){const topic=this.curriculum.find(t=>t.code===this.toolTopicId);return this.startTopicQuiz(topic,{difficulty:this.bankDifficulty,provision:this.bankProvision});},
    async refreshCards(){
      const due=await services.learning.dueCards(new Date(),30);this.cards=[];
      for(const card of due){
        const chunk=await repository.loadTopic(card.topicId).catch(()=>null);const question=chunk?.questions.find(q=>q.id===card.questionId&&q.version===card.questionVersion);
        if(question&&question.text===card.front&&question.options.find(o=>o.id===question.correctOptionId)?.text===card.back&&question.sourceSnapshotId===card.source.snapshotId)this.cards.push(card);
      }
      this.cardRevealed=false;this.learningStats=await services.learning.stats();
    },
    async registerStudyCards(){
      try{await withLock('shared',()=>registerTopicCards(this.toolTopicId));await this.refreshCards();this.notice='Onaylı kaynak soruları tekrar kartlarına bağlandı.';}catch(error){this.notice=error.message;}
    },
    async gradeCard(quality){
      const card=this.cards[0];if(!card||!this.cardRevealed||this.strictView?.status==='active'||this.toolBusy)return;this.toolBusy=true;
      try{await withLock('shared',()=>services.learning.reviewCard(card.id,Number(quality),{expectedRevision:card.revision}));await this.refreshCards();}catch(error){this.notice=error.message;}finally{this.toolBusy=false;}
    },
    async recordStudyError(reason=null){
      const question=this.currentQ();if(!question||!this.quiz.checked||this.quiz.isCorrect||this.strictView?.status==='active')return;
      try{
        const selectedId=question.optionIds?.[this.quiz.selected];const canonical=repository.loadedChunks().flatMap(c=>c.questions).find(q=>q.id===question.id&&q.version===question.version);const distractor=canonical?.distractorExplanations?.find(d=>d.optionId===selectedId);
        await withLock('shared',()=>services.learning.recordError({id:(reason?'USERERR:':'AUTOERR:')+(this.activeAttempt?.id||'study')+':'+question.id,questionId:String(question.id),questionVersion:question.version||1,topicId:question.topicId,userReason:reason||null,conceptId:distractor?.conceptId||null,relatedConceptId:null,activeTimeMs:this.activeAttempt?.answers.find(a=>a.questionId===question.id)?.activeTimeMs??null,strictMode:false}));
        if(reason)this.notice='Belirttiğin hata nedeni ayrı kaydedildi.';
      }catch(error){this.notice=error.message;}
    },
    compareExplanation(){
      const question=this.currentQ();if(!question||!this.quiz.checked||this.strictView?.status==='active')return;
      const correct=question.opts[question.ans];const terms=correct.toLocaleLowerCase('tr').split(/\s+/).filter(w=>w.length>=4).slice(0,3);
      this.explanationResult=compareSelfExplanation({text:this.explanationText,concepts:[{id:'correct-answer',label:correct,requiredTerms:terms.length?terms:[correct]}]});
      this.explanationResult.help=this.explanationResult.status==='skipped'?'Bu adım atlanabilir.':this.explanationResult.missingConceptIds.length?'Yanıtında kontrol edilecek ifade: '+correct:'Anahtar ifadeler var. Gerekçeni kaynak hükümle de karşılaştır.';
    },
    async refreshPlan(){
      for(const topicId of (repository.topicIds?.()||['O02']).slice(0,4))await repository.loadTopic(topicId).catch(()=>null);
      const available=repository.loadedChunks().flatMap(c=>c.questions);
      const approvedObjectives=available.map(q=>({id:q.learningObjectiveId,topicId:q.topicId,subtopicId:q.learningObjectiveId,subtopic:q.sourceLocator,legalInstrument:TOPICS.find(t=>t.id===q.topicId).title,legalReference:{article:q.articleNumber,paragraph:null,clause:null,section:null},historicalReference:null,objective:q.explanation,importance:'high',prerequisiteObjectiveIds:[],relatedQuestionIds:[q.id],learningState:'Unmeasured',status:'Approved',scopeStatus:'Approved',coverageCategory:'source-bound-question',evidence:{sourceDocumentId:q.sourceSnapshotId,sourceExcerpt:q.expectedFacts?.sourceQuote||q.explanation,verificationStatus:'Verified'}}));
      const objectives=[...new Map([...CURRICULUM_MAP.learningObjectives,...approvedObjectives].map(o=>[o.id,o])).values()];
      const focus=await services.focus.listSessions();const completed=focus.filter(row=>row.status==='completed').map(row=>({date:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date(row.completedAt)),minutes:Math.floor(row.workActiveMs/60000)}));
      this.studyPlan=buildStudyPlan({now:new Date(),capacities:planData.capacities,objectives,availableQuestions:available,completedSessions:[...planData.completedSessions,...completed],solvedQuestionIds:new Set(this.journalProgress?.solvedQuestionIds||[])});
    },
    async saveCapacity(){
      try{validateWeeklyCapacity(this.capacityDraft);planData.capacities=copy(this.capacityDraft);persistPreferences();await this.refreshPlan();}catch(error){this.notice=error.message;}
    },
    async confirmPlanTask(day,task){
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date());
      if(day.date!==today){this.notice='Yalnız bugün gerçekten çalıştığın görevi kaydedebilirsin.';return;}
      if(planData.completedSessions.some(s=>s.taskId===task.id)){this.notice='Bu görev zaten kayıtlı.';return;}
      planData.completedSessions.push({date:day.date,minutes:task.minutes,taskId:task.id});persistPreferences();await this.refreshPlan();
    },
    async refreshAnalysis(){
      const [journal,learning,strict]=await Promise.all([getJournal().exportJournal(),services.learning.exportData(),services.strict.exportData()]);
      const observations=[];const seen=new Set(learning.cards.map(card=>card.questionId));
      const topicIds=[...new Set(journal.attempts.flatMap(a=>a.questions.map(q=>q.topicId)))];
      for(const id of topicIds)await repository.loadTopic(id).catch(()=>null);
      const chunks=repository.loadedChunks();const sources=new Map(chunks.flatMap(c=>c.snapshots).map(s=>[s.id,s]));
      const questions=new Map(repository.loadedChunks().flatMap(chunk=>chunk.questions).map(q=>[q.id,q]));
      for(const attempt of journal.attempts.sort((a,b)=>a.startedAt.localeCompare(b.startedAt))){
        for(const answer of attempt.answers){const q=attempt.questions.find(row=>row.id===answer.questionId);const canonical=questions.get(q.id);const source=canonical&&sources.get(canonical.sourceSnapshotId);if(!canonical||!source||!matchesPublishedStudy(q,canonical,source))continue;
          observations.push({questionId:q.id,objectiveId:q.learningObjectiveId||canonical?.learningObjectiveId||'unknown',topicId:q.topicId,attemptId:attempt.id,sourcePool:'B',correct:answer.selectedOptionId===canonical.correctOptionId,firstSeen:!seen.has(q.id),completedAttempt:attempt.status==='completed',independentMock:false,answeredAt:answer.answeredAt,difficulty:q.difficulty||canonical?.difficulty||'basic',cognitiveType:q.cognitiveType||canonical?.cognitiveType||'unknown'});seen.add(q.id);
        }
      }
      const trustedStrict=[];for(const attempt of strict.attempts)if(await trustedExam(attempt))trustedStrict.push(attempt);
      for(const attempt of trustedStrict.sort((a,b)=>a.startedAt.localeCompare(b.startedAt))){
        for(const answer of attempt.answers){const q=attempt.questions.find(row=>row.id===answer.questionId);observations.push({questionId:q.id,objectiveId:q.learningObjectiveId,topicId:q.topicId,attemptId:attempt.id,sourcePool:'A',correct:answer.selectedOptionId===q.correctOptionId,firstSeen:!seen.has(q.id),completedAttempt:attempt.status==='completed',independentMock:attempt.isFirstAttempt,answeredAt:answer.answeredAt,difficulty:q.difficulty,cognitiveType:q.cognitiveType});seen.add(q.id);}
      }
      this.forecast=buildForecast({observations,now:new Date()});
      this.calibration=calibrateForecasts(planData.forecasts,trustedStrict.filter(a=>a.status==='completed'&&a.isFirstAttempt).map(a=>({attemptId:a.id,startedAt:a.startedAt,finishedAt:a.finishedAt,score:a.result.score,firstAttempt:true,independent:true,totalQuestions:100,validDistribution:true})));
      this.learningStats=await services.learning.stats();
    },
    async saveForecast(){
      if(this.forecast?.score===null||!this.forecast)return;
      planData.forecasts.push({id:crypto.randomUUID(),score:this.forecast.score,createdAt:this.forecast.createdAt,independentMockIds:this.forecast.evidence.independentMockIds});persistPreferences();this.notice='Tahmin sonraki bağımsız denemelerle karşılaştırılmak üzere kaydedildi.';
    },
    async refreshComparison(){
      const source=await import('../data/public-legal-sources/657-provisions.json');const chunks=repository.loadedChunks();
      if(!chunks.length)await repository.loadTopic('O02');
      this.comparisonTables=comparisonTablesFromApprovedContent(repository.loadedChunks().flatMap(c=>c.questions),repository.loadedChunks().flatMap(c=>c.snapshots),source.default.provisions);
    },
    async checkLaws(){
      if(this.watchChecking)return;this.watchChecking=true;
      try{
        const response=await fetch('./api/legal-watch',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
        if(!response.ok)throw new Error('Çevrim içi kontrol servisine ulaşılamadı. Önceki başarılı kayıt korunur; kontrol JSON raporu da içe aktarılabilir.');
        const batch=await response.json();await services.watch.importObservation(batch,this.watchDependencies());await applyWatch(this);
        this.notice=batch.complete?'Resmî kaynak kontrolü tamamlandı.':'Bazı kaynaklara ulaşılamadı; eksikler başarı sayılmadı.';
      }catch(error){this.notice=error.message;}finally{this.watchChecking=false;}
    },
    watchDependencies(){return [...(repository.sourceDependencies?.()||[]),...repository.loadedChunks().flatMap(chunk=>chunk.snapshots.map(source=>({sourceId:OFFICIAL_WATCH_IDENTITIES[chunk.questions[0]?.topicId]?.sourceId||source.sourceId,topicId:chunk.questions[0]?.topicId,articleNumbers:[...new Set(chunk.questions.map(q=>q.articleNumber).filter(Boolean))],legalProvisionIds:chunk.questions.map(q=>q.legalProvisionId),learningObjectiveIds:chunk.questions.map(q=>q.learningObjectiveId),questionIds:chunk.questions.map(q=>q.id),optionIds:chunk.questions.flatMap(q=>q.options.map(o=>o.id)),explanationIds:chunk.questions.map(q=>'EXPLANATION:'+q.id),flashcardIds:chunk.questions.map(q=>'CARD:'+q.id+':v'+q.version),comparisonRowIds:[]})))];},
    async importWatch(event){try{const file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw new Error('Kontrol dosyası çok büyük.');await services.watch.importObservation(JSON.parse(await file.text()),this.watchDependencies());await applyWatch(this);this.notice='Kontrol kanıtı içe aktarıldı.';}catch(error){this.notice=error.message;}},
    async focusAction(action){
      try{
        const tick={now:new Date(),visible:!document.hidden};
        if(action==='start'){await services.focus.setSettings(copy(this.focusDraft));this.focusSession=await withLock('shared',()=>services.focus.start(tick));}
        else if(action==='pause')this.focusSession=await withLock('shared',()=>services.focus.pause(tick));
        else if(action==='resume')this.focusSession=await withLock('shared',()=>services.focus.resume(tick));
        else if(action==='confirm')this.focusSession=await withLock('shared',()=>services.focus.confirmPhase(tick));
      }catch(error){this.notice=error.message;}
    },
    focusClock(){if(!this.focusSession)return clockLabel(this.focusDraft.workMinutes*60000);const s=this.focusSession;return clockLabel((s.phase==='work'?s.workMinutes:s.breakMinutes)*60000-s.phaseActiveMs);},
    async handleFeatureVisibility(forceHidden=false){
      try{
        this.setStudyVisibility?.(!forceHidden&&!document.hidden);
        if(this.focusSession?.status==='running')this.focusSession=await withLock('shared',()=>services.focus.tick({now:new Date(),visible:!forceHidden&&!document.hidden}));
        if(this.strictView?.status==='active')await strictQueue(async()=>{const view=await services.strict.loadView(this.strictView.id);if(view?.status==='active')this.strictView=await services.strict.setForeground(view.id,!forceHidden&&!document.hidden,view.revision);else this.strictView=view;});
      }catch(error){this.notice=error.message;}
    },
    trapStrictFocus(event){const dialog=document.querySelector('[data-testid="strict-dialog"]');const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],summary,[tabindex="0"]')].filter(node=>node.getClientRects().length);if(!controls.length)return;const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}},
    strictQuestion(){return this.strictView?.questions[this.strictView.cursor]||null;},
    strictSelected(){const q=this.strictQuestion();return q?this.strictView.answers.find(a=>a.questionId===q.id)?.selectedOptionId:null;},
    strictClock(){return clockLabel(this.strictView?.remainingMs||0);},
    async tickStrict(){
      await strictQueue(async()=>{const view=await services.strict.loadView(this.strictView.id);this.strictView=view;if(view?.status==='completed')this.strictHistory=await services.strict.listSummaries();});
    },
    async startStrict(exam){
      if(this.strictUntrusted){this.notice='Etkin denemenin kaydı önce doğrulanmalı.';return;}
      if(this.activeAttempt){this.notice='Tam denemeden önce yarım kalan konu çalışmasını sonuçlandırın.';return;}
      this.strictBusy=true;
      try{
        const entry=examManifest.readyExams.find(e=>e.path===exam.path&&e.sha256===exam.sha256);const pack=await fetchExamPackage(entry);
        this.strictResultTrusted=true;this.strictView=await strictQueue(()=>services.strict.start(pack));this.strictView=await services.strict.setForeground(this.strictView.id,!document.hidden,this.strictView.revision);
      }catch(error){this.notice=error.message;}finally{this.strictBusy=false;}
    },
    async strictAnswer(optionId){
      if(this.strictBusy||this.strictView?.status!=='active')return;this.strictBusy=true;const questionId=this.strictQuestion().id;
      try{await strictQueue(async()=>{const view=await services.strict.loadView(this.strictView.id);if(view.status!=='active'){this.strictView=view;return;}this.strictView=await services.strict.saveAnswer(view.id,{questionId,selectedOptionId:optionId,expectedRevision:view.revision});});}catch(error){this.notice=error.message;}finally{this.strictBusy=false;}
    },
    async strictMove(index){
      if(this.strictBusy)return;this.strictBusy=true;
      try{await strictQueue(async()=>{const view=await services.strict.loadView(this.strictView.id);if(view.status==='active')this.strictView=await services.strict.setCursor(view.id,index,view.revision);else this.strictView=view;});}catch(error){this.notice=error.message;}finally{this.strictBusy=false;}
    },
    async finishStrict(){
      if(this.strictView?.status!=='active'||this.strictBusy)return;
      if(!confirm('Deneme bitirilecek. Boş bırakılan sorular boş sayılacak. Sonuçlandırılsın mı?'))return;
      this.strictBusy=true;try{await strictQueue(async()=>{const view=await services.strict.loadView(this.strictView.id);this.strictView=await services.strict.finish(view.id,view.revision);this.strictHistory=await services.strict.listSummaries();});}catch(error){this.notice=error.message;}finally{this.strictBusy=false;}
    },
    async openStrictResult(id){try{const record=(await services.strict.exportData()).attempts.find(a=>a.id===id);this.strictResultTrusted=Boolean(record&&await trustedExam(record));this.strictView=await services.strict.loadView(id);}catch(error){this.notice=error.message;}},
    closeStrictResult(){if(this.strictView?.status==='completed')this.strictView=null;},
    async exportFullBackup(){try{const backup=await withLock('exclusive',fullSnapshot);saveFile(backup,'gys-tam-yedek.json');}catch(error){this.notice=error.message;}},
    async prepareRestore(event){
      if(this.savingAnswer||this.strictView?.status==='active'){this.notice='Aktif sınav veya kayıt işlemi sırasında geri yükleme yapılamaz.';return;}
      try{const file=event.target.files[0];if(!file)return;if(file.size>32*1024*1024)throw new Error('Yedek32 MiB sınırını aşıyor.');this.restoreProposal=await prepareFullRestore(await file.text(),{validators,current:await fullSnapshot()});this.notice='Yedek doğrulandı. Aşağıdaki kayıt sayılarını inceleyip profil değişimini onaylayabilirsiniz.';}catch(error){this.notice=error.message;this.restoreProposal=null;}
    },
    async commitRestore(){
      const proposal=this.restoreProposal;if(!proposal||this.toolBusy)return;
      if(!confirm('Doğrulanan tam yedek yeni veri profili olarak açılacak. Mevcut profil ve eski veriler korunur. Devam edilsin mi?'))return;
      this.toolBusy=true;
      try{
        const payload=proposal.backup.payload;const staging=makeServices(proposal.profileId);const journal=createAttemptStore('gys_attempts_v1:'+proposal.profileId);
        await journal.importJournal(copy(payload.journal));if(payload.learning)await staging.learning.importData(copy(payload.learning));if(payload.strict)await staging.strict.importData(copy(payload.strict));if(payload.focus)await staging.focus.importData(copy(payload.focus));if(payload.planner?.watch)await staging.watch.importData(copy(payload.planner.watch));
        await journal.close();await Promise.all(Object.values(staging).map(service=>service.close()));
        await withLock('exclusive',()=>backupStore.commitPrepared(proposal,{approved:true,expectedRevision:activeProfile?.revision||0}));
        channel?.postMessage({profileId:proposal.profileId});location.reload();
      }catch(error){this.notice=error.message;}finally{this.toolBusy=false;}
    },
    async exportPdf(){
      this.toolBusy=true;try{
        if(!this.studyPlan)await this.refreshPlan();const {generateProgressPdf,downloadProgressPdf}=await import('./report-export');
        const bytes=await generateProgressPdf({generatedAt:new Date().toISOString(),examDate:'2027-02-27',targetScore:85,legalEdition:'preparation',summary:{totalAnswered:this.state.totalAnswered,uniqueSolved:this.journalProgress?.uniqueSolved||0,correct:this.state.totalCorrect,wrong:this.state.totalAnswered-this.state.totalCorrect,blank:0,publishedStudyQuestions:this.approvedQuestionCount(),coveragePercent:null,masteryPercent:null,estimatedScore:this.forecast?.score??null},topics:TOPICS.map(topic=>{const display=this.curriculum.find(t=>t.code===topic.id);const stats=this.state.topicStats[display.topic]||{answered:0,correct:0};return{id:topic.id,name:topic.title,correct:stats.correct,wrong:stats.answered-stats.correct,blank:0};}),attempts:this.completedAttempts.map(a=>({title:a.title,finishedAt:a.finishedAt,correct:a.result.correct,wrong:a.result.wrong,blank:a.result.blank,total:a.questionCount,isFirstAttempt:a.isFirstAttempt})),plan:(this.studyPlan?.days[0]?.tasks||[]).map(t=>({title:t.title,reason:t.reason,minutes:t.minutes,questionCount:t.questionCount,sourceLocator:t.sourceLocator})),sources:repository.loadedChunks().flatMap(c=>c.snapshots.map(s=>({title:s.sourceId,url:s.sourceUrl,locator:s.version}))),notes:['Hazırlık mevzuatıdır; nihai2027 sürümü kesinleşmedi.','PDF okunabilir rapordur; geri yükleme kaynağı değildir.']});
        downloadProgressPdf(bytes);
      }catch(error){this.notice=error.message;}finally{this.toolBusy=false;}
    },
  };
}
