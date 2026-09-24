# 56사랑 Admin Hub and Release Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long single-screen admin page with an intuitive admin shell, a summary dashboard, focused management pages for prayer/visits/prayer requests/notices/users/settings, and complete end-to-end release verification.

**Architecture:** Keep existing admin services as domain owners but split the oversized `AdminDashboard.tsx` presentation into route-focused components. Add a lightweight aggregate dashboard service that returns counts/recent activity without loading full roster details. Reuse the notice, prayer-request, visit, Google Calendar, and user-management APIs created by earlier milestones. Final verification covers browser → API → DB → Google/Push boundaries before main merge.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, PostgreSQL/Supabase, Vitest, Playwright, Vercel, Google Calendar API, Web Push.

**Spec:** `docs/superpowers/specs/2026-09-24-56-sarang-community-hub-design.md`

## Global Constraints

- Admin navigation order: 대시보드, 기도운동 관리, 심방 신청 관리, 기도요청 관리, 공지 관리, 사용자 관리, 설정.
- `/admin` is the summary dashboard, not the old full management screen.
- Every admin route and admin API performs server-side admin authorization.
- Dashboard cards link to the relevant detailed management page.
- Existing participant statistics, roster import, bulk selection/delete, password reset, and challenge configuration remain available.
- Sensitive prayer-request and visitation-reason content is admin-only.
- Google/VAPID secret values are never displayed in admin UI.
- Google problems must not break prayer, notices, prayer requests, login, or user management.
- Final release requires full tests, lint, build, Supabase security review, Preview desktop/mobile verification, and explicit user approval before main merge.

## Review Focus

- **Admin route isolation:** a non-admin direct URL to any new admin subroute must redirect/deny. Task 1 pins shared layout authorization.
- **Dashboard performance:** dashboard must not load/decrypt all 411 roster rows just to show summary counts. Task 2 pins focused aggregate queries.
- **Sensitive preview leakage:** dashboard recent activity must not show prayer-request body or visitation reason. Task 2 pins safe projections.
- **Existing user management regression:** XLS import, bulk selection/delete, password reset, and participant stats must still work after page split. Task 3 pins existing controls.
- **Partial integration outage:** disconnected Google/Push config should surface status cards without crashing unrelated admin pages. Task 6 pins end-to-end behavior.

---

### Task 1: Shared admin shell and route structure

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `components/admin/AdminShell.tsx`
- Create: `components/admin/AdminSidebar.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/admin/admin-shell.test.ts`

**Interfaces:**
- Consumes: `getCurrentSessionUser`, `requireAdmin`.
- Produces authenticated admin layout and exact subroutes:
  - `/admin`
  - `/admin/prayer`
  - `/admin/visits`
  - `/admin/prayer-requests`
  - `/admin/notices`
  - `/admin/users`
  - `/admin/settings`

- [ ] **Step 1: Write RED shell tests**

`tests/admin/admin-shell.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin shell", () => {
  it("pins the approved menu order", () => {
    const source = readFileSync("components/admin/AdminSidebar.tsx", "utf8");
    const labels = [
      "대시보드",
      "기도운동 관리",
      "심방 신청 관리",
      "기도요청 관리",
      "공지 관리",
      "사용자 관리",
      "설정",
    ];
    let cursor = -1;
    for (const label of labels) {
      const next = source.indexOf(label);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
  });

  it("keeps authorization in the shared admin layout", () => {
    const source = readFileSync("app/admin/layout.tsx", "utf8");
    expect(source).toContain("getCurrentSessionUser");
    expect(source).toContain("requireAdmin");
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/admin/admin-shell.test.ts
```

Expected: FAIL because shared layout/sidebar do not exist.

- [ ] **Step 3: Implement server-authenticated admin layout**

`app/admin/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AdminShell } from "../../components/admin/AdminShell";
import { requireAdmin } from "../../src/features/admin/service";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  try {
    requireAdmin(user);
  } catch {
    redirect("/");
  }
  return <AdminShell>{children}</AdminShell>;
}
```

