import 'fake-indexeddb/auto';
import { reactive } from '@vue/reactivity';
import { afterEach, expect, it } from 'vitest';
import { profileStorage } from '../src/feature-controller';
import { createFullBackup, prepareFullRestore, createFullBackupStore } from '../src/full-backup';

const stores=[];
afterEach(async()=>{await Promise.all(stores.splice(0).map(store=>store.close()));});
function input(){return {legacyWorkspace:{schemaVersion:1,state:{xp:0,dailyXP:0,streak:0,hearts:3,totalAnswered:0,totalCorrect:0,lastActiveDate:null,settings:{quizSize:5,dailyGoal:100,mixMistakes:false,examMode:false,sound:false},topicStats:{},mistakes:{},customWeights:{}},questions:[]},journal:{kind:'gys-study-journal',schemaVersion:1,exportedAt:'2026-11-06T12:00:00.000Z',attempts:[]}};}

it('Alpine reactive state retains the frozen reviewed proposal identity required by WeakMap authorization',async()=>{
  // Alpine 3.15.8 uses this installed Vue reactivity engine.
  const proposal=await prepareFullRestore(await createFullBackup(input()));
  const state=reactive({restoreProposal:null});state.restoreProposal=proposal;
  expect(state.restoreProposal).toBe(proposal);
  const store=createFullBackupStore('backup-review-'+crypto.randomUUID());stores.push(store);
  const active=await store.commitPrepared(state.restoreProposal,{approved:true,expectedRevision:0});
  expect(active.profileId).toBe(proposal.profileId);
});

it('restored profile storage reads the verified snapshot but writes only its own namespace',async()=>{
  const backup=await createFullBackup(input());
  const values=new Map([['gys_duo_state_v1','ORIGINAL_V1_STATE'],['gys_duo_questions_v1','ORIGINAL_V1_QUESTIONS'],['gys_v4_workspace_v1','ORIGINAL_V4']]);
  const original={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const profile={profileId:'restore_test-profile',backup};const adapter=profileStorage(original,profile);
  expect(adapter.getItem('gys_v4_workspace_v1')).toBeNull();
  expect(JSON.parse(adapter.getItem('gys_duo_state_v1')).hearts).toBe(3);
  expect(JSON.parse(adapter.getItem('gys_duo_questions_v1'))).toEqual([]);
  adapter.setItem('gys_v4_workspace_v1','NEW_PROFILE_V4');
  expect(adapter.getItem('gys_v4_workspace_v1')).toBe('NEW_PROFILE_V4');
  expect(values.get('gys-profile:restore_test-profile:gys_v4_workspace_v1')).toBe('NEW_PROFILE_V4');
  expect(original.getItem('gys_v4_workspace_v1')).toBe('ORIGINAL_V4');
  expect(original.getItem('gys_duo_state_v1')).toBe('ORIGINAL_V1_STATE');
  expect(original.getItem('gys_duo_questions_v1')).toBe('ORIGINAL_V1_QUESTIONS');
});
