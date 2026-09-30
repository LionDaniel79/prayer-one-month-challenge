import test from 'node:test';
import assert from 'node:assert/strict';
const p = await import('../../src/features/pastoral/policy.ts');
const now = new Date('2026-09-29T16:00:00Z');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const schedule = (selected) => ({year:2026,expectedVersion:0,selected});
const sample = () => ({id:id(1),requestId:id(2),samId:id(3),method:'form',writtenDate:'2026-09-30',form:{noMeeting:false,meetings:[{when:'2026-09-20 14:00',place:'모임 장소',attendees:'가상가정 2가정'}],sharing:[{member:'가상샘원',content:'감사 제목'}],visits:[{member:'가상샘원',when:'일정 협의',place:'방문 장소',reason:'상담 요청'}],news:[{member:'가상샘원',content:'샘 소식'}],leaderPrayer:'리더 기도제목'},files:[]});
test('exports the pastoral policy',()=>assert.equal(typeof p.parseSchedule,'function'));
test('Seoul midnight and year rollover',()=>{assert.equal(p.seoulToday(now),'2026-09-30');assert.equal(p.seoulToday(new Date('2026-12-31T15:01:00Z')),'2027-01-01');});
test('calendar accepts this and next year only',()=>{assert.equal(p.parseSchedule({...schedule([]),year:2027},now).year,2027);for(const year of [2025,2028,0,'2026'])assert.throws(()=>p.parseSchedule({...schedule([]),year},now));});
test('year validation moves at Seoul New Year',()=>{assert.equal(p.parseSchedule({year:2028,expectedVersion:0,selected:[]},new Date('2026-12-31T15:01:00Z')).year,2028);});
test('empty schedule is an explicit cancel all',()=>assert.deepEqual(p.parseSchedule(schedule([]),now).selected,[]));
const roster=(n,name='가상리더',sam='3-4',village='3')=>({id:id(n),sourceName:name,canonicalName:name,samLabel:sam,village,isActive:true});
const sams=[{id:id(30),name:'3-4',leaderName:'가상리더',isActive:true,village:'3'},{id:id(31),name:'4-1',leaderName:'다른리더',isActive:true,village:'4'}];
const user={id:id(100),role:'member',displayName:'가상리더'};
test('ordinary member cannot gain access from display name alone',()=>assert.equal(p.deriveAccess(user,roster(5,'일반회원'),sams,[roster(5,'일반회원')],[]).visible,false));
test('unique stored roster name and same sam grant leader only that sam',()=>{const r=roster(5);const a=p.deriveAccess(user,r,sams,[r],[]);assert.deepEqual(a.requiredSamIds,[id(30)]);assert.equal(a.sams.length,1);});
test('same name at different sam never receives leader role',()=>{const r=roster(5,'가상리더','4-1','4');assert.equal(p.deriveAccess(user,r,sams,[r],[]).visible,false);});
test('ambiguous duplicate stored names fail closed',()=>{const r=roster(5);assert.equal(p.deriveAccess(user,r,sams,[r,roster(6)],[]).visible,false);});
test('excess form rows rejected',()=>assert.throws(()=>p.parseSubmission({...sample(),form:{sharing:Array.from({length:41},()=>({member:'a',content:'b'}))}})));
const file=(name='목양지.pdf',size=6291456)=>({name,size,sha256:'a'.repeat(64)});
test('two full sized documents accepted with no text form',()=>assert.equal(p.parseSubmission({...sample(),method:'file',form:null,files:[file(),file('기록.hwp')]}).files.length,2));
test('file number, empty, too large and unsupported types rejected',()=>{for(const files of [[],[file(),file(),file()],[file('x.pdf',6291457)],[file('x.pdf',0)],[file('x.html')],[file('../x.pdf')],[file('x\n.pdf')],[file('x.exe')]])assert.throws(()=>p.parseSubmission({...sample(),method:'file',form:null,files}));});
test('photo names must be photo formats',()=>{assert.equal(p.parseSubmission({...sample(),method:'photo',form:null,files:[file('사진.HEIC')]}).files.length,1);assert.throws(()=>p.parseSubmission({...sample(),method:'photo',form:null,files:[file()]}));});
test('text entry cannot smuggle uploaded files',()=>assert.throws(()=>p.parseSubmission({...sample(),files:[file()]})));
test('chunk count and exact sizes include max-boundary',()=>{assert.equal(p.chunkSize(6291456,11),524288);assert.equal(p.chunkSize(524289,1),1);assert.throws(()=>p.chunkSize(6291456,12));});
test('non-text reports cannot create misleading TXT',()=>assert.throws(()=>p.reportText({...sample(),method:'photo',form:null,samName:'3-4',leaderName:'x',submittedBy:'y',periodLabel:'x'})));
test('reject cross-site writes including null origins',()=>{for(const headers of [{origin:'https://evil.example'},{origin:'null'},{'sec-fetch-site':'cross-site'}])assert.throws(()=>p.checkOrigin(new Request('https://app.example/api/pastoral/reports',{method:'POST',headers})));});
test('accept same origin and native non-browser API requests',()=>{assert.doesNotThrow(()=>p.checkOrigin(new Request('https://app.example/api',{headers:{origin:'https://app.example'}})));assert.doesNotThrow(()=>p.checkOrigin(new Request('https://app.example/api')));});
test('bounded body detects explicit too-large and invalid content lengths',async()=>{for(const length of ['10','-1','x'])await assert.rejects(p.readLimited(new Request('https://app.example/api',{method:'POST',headers:{'content-length':length},body:'12345'}),5));});
test('bounded body checks actual bytes when length header is absent',async()=>{await assert.rejects(p.readLimited(new Request('https://app.example/api',{method:'POST',body:'123456'}),5));assert.equal(new TextDecoder().decode(await p.readLimited(new Request('https://app.example/api',{method:'POST',body:'12345'}),5)),'12345');});
test('JSON requires exact media type and valid syntax',async()=>{await assert.rejects(p.readReportJson(new Request('https://app.example/api',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})));await assert.rejects(p.readReportJson(new Request('https://app.example/api',{method:'POST',headers:{'content-type':'application/json'},body:'{'})));assert.deepEqual(await p.readReportJson(new Request('https://app.example/api',{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:'{"a":1}'})),{a:1});});
test('photo sniffing rejects SVG HTML and supports actual raster signatures',()=>{assert.equal(p.isRaster(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),false);assert.equal(p.isRaster(new TextEncoder().encode('<html>')),false);assert.equal(p.isRaster(Buffer.from('89504e470d0a1a0a','hex')),true);assert.equal(p.isRaster(Buffer.from('ffd8ffe000104a464946','hex')),true);});
test('directory leader bindings share the same unique-match authorization rule',()=>{const r=roster(5);assert.deepEqual(p.automaticLeaders(sams,[r]),[{samId:id(30),rosterId:r.id,name:r.sourceName}]);});
test('directory leader bindings exclude ambiguous and inactive entries',()=>{assert.deepEqual(p.automaticLeaders(sams,[roster(5),roster(6)]),[]);assert.deepEqual(p.automaticLeaders(sams,[{...roster(5),isActive:false}]),[]);});
test('directory leader bindings preserve name suffixes and reject inactive sams',()=>{assert.deepEqual(p.automaticLeaders(sams,[roster(5,'가상리더A')]),[]);assert.deepEqual(p.automaticLeaders(sams.map(s=>({...s,isActive:false})),[roster(5)]),[]);});