`AdminSidebar` exact ordered routes:

```ts
const adminNav = [
  ["/admin", "대시보드"],
  ["/admin/prayer", "기도운동 관리"],
  ["/admin/visits", "심방 신청 관리"],
  ["/admin/prayer-requests", "기도요청 관리"],
  ["/admin/notices", "공지 관리"],
  ["/admin/users", "사용자 관리"],
  ["/admin/settings", "설정"],
] as const;
```

Use exact-path matching for `/admin` and prefix matching for subpages.

- [ ] **Step 4: Add responsive admin navigation**

Desktop: fixed/sticky left navigation + main content.

Mobile: same drawer pattern as member shell but visually distinguish admin context.

Footer includes:
- `사용자 화면`
- admin display label
- logout if desired through existing logout component

- [ ] **Step 5: Verify and commit Task 1**

```bash
npm test -- tests/admin/admin-shell.test.ts
npm run lint
npm run build
git add app/admin components/admin app/globals.css tests
git commit -m "feat: add 56사랑 admin shell"
```

---

### Task 2: Lightweight aggregate admin dashboard

**Files:**
- Create: `src/features/admin/hub-service.ts`
- Modify/Create: `app/api/admin/dashboard/route.ts`
- Create: `components/admin/AdminHubDashboard.tsx`
- Modify: `app/admin/page.tsx`
- Test: `tests/admin/hub-service.test.ts`
- Test: `tests/admin/hub-ui.test.ts`

**Interfaces:**
- Produces `getAdminHubDashboard(now?: Date): Promise<AdminHubDashboardData>`
- Data:
```ts
export type AdminHubDashboardData = {
  prayer: { participants: number; todayCompleted: number; todayRate: number };
  visits: { requested: number; confirmedThisWeek: number };
  prayerRequests: { received: number; praying: number };
  notices: { published: number; latestTitle: string | null; latestPublishedAt: string | null };
  recentActivity: AdminActivityItem[];
};
```

- [ ] **Step 1: Write RED aggregate tests**

Pin pure aggregation/projection helpers:
- prayer request activity contains requester + status but not content
- visit activity contains requester/date/status but not reason
- dashboard counts requested visits and received prayer requests separately
- latest notice selects latest published only

Example:

```ts
expect(projectPrayerRequestActivity({
  id: "p1",
  requesterName: "홍길동",
  content: "비공개 기도 내용",
  status: "received",
  createdAt: new Date(),
})).not.toHaveProperty("content");
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/admin/hub-service.test.ts
```

Expected: FAIL because hub service does not exist.

- [ ] **Step 3: Implement focused DB queries**

Do not call `listRosterForAdmin()`.

Query only:
- active `users` count
- today's checkins for active challenge
- `visit_requests` status counts and confirmed dates for current Seoul week
- `prayer_requests` status counts
- published notice count/latest
- newest safe activity projections

Because existing postgres client uses `max:1`, execute DB calls sequentially unless combining them in one SQL/Drizzle query; do not use broad `Promise.all` against that single-connection client.

- [ ] **Step 4: Implement dashboard UI cards and links**

Cards:
- `기도운동 참여` → `/admin/prayer`
- `심방 신청 대기` → `/admin/visits?status=requested`
- `이번 주 확정 심방` → `/admin/visits?status=confirmed`
- `미처리 기도요청` → `/admin/prayer-requests?status=received`
- `최근 공지` → `/admin/notices`

Recent activity rows link to detail management page by id/query.

No sensitive body/reason snippets on dashboard.

- [ ] **Step 5: Verify and commit Task 2**

```bash
npm test -- tests/admin/hub-service.test.ts tests/admin/hub-ui.test.ts
npm run lint
npm run build
git add src app/api/admin/dashboard app/admin/page.tsx components/admin tests
git commit -m "feat: add admin summary dashboard"
```

---

### Task 3: Split existing prayer and user management out of AdminDashboard.tsx

