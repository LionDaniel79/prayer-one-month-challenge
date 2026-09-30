import test from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../../src/features/pastoral/policy.ts';
const id='00000000-0000-4000-8000-000000000010';
const person={id,sourceName:'가상마을장A',canonicalName:'가상마을장',samLabel:'1-1',village:'1마을',isActive:true};
const head={id:'head',name:'1마을장',village:'1',leaderName:'가상마을장',isActive:true};
test('village head matches unique canonical name in assigned village',()=>{
 assert.deepEqual(p.automaticVillageLeaders([head],[person]),[{village:'1',rosterId:id}]);
});
test('canonical names never grant ambiguous or different-village identities',()=>{
 assert.deepEqual(p.automaticVillageLeaders([head],[person,{...person,id:'another',sourceName:'가상마을장B'}]),[]);
 assert.deepEqual(p.automaticVillageLeaders([head],[{...person,village:'2마을'}]),[]);
 assert.deepEqual(p.automaticVillageLeaders([head],[{...person,isActive:false}]),[]);
});
test('other is optional and retained; retired visits not accepted in new form',()=>{
 assert.equal(p.parseForm({}).other,'');
 const f=p.parseForm({other:' 기타 내용 ',visits:[{reason:'old'}]});
 assert.equal(f.other,'기타 내용');assert.equal('visits' in f,false);
 assert.throws(()=>p.parseForm({other:'x'.repeat(5001)}));
});
test('TXT includes other after leader prayer but not retired section or submitted timestamp',()=>{
 const t=p.reportText({method:'form',writtenDate:'2026-09-30',form:{...p.parseForm({other:'기타 내용'}),visits:[{reason:'legacy'}]},samName:'1-1',leaderName:'가상',submittedBy:'가상',periodLabel:'2026년 9월',submittedAt:'TIME'});
 assert.ok(t.includes('■ 기타\n기타 내용'));assert.ok(t.indexOf('■ 기타')>t.indexOf('■ 샘리더 기도제목'));assert.ok(!t.includes('상담/심방'));assert.ok(!t.includes('제출일시'));
});
test('revision metadata permits retained attachment and optional form but validates version and slot count',()=>{
 assert.equal(typeof p.parseReportEdit,'function');
 const base={id,expectedVersion:0,method:'file',writtenDate:'2026-09-30',keepSlots:[0],files:[]};
 assert.deepEqual(p.parseReportEdit(base).keepSlots,[0]);
 assert.throws(()=>p.parseReportEdit({...base,keepSlots:[0,0]}));
 assert.throws(()=>p.parseReportEdit({...base,expectedVersion:-1}));
 assert.throws(()=>p.parseReportEdit({...base,method:'form'}));
 assert.equal(p.parseReportEdit({...base,method:'form',keepSlots:[],form:{}}).form.other,'');
});
test('completed report mutation is owner-only unless explicitly admin operation',()=>{
 assert.equal(typeof p.assertReportMutation,'function');
 const a={id:'a',role:'member'};const report={authorId:'a',submittedAt:'yes'};
 p.assertReportMutation(a,report,false);
 assert.throws(()=>p.assertReportMutation({id:'b',role:'member'},report,false));
 assert.throws(()=>p.assertReportMutation({id:'b',role:'admin'},report,false));
 p.assertReportMutation({id:'b',role:'admin'},report,true);
 assert.throws(()=>p.assertReportMutation(a,report,true));
 assert.throws(()=>p.assertReportMutation(a,{...report,submittedAt:null},false));
});
