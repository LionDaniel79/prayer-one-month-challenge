import test from "node:test";
import assert from "node:assert/strict";
import {activityPagination,parseActivityPage,hasLoginHistory,reviewPending,ACTIVITY_PAGE_SIZE} from "../../src/features/admin/metrics-policy.ts";

test("active means a historical successful login, not permission or prayer",()=>{
  assert.equal(hasLoginHistory(null),false); assert.equal(hasLoginHistory(undefined),false);
  assert.equal(hasLoginHistory("2026-01-01T00:00:00Z"),true);
  assert.equal(hasLoginHistory(new Date("2026-01-01")),true);
});
test("exactly ten activity entries per page including boundaries",()=>{
  assert.equal(ACTIVITY_PAGE_SIZE,10);
  assert.deepEqual(activityPagination(2,23),{page:2,pages:3,total:23,pageSize:10,offset:10});
  assert.deepEqual(activityPagination(3,20),{page:2,pages:2,total:20,pageSize:10,offset:10});
  assert.equal(activityPagination(1,10).pages,1);
});
test("empty and removed last pages clamp safely",()=>{
  assert.deepEqual(activityPagination(100,0),{page:1,pages:1,total:0,pageSize:10,offset:0});
});
test("page input is validated, not interpolated as SQL or unbounded offsets",()=>{
  assert.equal(parseActivityPage(null),1);assert.equal(parseActivityPage("2"),2);
  for(const s of ["", "0", "-1", "1.5", "Infinity", "1 OR 1=1", "100001", "1e2"])assert.throws(()=>parseActivityPage(s));
  for(const n of [0,-1,NaN,Infinity,1.5,100001])assert.throws(()=>activityPagination(n,50));
});
test("drafts do not count as unreviewed and initial version zero does",()=>{
  assert.equal(reviewPending(null,0,-1),false);
  assert.equal(reviewPending("2026-10-07",0,-1),true);
  assert.equal(reviewPending("2026-10-07",0,0),false);
});
test("a newly committed revision is unreviewed until that exact version is seen",()=>{
  assert.equal(reviewPending("2026-10-07",1,0),true);
  assert.equal(reviewPending("2026-10-07",1,1),false);
});