test('monthly schedule has only year/month and rejects legacy week/windows',()=>{
 const result=p.parseSchedule(schedule([{month:10},{month:1}]),now);
 assert.deepEqual(result.selected,[{month:1},{month:10}]);
 for(const extra of [{week:1},{week:0},{startDate:'2026-10-01'},{endDate:'2026-10-31'}]) assert.throws(()=>p.parseSchedule(schedule([{month:10,...extra}]),now));
 assert.throws(()=>p.parseSchedule(schedule([{month:1},{month:1}]),now));
});
test('month toggle is reversible and twelve months stay in order',()=>{let v=[]; for(let m=12;m>=1;m--)v=p.toggleMonth(v,m);assert.deepEqual(v.map(x=>x.month),Array.from({length:12},(_,i)=>i+1));assert.equal(p.toggleMonth(v,1).length,11);});
test('only the actual calendar month is open, including Seoul year rollover',()=>{
 const r={id:id(1),enabled:true,year:2026,month:10};
 assert.equal(p.requestState(r,false,'2026-09-30'),'upcoming');
 for(const date of ['2026-10-01','2026-10-31']) assert.equal(p.requestState(r,false,date),'pending');
 assert.equal(p.requestState(r,false,'2026-11-01'),'closed');
 assert.equal(p.requestState({...r,enabled:false},false,'2026-10-01'),'cancelled');
 assert.equal(p.requestState(r,true,'2026-11-01'),'submitted');
 assert.equal(p.periodBounds(2028,2).endDate,'2028-02-29');
});
test('badge ignores prior future and deselected months and deduplicates completions',()=>{
 const req=[{id:id(1),enabled:true,year:2026,month:9},{id:id(2),enabled:true,year:2026,month:10},{id:id(3),enabled:false,year:2026,month:9},{id:id(4),enabled:true,year:2026,month:8}];
 assert.equal(p.countMissing(req,[id(30),id(30)],[],'2026-09-30'),1);
 for(const method of ['photo','file','form']) assert.equal(p.countMissing(req,[id(30)],[{requestId:id(1),samId:id(30),method}],'2026-09-30'),0);
 assert.equal(p.countMissing(req,[id(30)],[{requestId:id(1),samId:id(30)}],'2026-10-01'),1);
 assert.equal(p.countMissing(req,[id(30)],[],'2026-11-01'),0);
});
test('all ordinary form fields may be empty; partial rows are accepted',()=>{
 const empty=p.parseSubmission({...sample(),form:{}});assert.equal(empty.form.leaderPrayer,'');assert.deepEqual(empty.form.meetings,[]);
 const partial=p.parseForm({sharing:[{content:'감사'}]});assert.equal(partial.sharing[0].member,'');
});
test('no meeting requires a reason, trims it, and discards obsolete meeting entries',()=>{
 for(const reason of [undefined,'','   '])assert.throws(()=>p.parseForm({noMeeting:true,noMeetingReason:reason}),/NO_MEETING_REASON_REQUIRED/);
 const f=p.parseForm({noMeeting:true,noMeetingReason:'  일정 조정  ',meetings:[{when:'예전 입력'}]});assert.equal(f.noMeetingReason,'일정 조정');assert.deepEqual(f.meetings,[]);
 assert.equal(p.parseForm({noMeeting:false,noMeetingReason:'이전 사유'}).noMeetingReason,'');
});
test('date defaults to Seoul today; community and forged submitter are not accepted as identity',()=>{
 const result=p.parseSubmission({...sample(),writtenDate:undefined,community:'위조',submittedBy:'다른이'},now);
 assert.equal(result.writtenDate,'2026-09-30');assert.ok(!('community' in result));assert.ok(!('submittedBy' in result));
 assert.equal(p.parseSubmission({...sample(),writtenDate:'2026-09-01'},now).writtenDate,'2026-09-01');
 assert.throws(()=>p.parseSubmission({...sample(),writtenDate:'2026-02-30'},now));
});
test('village directory input requires numbered village head label and stored name',()=>{
 assert.deepEqual(p.parseVillageLeader({name:' 01 마을장 ',leaderName:' 가상마을장 ',isActive:true}),{name:'1마을장',village:'1',leaderName:'가상마을장',isActive:true});
 for(const name of ['1-2','0마을장','마을장','1마을','x마을장'])assert.throws(()=>p.parseVillageLeader({name,leaderName:'가상마을장'}));
 assert.throws(()=>p.parseVillageLeader({name:'1마을장',leaderName:''}));
});
test('village leader is mapped by unique name and same village, without grant management',()=>{
 const person=roster(20,'가상마을장','3-2','3');const heads=[{id:id(41),name:'3마을장',village:'3',leaderName:'가상마을장',isActive:true}];
 const access=p.deriveAccess(user,person,sams,[person],heads);assert.equal(access.visible,true);assert.deepEqual(access.sams.map(s=>s.id),[id(30)]);assert.deepEqual(access.requiredSamIds,[]);
 assert.equal(p.deriveAccess(user,{...person,village:'4'},sams,[{...person,village:'4'}],heads).visible,false);
 assert.equal(p.deriveAccess(user,person,sams,[person,roster(21,'가상마을장','3-3','3')],heads).visible,false);
 assert.equal(p.deriveAccess(user,person,sams,[person],heads.map(h=>({...h,isActive:false}))).visible,false);
});
test('inactive roster and ambiguous name suffix do not acquire village authority',()=>{
 const person=roster(20,'가상마을장A','3-2','3');const heads=[{id:id(41),name:'3마을장',village:'3',leaderName:'가상마을장',isActive:true}];
 assert.equal(p.deriveAccess(user,person,sams,[person],heads).visible,false);
});
test('TXT matches reduced header and includes no-meeting reason with optional empty sections',()=>{
 const report=p.parseSubmission({...sample(),form:{noMeeting:true,noMeetingReason:'모임 일정 조정'}});
 const txt=p.reportText({...report,samName:'3-4',leaderName:'가상리더',submittedBy:'현재입력자',periodLabel:'2026년 9월'});
 for(const str of ['현재입력자','작성일','모임 일정 조정','샘소식','샘리더 기도제목'])assert.ok(txt.includes(str));
 assert.ok(!txt.includes('공동체:'));assert.ok(!txt.includes('undefined'));assert.ok(!txt.includes('[object Object]'));
});
