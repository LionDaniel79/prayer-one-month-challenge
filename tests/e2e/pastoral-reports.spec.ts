import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import sharp from "sharp";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { hashPhonePassword, normalizeName, phoneLookupHash } from "../../src/features/auth/crypto";
import { encryptRosterPhone } from "../../src/features/roster/crypto";
import { seoulToday, type Submission } from "../../src/features/pastoral/policy";
import { login, expectNoOverflow } from "./helpers";

// These tests must never run against the user's Supabase project.
test.describe("private pastoral reports", () => {
  test.describe.configure({ mode: "default" });
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable local CI database");
  let db: ReturnType<typeof postgres>;
  const ids = { leader: randomUUID(), head: randomUUID(), outsider: randomUUID(), sam: randomUUID(), otherSam: randomUUID(), foreignSam: randomUUID() };
  const accounts = {
    leader: { name: "목양리더검증", phone: "01000000711", rosterId: randomUUID(), userId: ids.leader },
    head: { name: "목양마을장검증", phone: "01000000712", rosterId: randomUUID(), userId: ids.head },
    outsider: { name: "목양타마을검증", phone: "01000000713", rosterId: randomUUID(), userId: ids.outsider },
  };
  const today = seoulToday(); const year = Number(today.slice(0, 4)); const month = Number(today.slice(5, 7));
  let requestId: string;
  const digest = (data: Buffer) => createHash("sha256").update(data).digest("hex");
  async function loginAs(page: Page, kind: keyof typeof accounts) {
    await page.goto("/login"); await page.getByLabel("이름 (아이디)").fill(accounts[kind].name); await page.getByLabel("비밀번호", { exact: true }).fill(accounts[kind].phone);
    await page.getByRole("button", { name: "로그인", exact: true }).click(); await expect(page).toHaveURL(/\/$/);
  }
  function input(method: "form" | "photo" | "file" = "form", files: { name: string; data: Buffer }[] = []): Submission {
    return { id: randomUUID(), requestId, samId: ids.sam, method, writtenDate: today,
      form: method === "form" ? { noMeeting: false, noMeetingReason: "", meetings: [{ when: today, place: "가상 모임장소", attendees: "가상가정" }], sharing: [{ member: "가상샘원", content: "감사 기도제목" }], visits: [{ member: "가상샘원", when: "협의", place: "가상장소", reason: "비공개 상담 제목" }], news: [{ member: "가상샘원", content: "가상 소식" }], leaderPrayer: "리더 기도제목" } : null,
      files: files.map(f => ({ name: f.name, size: f.data.length, sha256: digest(f.data) })) };
  }
  async function upload(api: APIRequestContext, value: Submission, files: Buffer[]) {
    expect((await api.post("/api/pastoral/reports", { data: value })).status()).toBe(201);
    for (let slot = 0; slot < files.length; slot++) for (let start = 0, i = 0; start < files[slot].length; start += 524288, i++) {
      expect((await api.put(`/api/pastoral/reports/${value.id}/files/${slot}/chunks/${i}`, { headers: { "content-type": "application/octet-stream" }, data: files[slot].subarray(start, start + 524288) })).status()).toBe(200);
    }
  }
  test.beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (process.env.CI !== "true" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/prayer_e2e") throw new Error("PASTORAL_TESTS_REQUIRE_DISPOSABLE_LOCAL_DB");
    db = postgres(url.toString(), { ssl: "require", prepare: false, max: 1 });
    await db`insert into prayer_app.sams(id,name,leader_name) values(${ids.sam},'901-1',${accounts.leader.name}),(${ids.otherSam},'901-2','직접지정검증'),(${ids.foreignSam},'902-1',${accounts.outsider.name})`;
    for (const [kind, account] of Object.entries(accounts)) {
      const village = kind === "outsider" ? "902" : "901"; const sam = kind === "head" ? "2" : "1";
      await db`insert into prayer_app.member_roster(id,source_name,canonical_name,phone_lookup_hash,phone_ciphertext,village,sam,sam_label,source) values(${account.rosterId},${account.name},${account.name},${phoneLookupHash(account.phone)},${encryptRosterPhone(account.phone)},${village},${sam},${village + "-" + sam},'manual')`;
      await db`insert into prayer_app.users(id,roster_id,display_name,normalized_name,phone_lookup_hash,phone_password_hash,role) values(${account.userId},${account.rosterId},${account.name},${normalizeName(account.name)},${phoneLookupHash(account.phone)},${await hashPhonePassword(account.phone)},'member')`;
    }
  });
  test.beforeEach(async () => {
    // Only the new module's synthetic data in the explicitly disposable CI database.
    await db`delete from prayer_app.pastoral_reports`; await db`delete from prayer_app.pastoral_requests`; await db`delete from prayer_app.village_leaders`; await db`delete from prayer_app.pastoral_schedule_versions`;
    requestId = randomUUID();
    await db`insert into prayer_app.pastoral_requests(id,year,month) values(${requestId},${year},${month})`;
    await db`insert into prayer_app.village_leaders(name,village,leader_name) values('901마을장','901',${accounts.head.name})`;
  });
  test.afterAll(async () => {
    if (!db) return;
    try {
      await db`delete from prayer_app.pastoral_reports`; await db`delete from prayer_app.pastoral_requests`; await db`delete from prayer_app.village_leaders`; await db`delete from prayer_app.pastoral_schedule_versions`;
      for (const account of Object.values(accounts)) { await db`delete from prayer_app.users where id=${account.userId}`; await db`delete from prayer_app.member_roster where id=${account.rosterId}`; }
      for (const id of [ids.sam, ids.otherSam, ids.foreignSam]) await db`delete from prayer_app.sams where id=${id}`;
    } finally { await db.end(); }
  });

  test("ordinary members cannot see the tab or call any report/admin handler", async ({ page, request }) => {
    await login(page);
    await expect(page.getByRole("link", { name: /목양지 제출/ })).toHaveCount(0);
    const paths = ["/api/pastoral/reports", `/api/pastoral/reports/${randomUUID()}`, `/api/pastoral/reports/${randomUUID()}/txt`, `/api/pastoral/reports/${randomUUID()}/files/0/image`, `/api/pastoral/reports/${randomUUID()}/files/0/chunks/0`];
    for (const path of paths) { expect((await request.get(path)).status()).toBe(401); expect((await page.request.get(path)).status()).toBe(403); }
    for (const path of ["schedule", "reports", "overview"]) {
      expect((await request.get(`/api/admin/pastoral/${path}`)).status()).toBe(403);
      expect((await page.request.get(`/api/admin/pastoral/${path}`)).status()).toBe(403);
    }
    expect((await page.request.post("/api/pastoral/reports", { data: input() })).status()).toBe(403);
    await page.goto("/pastoral-reports"); await expect(page).toHaveURL(/\/$/);
  });

  test("leader and village head are scoped; future requests do not create reminders", async ({ page, browser }) => {
    await loginAs(page, "leader");
    const state = await (await page.request.get("/api/pastoral/status")).json(); expect(state.sams.map((s: { id: string }) => s.id)).toEqual([ids.sam]); expect(state.count).toBe(1);
    await expect(page.getByRole("link", { name: /목양지 제출/ }).locator(".nav-badge")).toHaveText("!");
    const context = await browser.newContext(); const head = await context.newPage();
    try {
      await loginAs(head, "head"); const h = await (await head.request.get("/api/pastoral/status")).json(); expect(h.sams.map((s: { id: string }) => s.id).sort()).toEqual([ids.sam, ids.otherSam].sort()); expect(h.count).toBe(0);
      expect((await head.request.post("/api/pastoral/reports", { data: { ...input(), samId: ids.foreignSam } })).status()).toBe(403);
    } finally { await context.close(); }
    await db`update prayer_app.pastoral_requests set year=${year+1},month=1 where id=${requestId}`;
    expect((await (await page.request.get("/api/pastoral/status")).json()).count).toBe(0);
    expect((await page.request.post("/api/pastoral/reports", { data: input() })).status()).toBe(409);
  });

  test("typed form submission removes reminder and admin can view/download all template content", async ({ page, browser }) => {
    await loginAs(page, "leader"); await page.setViewportSize({ width: 360, height: 900 }); await page.goto("/pastoral-reports");
    await page.getByRole("radio", { name: "칸에 입력" }).check();
    await page.getByLabel("샘모임 1행 일시", { exact: true }).fill(today); await page.getByLabel("샘모임 1행 장소", { exact: true }).fill("검증 장소");
    await page.getByLabel("샘모임 1행 참석자(가정)", { exact: true }).fill("가상가정");
    await page.getByLabel("나눔/기도제목 1행 나눔 / 기도제목 (예배·성경통독은혜·기도제목)", { exact: true }).fill("나눔 검증 내용");
    await page.getByLabel("상담/심방 요청 1행 사유", { exact: true }).fill("비공개 검증 내용");
    await page.getByLabel("샘소식 1행 소식 (결혼, 장례, 이사, 입원 등)", { exact: true }).fill("가상 소식");
    await page.getByLabel("샘리더 기도제목", { exact: true }).fill("리더 기도제목");
    await expectNoOverflow(page); await page.screenshot({ path: test.info().outputPath("pastoral-entry-360.png"), fullPage: true });
    await page.getByRole("button", { name: "목양지 제출", exact: true }).click();
    await expect(page.getByText("목양지가 제출되었습니다.", { exact: true })).toBeVisible();
    await expect.poll(async () => (await (await page.request.get("/api/pastoral/status")).json()).count).toBe(0);
    const list = await (await page.request.get("/api/pastoral/reports")).json(); const id = list.reports[0].id;
    const context = await browser.newContext(); const admin = await context.newPage();
    try {
      await login(admin, "admin");
      const txt = await admin.request.get(`/api/pastoral/reports/${id}/txt`); expect(txt.status()).toBe(200); expect(txt.headers()["content-disposition"]).toContain("attachment"); expect(txt.headers()["cache-control"]).toContain("no-store");
      const text = await txt.text(); for (const content of ["검증 장소", "나눔 검증 내용", "비공개 검증 내용", "가상 소식", "리더 기도제목"]) expect(text).toContain(content);
      await admin.goto("/admin/pastoral-reports"); await admin.locator(".pastoral-history").getByRole("button", { name: /목양지 보기/ }).first().click();
      await expect(admin.locator(".pastoral-detail")).toContainText("비공개 검증 내용");
      await page.reload(); await expect(page.getByRole("link", { name: /목양지 제출/ }).locator(".nav-badge")).toHaveCount(0);
    } finally { await context.close(); }
  });

  test("two 6MiB files are atomic, hash-verified and safe to retry", async ({ page, request }) => {
    await loginAs(page, "leader"); const buffers = [Buffer.alloc(6291456, 65), Buffer.alloc(6291456, 66)]; const value = input("file", [{ name: "목양지.txt", data: buffers[0] }, { name: "추가자료.hwp", data: buffers[1] }]);
    expect((await page.request.post("/api/pastoral/reports", { data: value })).status()).toBe(201);
    expect((await page.request.post(`/api/pastoral/reports/${value.id}/publish`)).status()).toBe(409);
    expect((await (await page.request.get("/api/pastoral/status")).json()).count).toBe(1);
    await upload(page.request, value, buffers);
    for (let i = 0; i < 2; i++) expect((await page.request.post(`/api/pastoral/reports/${value.id}/publish`)).status()).toBe(200);
    expect((await page.request.post("/api/pastoral/reports", { data: value })).status()).toBe(201);
    expect((await (await page.request.get("/api/pastoral/reports")).json()).total).toBe(1);
    expect((await page.request.delete(`/api/pastoral/reports/${value.id}`)).status()).toBe(409);
    expect((await request.get(`/api/pastoral/reports/${value.id}/files/0/chunks/0`)).status()).toBe(401);
    for (let slot = 0; slot < 2; slot++) {
      const pieces: Buffer[] = []; for (let index = 0; index < 12; index++) { const response = await page.request.get(`/api/pastoral/reports/${value.id}/files/${slot}/chunks/${index}`); expect(response.status()).toBe(200); pieces.push(await response.body()); }
      expect(digest(Buffer.concat(pieces))).toBe(digest(buffers[slot]));
    }
    expect((await page.request.post("/api/pastoral/reports", { data: { ...value, id: randomUUID(), files: [{ ...value.files[0], size: 6291457 }] } })).status()).toBe(400);
  });

  test("photo is displayed as safe raster; other leaders cannot access content, files or TXT", async ({ page, browser }) => {
    await loginAs(page, "leader");
    const image = await sharp({ create: { width: 320, height: 400, channels: 3, background: { r: 235, g: 235, b: 235 } } }).png().toBuffer();
    const value = input("photo", [{ name: "목양지사진.png", data: image }]); await upload(page.request, value, [image]);
    expect((await page.request.post(`/api/pastoral/reports/${value.id}/publish`)).status()).toBe(200);
    const preview = await page.request.get(`/api/pastoral/reports/${value.id}/files/0/image`); expect(preview.status()).toBe(200); expect(preview.headers()["content-type"]).toBe("image/webp");
    const context = await browser.newContext(); const outsider = await context.newPage();
    try { await loginAs(outsider, "outsider"); for (const suffix of ["", "/txt", "/files/0/image", "/files/0/chunks/0"]) expect((await outsider.request.get(`/api/pastoral/reports/${value.id}${suffix}`)).status()).toBe(404); }
    finally { await context.close(); }
  });

  test("forged image, cross-site writes and role revocation fail closed", async ({ page }) => {
    await loginAs(page, "head"); const fake = Buffer.from('<svg onload="alert(1)"></svg>'); const value = input("photo", [{ name: "fake.png", data: fake }]);
    expect((await page.request.post("/api/pastoral/reports", { headers: { origin: "https://other.example" }, data: value })).status()).toBe(403);
    await upload(page.request, value, [fake]); expect((await page.request.post(`/api/pastoral/reports/${value.id}/publish`)).status()).toBe(415);
    await db`delete from prayer_app.village_leaders where village='901'`;
    expect((await (await page.request.get("/api/pastoral/status")).json()).visible).toBe(false);
    expect((await page.request.get(`/api/pastoral/reports/${value.id}`)).status()).toBe(403);
  });

  test("monthly-only toggles, stale-save protection, next year and cancellation preserve reports", async ({ page, browser }) => {
    const context = await browser.newContext(); const leader = await context.newPage();
    try {
      await loginAs(leader, "leader"); const value = input(); await upload(leader.request, value, []); expect((await leader.request.post(`/api/pastoral/reports/${value.id}/publish`)).ok()).toBe(true);
      await login(page, "admin"); await page.setViewportSize({ width: 360, height: 900 }); await page.goto("/admin/pastoral-reports");
      const first = page.getByRole("button", { name: "1월 제출 요청", exact: true });
      if ((await first.getAttribute("aria-pressed")) === "true") await first.click();
      await first.click(); await expect(first).toHaveAttribute("aria-pressed", "true"); await first.click(); await expect(first).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByText("주별 선택", { exact: true })).toHaveCount(0);
      await expect(page.getByLabel("마감일", { exact: true })).toHaveCount(0);
      await expect(page.getByText("마을장·리더 권한 관리", { exact: true })).toHaveCount(0);
      await expectNoOverflow(page); await page.screenshot({ path: test.info().outputPath("pastoral-admin-months-360.png"), fullPage: true });
      const prior = await (await page.request.get(`/api/admin/pastoral/schedule?year=${year}`)).json();
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year, expectedVersion: prior.version, selected: [] } })).status()).toBe(200);
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year, expectedVersion: prior.version, selected: [] } })).status()).toBe(409);
      expect((await page.request.get(`/api/pastoral/reports/${value.id}`)).status()).toBe(200);
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year: year + 1, expectedVersion: 0, selected: [{ month: 1 }] } })).status()).toBe(200);
      expect((await page.request.put("/api/admin/pastoral/schedule", { data: { year: year + 2, expectedVersion: 0, selected: [] } })).status()).toBe(400);
    } finally { await context.close(); }
  });

  test("lost final response can be retried without creating a duplicate", async ({ page }) => {
    await loginAs(page, "leader"); await page.goto("/pastoral-reports"); await page.getByRole("radio", { name: "칸에 입력" }).check();
    await page.getByLabel("샘리더 기도제목", { exact: true }).fill("통신 재시도 검증");
    await page.route("**/api/pastoral/reports/*/publish", async route => { const response = await route.fetch(); expect(response.ok()).toBe(true); await route.abort("failed"); });
    await page.getByRole("button", { name: "목양지 제출", exact: true }).click(); await expect(page.locator(".pastoral-entry").getByRole("alert")).toBeVisible();
    await page.unroute("**/api/pastoral/reports/*/publish"); await page.getByRole("button", { name: "같은 내용으로 다시 시도", exact: true }).click();
    await expect(page.getByText("목양지가 제출되었습니다.", { exact: true })).toBeVisible(); expect((await (await page.request.get("/api/pastoral/reports")).json()).total).toBe(1);
  });


  test("blank/partial form, editable date, no-meeting reason and multiple submissions", async ({ page }) => {
    await loginAs(page,"leader"); await page.setViewportSize({width:360,height:900}); await page.goto("/pastoral-reports");
    await page.getByRole("radio",{name:"칸에 입력"}).check();
    await expect(page.getByLabel("공동체",{exact:true})).toHaveCount(0);
    await expect(page.getByLabel("작성일",{exact:true})).toHaveValue(today);
    await expect(page.getByLabel("제출자",{exact:true})).toHaveAttribute("readonly","");
    const date=year+"-01-02"; await page.getByLabel("작성일",{exact:true}).fill(date);
    await page.getByRole("button",{name:"목양지 제출",exact:true}).click();
    await expect(page.getByText("목양지가 제출되었습니다.",{exact:true})).toBeVisible();
    expect((await (await page.request.get("/api/pastoral/status")).json()).count).toBe(0);
    await page.getByRole("button",{name:"이 달에 추가 제출",exact:true}).click();
    await expect(page.getByText("목양지가 제출되었습니다.",{exact:true})).toHaveCount(0);
    await page.getByRole("radio",{name:"칸에 입력"}).check();
    await page.getByLabel("이번 기간 샘모임 없음",{exact:true}).check();
    const reason=page.getByLabel("샘모임을 하지 못한 이유",{exact:true}); await expect(reason).toHaveAttribute("required","");
    await reason.fill("일정 조정으로 모이지 못했습니다.");
    await expectNoOverflow(page); await page.screenshot({path:test.info().outputPath("pastoral-optional-form-360.png"),fullPage:true});
    await page.getByRole("button",{name:"목양지 제출",exact:true}).click(); await expect(page.getByText("목양지가 제출되었습니다.",{exact:true})).toBeVisible();
    const reports=await (await page.request.get("/api/pastoral/reports")).json();expect(reports.total).toBe(2);
    const texts=await Promise.all(reports.reports.map(async(r:{id:string})=>await (await page.request.get(`/api/pastoral/reports/${r.id}/txt`)).text()));
    expect(texts.join("\n")).toContain("일정 조정으로 모이지 못했습니다.");expect(texts.join("\n")).toContain(date);expect(texts.join("\n")).not.toContain("공동체:");
    const forged={...input(),form:{noMeeting:true,noMeetingReason:""},submittedBy:"위조"};
    expect((await page.request.post("/api/pastoral/reports",{data:forged})).status()).toBe(400);
    const partial={...input(),id:randomUUID(),form:{sharing:[{content:"부분입력"}]},submittedBy:"위조"};
    expect((await page.request.post("/api/pastoral/reports",{data:partial})).status()).toBe(201);
    expect((await page.request.post(`/api/pastoral/reports/${partial.id}/publish`)).status()).toBe(200);
    const detail=await (await page.request.get(`/api/pastoral/reports/${partial.id}`)).json();expect(detail.report.submittedBy).toBe(accounts.leader.name);
  });

  test("closed months reject new drafts and finalization; cancelled month preserves history", async({page})=>{
    await loginAs(page,"leader"); const value=input();await upload(page.request,value,[]);
    await db`update prayer_app.pastoral_requests set year=${year-1} where id=${requestId}`;
    expect((await page.request.post(`/api/pastoral/reports/${value.id}/publish`)).status()).toBe(409);
    expect((await (await page.request.get("/api/pastoral/status")).json()).count).toBe(0);
    expect((await page.request.post("/api/pastoral/reports",{data:input()})).status()).toBe(409);
    await db`update prayer_app.pastoral_requests set year=${year} where id=${requestId}`;
    expect((await page.request.post(`/api/pastoral/reports/${value.id}/publish`)).status()).toBe(200);
    await db`update prayer_app.pastoral_requests set enabled=false where id=${requestId}`;
    expect((await page.request.get(`/api/pastoral/reports/${value.id}`)).status()).toBe(200);
    expect((await (await page.request.get("/api/pastoral/status")).json()).count).toBe(0);
  });

  test("village registration lives in user management, grants no unrelated sam or body access",async({page,browser,request})=>{
    await login(page,"admin");await db`delete from prayer_app.village_leaders`;
    await page.goto("/admin/users");const panel=page.getByRole("region",{name:"마을장 관리"});
    await panel.getByLabel("마을장",{exact:true}).fill("901마을장");await panel.getByLabel("마을장 이름",{exact:true}).fill(accounts.head.name);
    await panel.getByRole("button",{name:"마을장 저장",exact:true}).click();await expect(panel.getByText("마을장 정보를 저장했습니다.",{exact:true})).toBeVisible();
    await panel.getByText(/등록된 마을장/).click();await expect(panel.getByText("901마을장",{exact:true})).toBeVisible();
    const ctx=await browser.newContext();const member=await ctx.newPage();try{
      await loginAs(member,"head");expect((await (await member.request.get("/api/pastoral/status")).json()).visible).toBe(true);
      expect((await member.request.put("/api/admin/sams/village-leaders",{data:{name:"902마을장",leaderName:accounts.head.name}})).status()).toBe(403);
      for(const method of ["GET","PUT","DELETE"])expect((await request.fetch("/api/admin/sams/village-leaders",{method})).status()).toBe(403);
      page.once("dialog",d=>d.accept());await panel.getByRole("button",{name:"901마을장 삭제",exact:true}).click();await expect(panel.getByText("마을장 등록을 삭제했습니다.",{exact:true})).toBeVisible();
      expect((await (await member.request.get("/api/pastoral/status")).json()).visible).toBe(false);
    }finally{await ctx.close();}
    expect((await db`select id from prayer_app.sams where name='901마을장'`).length).toBe(0);
    expect((await page.request.put("/api/admin/pastoral/schedule",{data:{year,expectedVersion:0,selected:[{month,week:1}]}})).status()).toBe(400);
  });

  for (const method of ["photo", "file"] as const) test(`${method} UI submission clears reminder and administrator downloads the original`, async ({page,browser})=>{
    const bytes=method==="photo"?await sharp({create:{width:320,height:400,channels:3,background:{r:220,g:230,b:220}}}).png().toBuffer():Buffer.from("가상 목양지 파일 내용", "utf8");
    const filename=method==="photo"?"사진검증.png":"파일검증.txt";
    await loginAs(page,"leader"); await page.goto("/pastoral-reports");
    await page.getByRole("radio",{name:method==="photo"?"사진으로 제출":"파일로 제출",exact:true}).check();
    await page.getByLabel(method==="photo"?"목양지 사진 선택":"목양지 파일 선택",{exact:true}).setInputFiles({name:filename,mimeType:method==="photo"?"image/png":"text/plain",buffer:bytes});
    await page.getByRole("button",{name:"목양지 제출",exact:true}).click();
    await expect(page.getByText("목양지가 제출되었습니다.",{exact:true})).toBeVisible();
    await expect(page.getByRole("link",{name:/목양지 제출/}).locator(".nav-badge")).toHaveCount(0);
    const context=await browser.newContext(); const admin=await context.newPage();
    try {
      await login(admin,"admin");await admin.setViewportSize({width:360,height:900});await admin.goto("/admin/pastoral-reports");
      await admin.locator(".pastoral-history").getByRole("button",{name:/목양지 보기/}).first().click();
      if(method==="photo") {
        const img=admin.getByRole("img",{name:"목양지 사진 1",exact:true});await expect(img).toBeVisible();
        await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
      }
      await expectNoOverflow(admin);await admin.screenshot({path:test.info().outputPath(`pastoral-${method}-detail-360.png`),fullPage:true});
      const waiting=admin.waitForEvent("download");await admin.getByRole("button",{name:`${filename} 내려받기`,exact:true}).click();
      const download=await waiting;expect(download.suggestedFilename()).toBe(filename);
      const path=await download.path();expect(path).not.toBeNull();expect(digest(await readFile(path!))).toBe(digest(bytes));
    } finally { await context.close(); }
  });

  test("four report tables and village leader directory are private", async () => {
    const data = await db`select tablename,rowsecurity,has_table_privilege('anon','prayer_app.'||tablename,'select,insert,update,delete') as anon_access,has_table_privilege('authenticated','prayer_app.'||tablename,'select,insert,update,delete') as auth_access from pg_tables where schemaname='prayer_app' and (tablename like 'pastoral_%' or tablename='village_leaders')`;
    expect(data).toHaveLength(5); for (const row of data) { expect(row.rowsecurity).toBe(true); expect(row.anon_access).toBe(false); expect(row.auth_access).toBe(false); }
  });
});
