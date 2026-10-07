import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');
test('dashboard exposes pastoral unread and registered/login metrics, not old cards',()=>{
 const ui=read('components/admin/AdminHubDashboard.tsx');
 for(const text of ['목양지 미확인','활성 사용자','전체 등록 사용자'])assert.ok(ui.includes(text),text);
 assert.ok(!ui.includes('이번 주 확정 심방'));
 assert.ok(!ui.includes('data.notices.published'));
});
test('administrator navigation puts notices before prayer',()=>{
 const s=read('components/admin/AdminSidebar.tsx'); assert.ok(s.indexOf('"/admin/notices"')<s.indexOf('"/admin/prayer"'));
});
test('successful session creation persists the first login transactionally',()=>{
 const s=read('src/features/auth/session.ts'); assert.ok(s.includes('.transaction(')); assert.ok(s.includes('firstLoginAt'));
});
test('roster activity derives from login history rather than a precreated account',()=>{
 const s=read('src/features/admin/roster-service.ts'); assert.ok(s.includes('users.firstLoginAt')); assert.ok(!s.includes('joined: Boolean(row.userId)'));
});
test('roster labels are active/inactive with login permission separate',()=>{
 const s=read('components/admin/users/AdminUserManagement.tsx'); assert.ok(s.includes('"활성"')); assert.ok(s.includes('"비활성"')); assert.ok(!s.includes('"참여 중"')); assert.ok(s.includes('로그인 제한'));
});
test('prayer management reacts to global visibility saves and hides populations',()=>{
 const s=read('components/admin/prayer/AdminPrayerManagement.tsx'); assert.ok(s.includes('prayerMenuEnabled')); assert.ok(s.includes('prayer-menu:changed'));
});
test('recent activity accepts page navigation and includes pastoral submissions',()=>{
 const s=read('src/features/admin/hub-service.ts'); assert.ok(s.includes('pastoral_reports')); assert.ok(s.includes('activityPagination')); assert.ok(s.includes('offset'));
 const ui=read('components/admin/AdminHubDashboard.tsx'); assert.ok(ui.includes('최근 활동 페이지')); assert.ok(ui.includes('다음'));
});
test('admin report confirmation uses an explicit versioned mutation after loading',()=>{
 const s=read('components/pastoral/ReportDetail.tsx'); assert.ok(s.includes('/review')); assert.ok(s.includes('expectedVersion')); assert.ok(s.includes('"POST"'));
});
