import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { e2eAccounts } from "../fixtures/e2e-data";
import { login } from "./helpers";

test("pending metadata is packed before pagination and tracks completion, review and revision", async ({ page, request }) => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Disposable TLS CI database required");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (process.env.CI !== "true" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/prayer_e2e") throw new Error("DISPOSABLE_DATABASE_REQUIRED");
  const db = postgres(url.toString(), { ssl: "require", prepare: false, max: 1 });
  const prayerIds = Array.from({ length: 7 }, () => randomUUID()), visitIds = Array.from({ length: 7 }, () => randomUUID());
  const reportIds = Array.from({ length: 4 }, () => randomUUID()), samId = randomUUID(), requestId = randomUUID(), noticeId = randomUUID();
  const form = { noMeeting: false, noMeetingReason: "", meetings: [], sharing: [], news: [], leaderPrayer: "", other: "PRIVATE_REPORT_BODY" };
  try {
    await login(page, "admin");
    const get = async (n: number) => { const response = await page.request.get(`/api/admin/notifications?page=${n}`); expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toContain("no-store"); return response.json(); };
    const before = await get(1);
    await db`insert into prayer_app.sams(id,name,leader_name) values(${samId},${'알림검증-'+samId.slice(0,8)},'가상리더')`;
    await db`insert into prayer_app.pastoral_requests(id,year,month,enabled) values(${requestId},2098,11,false)`;
    for (let i = 0; i < prayerIds.length; i++) await db`insert into prayer_app.prayer_requests(id,user_id,content,status,created_at)
      values(${prayerIds[i]},${e2eAccounts.member.userId},'PRIVATE_PRAYER_BODY',${i<3?'received':i<5?'praying':'completed'},'2099-01-01'::timestamptz+${i}*interval '1 second')`;
    for (let i = 0; i < visitIds.length; i++) await db`insert into prayer_app.visit_requests(id,requester_user_id,visit_date,visit_type,attendees,location,preferred_time,reason,status,calendar_sync_status,created_at)
      values(${visitIds[i]},${e2eAccounts.member.userId},'2099-02-01'::date+${i}::int,'personal','','','','PRIVATE_VISIT_REASON',${i<3?'requested':i<5?'confirmed':i===5?'completed':'cancelled'},'synced','2099-01-02'::timestamptz+${i}*interval '1 second')`;
    for (let i = 0; i < reportIds.length; i++) await db`insert into prayer_app.pastoral_reports(id,request_id,sam_id,author_user_id,sam_name,village,leader_name,submitted_by,written_date,method,form,files,fingerprint,submitted_at,version,reviewed_version)
      values(${reportIds[i]},${requestId},${samId},${e2eAccounts.member.userId},'가상샘','1','가상리더','가상제출자','2099-01-03','form',${db.json(form)},'[]',${'a'.repeat(64)},${i===3?null:'2099-01-03T00:00:00Z'},0,${i===2?0:-1})`;
    await db`insert into prayer_app.notices(id,title,body,status,author_user_id,published_at) values(${noticeId},'공지는제외','PRIVATE_NOTICE_BODY','published',${e2eAccounts.admin.userId},'2099-01-04')`;
    const first = await get(1), second = await get(2), third = await get(3);
    expect(first.activityPagination.total).toBe(before.activityPagination.total + 12);
    expect(first.recentActivity).toHaveLength(5); expect(second.recentActivity).toHaveLength(5);
    const expected = new Set<string>([...prayerIds.slice(0,5), ...visitIds.slice(0,5), ...reportIds.slice(0,2)]);
    const top = [...first.recentActivity,...second.recentActivity,...third.recentActivity].filter((row: { href: string }) => expected.has(new URL(row.href,"https://example.test").searchParams.get("id")!));
    expect(top).toHaveLength(12); expect(new Set(top.map(row => row.href)).size).toBe(12);
    expect(JSON.stringify(first)+JSON.stringify(second)+JSON.stringify(third)).not.toMatch(/PRIVATE_|공지는제외/);
    const last = await get(100000); expect(last.activityPagination.page).toBe(last.activityPagination.pages); expect(last.recentActivity.length).toBe((first.activityPagination.total-1)%5+1);
    expect((await request.get("/api/admin/notifications")).status()).toBe(403);
    expect((await page.request.patch(`/api/admin/prayer-requests/${prayerIds[0]}`,{data:{status:"completed"}})).status()).toBe(200);
    expect((await page.request.post(`/api/admin/visits/${visitIds[3]}/complete`)).status()).toBe(200);
    expect((await page.request.post(`/api/admin/pastoral/reports/${reportIds[0]}/review`,{data:{expectedVersion:0}})).status()).toBe(200);
    expect((await get(1)).activityPagination.total).toBe(first.activityPagination.total-3);
    await db`update prayer_app.pastoral_reports set version=1 where id=${reportIds[0]}`;
    expect((await get(1)).activityPagination.total).toBe(first.activityPagination.total-2);
  } finally {
    await db`delete from prayer_app.prayer_requests where id in ${db(prayerIds)}`;
    await db`delete from prayer_app.visit_requests where id in ${db(visitIds)}`;
    await db`delete from prayer_app.pastoral_reports where id in ${db(reportIds)}`;
    await db`delete from prayer_app.pastoral_requests where id=${requestId}`;
    await db`delete from prayer_app.sams where id=${samId}`;
    await db`delete from prayer_app.notices where id=${noticeId}`;
    await db.end();
  }
});