**Files:**
- Create: `app/admin/prayer/page.tsx`
- Create: `app/admin/users/page.tsx`
- Create: `components/admin/prayer/AdminPrayerManagement.tsx`
- Create: `components/admin/users/AdminUserManagement.tsx`
- Modify: `components/admin/AdminDashboard.tsx` then delete it once consumers are gone
- Modify: `components/admin/AdminDashboardLoader.tsx` then delete/replace if unused
- Reuse existing APIs: challenge, roster, roster import, password reset
- Test: `tests/admin/user-management-regression.test.ts`
- Test: existing admin tests

**Interfaces:**
- `AdminPrayerManagement` owns existing KPIs, bucket/sam stats, participant table, challenge settings.
- `AdminUserManagement` owns roster import, search/filter, bulk selection/delete, add/edit, password status/reset.

- [ ] **Step 1: Write RED structural regression test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("split admin management", () => {
  it("keeps XLS import, bulk deletion, and password reset in user management", () => {
    const source = readFileSync(
      "components/admin/users/AdminUserManagement.tsx",
      "utf8",
    );
    expect(source).toContain("/api/admin/roster/import");
    expect(source).toContain('method: "DELETE"');
    expect(source).toContain("/api/admin/roster/password");
  });

  it("keeps challenge editing in prayer management", () => {
    const source = readFileSync(
      "components/admin/prayer/AdminPrayerManagement.tsx",
      "utf8",
    );
    expect(source).toContain("/api/admin/challenge");
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/admin/user-management-regression.test.ts
```

Expected: FAIL because split components do not exist.

- [ ] **Step 3: Extract prayer-management behavior without changing API contracts**

Move from current `AdminDashboard.tsx`:
- challenge settings modal/form
- prayer KPIs
- bucket stats
- sam stats
- participant search/filter/table

Keep API URLs exactly as currently working.

Do not change ranking/progress formulas during extraction.

- [ ] **Step 4: Extract user-management behavior without changing API contracts**

Move:
- XLS upload
- search/filter
- roster rows
- select all / bulk delete
- user add/edit modal
- initial/custom password display
- custom password set
- reset to phone password

Keep the 500-row limit already chosen for the current community size.

After extraction, remove unused `AdminDashboard` and loader only when `git grep` shows no consumers.

- [ ] **Step 5: Run existing admin regression suite**

```bash
npm test -- tests/admin
npm run lint
npm run build
```

Expected: all prior admin tests plus new structural tests PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add app/admin components/admin tests
git commit -m "refactor: split prayer and user admin management"
```

---

### Task 4: Admin notice management UI

**Files:**
- Create: `app/admin/notices/page.tsx`
- Create: `components/admin/notices/AdminNoticeList.tsx`
- Create: `components/admin/notices/AdminNoticeEditor.tsx`
- Modify: `app/globals.css`
- Test: `tests/admin/notices-ui.test.ts`

**Interfaces:**
- Consumes notice admin APIs from milestone 1.
- Produces draft/published list, editor, delete action, and read statistics display.

- [ ] **Step 1: Write RED UI contract tests**

Pin source contains:
- `임시저장`
- `발행`
- draft/published filters
- delete action
- read count rendering

- [ ] **Step 2: Implement notice list**

List columns/cards:
- title
- status
- created/published date
- read count for published
- edit
- delete

Filters: all/draft/published.

- [ ] **Step 3: Implement editor**

Fields:
- title
- body textarea
- `임시저장`
- `발행`

Published notice edit keeps publication/read state; UI warns that editing does not re-send as a new notice unless service explicitly sends push on first publish transition only.

Delete requires confirmation.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- tests/admin/notices-ui.test.ts tests/notices tests/push
npm run lint
npm run build
git add app/admin/notices components/admin/notices tests
git commit -m "feat: add admin notice management"
```

---

### Task 5: Admin prayer-request management UI

**Files:**
- Create: `app/admin/prayer-requests/page.tsx`
- Create: `components/admin/prayer-requests/AdminPrayerRequestList.tsx`
- Create: `components/admin/prayer-requests/AdminPrayerRequestDetail.tsx`
- Test: `tests/admin/prayer-requests-ui.test.ts`

**Interfaces:**
- Consumes prayer-request admin APIs from milestone 2.
- Produces status filters, requester search, detail panel, and status controls.

- [ ] **Step 1: Write RED UI contract test**

Assert component source includes the exact three workflow labels:
- `접수`
- `기도중`
- `완료`

and never renders a public/member link to another user's request.

- [ ] **Step 2: Implement list and filters**

Filters:
- all
- received
- praying
- completed

Search by requester display name client-side for current page or server query if list grows.

Rows show:
- requester
- request date
- preview
- status

Click row opens detail side panel/modal.

- [ ] **Step 3: Implement detail/status update**

Detail shows full content only in admin page.

Buttons map:
- `received` → 접수
- `praying` → 기도중
- `completed` → 완료

PATCH to admin API; update row/detail state after success.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- tests/admin/prayer-requests-ui.test.ts tests/prayer-requests
npm run lint
npm run build
git add app/admin/prayer-requests components/admin/prayer-requests tests
git commit -m "feat: add admin prayer request management"
```

---

### Task 6: Admin visit management and settings UI

**Files:**
- Create: `app/admin/visits/page.tsx`
- Create: `components/admin/visits/AdminVisitList.tsx`
- Create: `components/admin/visits/AdminVisitDetail.tsx`
- Create: `app/admin/settings/page.tsx`
- Create: `components/admin/settings/GoogleCalendarSettings.tsx`
- Create: `components/admin/settings/VisitAvailabilitySettings.tsx`
- Create: `components/admin/settings/PushSettingsStatus.tsx`
- Test: `tests/admin/visits-ui.test.ts`
- Test: `tests/admin/settings-ui.test.ts`

**Interfaces:**
- Consumes visit admin/block APIs from milestone 3.
- Consumes Google connection/status/list/select APIs.
- Consumes env-derived safe Push status endpoint or server-provided boolean; never consumes secret values.

- [ ] **Step 1: Write RED UI tests**

Pin:
- `유선확정 완료`
- `완료`
- `취소`
- `Google Calendar 연결`
- calendar selection control
- repeated weekday block controls
- specific-date block control
- no occurrence of secret env key values being rendered

- [ ] **Step 2: Implement visit management**

List:
- status filter
- date range filter
- requester
- date
- type
- sync status

Detail:
- requester read-only
- editable type/attendees/location/preferred time/reason
- `유선확정 완료` when requested
- `완료` when confirmed
- `취소` when requested/confirmed
- safe Google sync status text

Actions call the exact milestone-3 endpoints and refresh list/detail after success.

- [ ] **Step 3: Implement Google Calendar settings**

States:
- not configured: show `Google Calendar 연결`
- connected/no calendar selected: fetch calendars and select one
- connected/selected: show account identifier if available, selected calendar name, `캘린더 변경`, `연결 해제`
- error: safe error code/help copy, no token

Connect button navigates to `/api/admin/google-calendar/connect`.

- [ ] **Step 4: Implement blocked date/weekday settings**

Weekday controls use Sunday=0 through Saturday=6 but display Korean labels.

Save all selected weekdays through one PUT.

Specific date section:
- date picker
- optional reason
- add block
- list existing blocked dates
- remove action

409 conflicts show existing visit date conflict and do not modify setting.

- [ ] **Step 5: Implement Push settings status safely**

Expose only:
- Web Push configured: yes/no
- public-key endpoint healthy: yes/no

Never render private VAPID key or secret subject unless subject is deliberately non-secret; simplest is to omit subject entirely.

- [ ] **Step 6: Verify and commit Task 6**

```bash
npm test -- tests/admin/visits-ui.test.ts tests/admin/settings-ui.test.ts tests/visits tests/google-calendar
npm run lint
npm run build
git add app/admin components/admin tests
git commit -m "feat: add visit and integration admin settings"
```

---

### Task 7: Cross-feature authorization and privacy verification

**Files:**
- Create: `tests/security/community-hub-access.test.ts`
- Modify: affected route/service tests as needed

**Interfaces:**
- Consumes all feature routes.
- Produces a regression suite for role and privacy boundaries.

- [ ] **Step 1: Add route contract tests for every admin subtree**

Check source/handler wrappers for `requireAdmin` on:
- notices
- prayer requests
- visits
- Google Calendar
- settings endpoints

Do not rely solely on UI hiding.

- [ ] **Step 2: Add private-data projection tests**

Assert:
- member notice payload has no admin-only data
- member visit availability has no other requester details
- member visit submission response is id/status only, no other visit data
- no member prayer-request list/detail endpoint exists
- admin dashboard activity excludes prayer content and visit reason

- [ ] **Step 3: Run security-focused suite**

```bash
npm test -- tests/security tests/admin tests/notices tests/prayer-requests tests/visits
```

Expected: PASS.

- [ ] **Step 4: Commit Task 7**

```bash
git add tests
git commit -m "test: pin 56사랑 privacy and admin boundaries"
```

---

### Task 8: Final integration verification, advisors, and release handoff

**Files:**
- Modify: `docs/operations.md`
- Modify: `docs/superpowers/execution/2026-09-24-56-sarang-progress.md`
- Update: PR #1 description/checklist

**Interfaces:**
- Consumes all four implementation plans.
- Produces a verified Preview ready for user acceptance, not an automatic main merge.

- [ ] **Step 1: Run complete CI-equivalent verification**

```bash
npm test
npm run lint
npm run build
```

Expected: all PASS with zero TypeScript build errors.

- [ ] **Step 2: Run Supabase security/performance advisors**

Verify:
- no new SECURITY errors
- private schema remains non-public
- newly introduced indexes/constraints exist
- INFO-only unused indexes are recorded, not treated as release blockers unless clearly harmful

- [ ] **Step 3: Verify aggregate DB state without exposing private content**

Use aggregate-only SQL:
- notices count by status
- prayer requests count by status
- visits count by status/sync status
- Google connection count and selected-calendar-null boolean
- push subscription count
- existing user/roster/checkin counts preserved

Do not dump prayer request bodies, visit reasons, refresh-token ciphertexts, phone ciphertexts, or push auth keys.

- [ ] **Step 4: Desktop Preview full-story browser verification**

Verify:
1. login
2. exact brand/title/scripture
3. all four member tabs
4. prayer check optimistic behavior
5. notice unread/read
6. prayer request submit
7. visit availability/side panel
8. admin dashboard cards
9. each admin detailed page
10. user roster controls

- [ ] **Step 5: Mobile PWA verification**

At 360×800 and one modern phone browser:
- member drawer usable
- admin drawer usable
- no horizontal overflow
- visit right panel becomes mobile sheet/full-width layout
- PWA install metadata says `56사랑`
- icon is correct
- if Push-supported, opt in and receive a test notice

- [ ] **Step 6: Google live integration verification**

With the selected admin calendar:
- pre-existing Google event blocks date
- free date can be submitted
- all-day event created
- Calendar description fields correct
- reason absent
- admin confirmation updates state/event
- cancellation removes event/releases date

Use disposable test data/date and clean it up afterward.

- [ ] **Step 7: Update operations and execution ledger**

Record:
- migrations applied
- env keys required, names only
- Google OAuth redirect URIs, no secrets
- VAPID config installed, no secret values
- verification run IDs
- any known non-blocking limitations

- [ ] **Step 8: Request whole-branch code review**

Use `superpowers:requesting-code-review`.

Review focus:
- auth/privacy
- Google token handling
- compensation paths
- push failure isolation
- existing prayer/roster regressions
- mobile accessibility

Resolve review findings through `superpowers:receiving-code-review`.

- [ ] **Step 9: Present Preview for human acceptance**

Do not merge `main` yet.

Ask the user to verify:
- visual design
- menu wording/order
- notice authoring/alerts
- visit booking/calendar behavior
- prayer request form
- admin management usability

Only after explicit user approval proceed to `superpowers:finishing-a-development-branch` for merge/deployment decision.
