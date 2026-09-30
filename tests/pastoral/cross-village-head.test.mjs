import test from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../../src/features/pastoral/policy.ts';

// Synthetic identities only. Home membership and assigned responsibility differ.
const local = {id:'local',sourceName:'가상동명A',canonicalName:'가상동명',village:'3',samLabel:'3-2',isActive:true};
const outside = {id:'outside',sourceName:'가상동명B',canonicalName:'가상동명',village:'4',samLabel:'4-1',isActive:true};
const target = {kind:'village',name:'3마을장',scope:'3',leaderName:'가상동명'};
const head = {id:'head',name:target.name,village:'3',leaderName:target.leaderName,isActive:true,leaderRosterId:outside.id,leaderBindingLocked:true};
const sams = [
  {id:'s3a',name:'3-1',village:'3',leaderName:'',isActive:true},
  {id:'s3b',name:'3-2',village:'3',leaderName:'',isActive:true},
  {id:'s4',name:'4-1',village:'4',leaderName:'',isActive:true},
  {id:'s5',name:'5-1',village:'5',leaderName:'',isActive:true},
];
const actor={id:'user',displayName:'가상동명',role:'member'};

test('both active namesakes are eligible for village-head selection despite different home villages',()=>{
  assert.equal(p.leaderInScope(target,local),true);
  assert.equal(p.leaderInScope(target,outside),true);
  assert.throws(()=>p.selectLeaderIdentity(target,[local,outside]),{code:'LEADER_SELECTION_REQUIRED'});
  assert.deepEqual(p.selectLeaderIdentity(target,[local,outside],null,outside.id),{rosterId:outside.id,locked:true});
});
test('a unique active name outside the assigned village links without a duplicate selector',()=>{
  assert.deepEqual(p.selectLeaderIdentity(target,[outside]),{rosterId:outside.id,locked:true});
});
test('bound outside-village head receives only the assigned village, never automatic home-village authority',()=>{
  const access=p.deriveAccess(actor,outside,sams,[local,outside],[head]);
  assert.equal(access.visible,true);
  assert.deepEqual(access.sams.map(s=>s.id),['s3a','s3b']);
  assert.deepEqual(access.requiredSamIds,[]);
  assert.equal(p.deriveAccess(actor,local,sams,[local,outside],[head]).visible,false);
});
test('inactive or removed identity and inactive assignment never confer village-head authority',()=>{
  assert.deepEqual(p.automaticVillageLeaders([head],[{...outside,isActive:false}]),[]);
  assert.deepEqual(p.automaticVillageLeaders([head],[local]),[]);
  assert.deepEqual(p.automaticVillageLeaders([{...head,isActive:false}],[outside]),[]);
});
test('later home membership changes preserve the bound head ID and assigned village',()=>{
  const moved={...outside,village:'5',samLabel:'5-1'};
  assert.deepEqual(p.selectLeaderIdentity(target,[local,moved],head),{rosterId:outside.id,locked:true});
  assert.deepEqual(p.deriveAccess(actor,moved,sams,[local,moved],[head]).sams.map(s=>s.id),['s3a','s3b']);
});
test('sam leaders still require membership in the assigned sam',()=>{
  const samTarget={kind:'sam',name:'3-2',scope:'3-2',leaderName:target.leaderName};
  assert.equal(p.leaderInScope(samTarget,outside),false);
  assert.throws(()=>p.selectLeaderIdentity(samTarget,[local,outside],null,outside.id),{code:'LEADER_SELECTION_INVALID'});
});
test('a separate own-sam leadership combines with, but does not widen, the assigned village scope',()=>{
  const dual=sams.map(s=>s.id==='s4'?{...s,leaderName:outside.sourceName,leaderRosterId:outside.id,leaderBindingLocked:true}:s);
  const access=p.deriveAccess(actor,outside,dual,[local,outside],[head]);
  assert.deepEqual(access.sams.map(s=>s.id),['s3a','s3b','s4']);
  assert.deepEqual(access.requiredSamIds,['s4']);
});
