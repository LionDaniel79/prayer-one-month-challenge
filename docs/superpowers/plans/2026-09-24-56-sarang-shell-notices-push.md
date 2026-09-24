# 56사랑 App Shell, Notices, and Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the existing prayer app as the `56사랑` PWA, add the shared four-item member navigation shell, implement admin-authored notices with unread state, and add opt-in Web Push without regressing the existing prayer experience.

**Architecture:** Keep Next.js App Router and the private `prayer_app` Postgres schema. Put authenticated member pages under one route-group layout and one client shell for responsive navigation. Notices use focused server-only feature modules and persisted per-user read state. Web Push sits after notice publication so push failures never block the notice itself.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, PostgreSQL/Supabase, Vitest, Playwright, `web-push`, Service Worker Push API, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-24-56-sarang-community-hub-design.md`

## Global Constraints

- PWA `name` and `short_name` must both be exactly `56사랑`.
- Member navigation order must be exactly: `기도운동` → `심방신청` → `기도요청` → `공지`.
- Main brand copy must be exactly `56공동체` and `성령이 하나 되게 하신 것을 힘써 지키라(엡 4:3)`.
- Existing prayer records, challenge rules, roster authentication, password behavior, and optimistic prayer check-in must remain unchanged.
- Only admins can create, edit, publish, or delete notices.
- Only `published` notices are visible to members.
- App-internal unread notice badges are mandatory; Web Push is optional by browser capability/user permission.
- Push delivery failure must never roll back a successful notice publication.
- Web Push private VAPID material must never be returned to the browser or committed.
- The member shell must be usable on narrow mobile viewports without horizontal overflow.

## Review Focus

- **360px mobile drawer:** opening/closing must not create horizontal overflow or leave an invisible overlay. Task 1 pins this with Playwright.
- **Draft leakage:** member list and direct-id APIs must reject drafts. Task 2 pins both paths.
- **Unread idempotency:** opening the same notice twice must create one read state and reduce the badge once. Task 3 pins this.
- **Unsupported/denied Push:** notice reading must still work and the opt-in UI must degrade without throwing. Task 4 pins this.
- **Expired subscriptions:** 404/410 sends must prune stale endpoints while continuing other deliveries. Task 4 pins this.

---

### Task 1: Shared member shell, 56사랑 branding, and PWA assets

**Files:**
- Create: `components/app/MemberShell.tsx`
- Create: `components/app/MemberSidebar.tsx`
- Create: `app/(member)/layout.tsx`
- Move/Modify: `app/page.tsx` → `app/(member)/page.tsx`
- Move/Modify: `app/profile/page.tsx` → `app/(member)/profile/page.tsx`
- Modify: `components/dashboard/PrayerDashboardClient.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/login/page.tsx`
- Modify: `app/manifest.ts`
- Modify: `app/globals.css`
- Create: `public/icons/56-love-192.png`
- Create: `public/icons/56-love-512.png`
- Create: `public/icons/56-love-maskable-512.png`
- Test: `tests/app/member-shell.test.ts`
- Test: `tests/pwa/manifest.test.ts`
- Test: `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: `getCurrentSessionUser(): Promise<SessionUser | null>`
- Produces: `MemberShell({ user, children }: { user: SessionUser; children: React.ReactNode })`
- Produces exact authenticated member routes `/`, `/visits`, `/prayer-requests`, `/notices`, `/profile`.

- [ ] **Step 1: Write failing shell and manifest tests**

Create `tests/app/member-shell.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("56사랑 member shell", () => {
  it("pins the required menu order", () => {
    const source = readFileSync("components/app/MemberSidebar.tsx", "utf8");
    const labels = ["기도운동", "심방신청", "기도요청", "공지"];
    let cursor = -1;
    for (const label of labels) {
      const next = source.indexOf(label);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
  });

  it("pins the exact brand copy", () => {
    const source = readFileSync("components/app/MemberShell.tsx", "utf8");
    expect(source).toContain("56공동체");
    expect(source).toContain("성령이 하나 되게 하신 것을 힘써 지키라(엡 4:3)");
  });
});
```

Update `tests/pwa/manifest.test.ts` to expect:

```ts
expect(value.name).toBe("56사랑");
expect(value.short_name).toBe("56사랑");
expect(pngSize("public/icons/56-love-192.png")).toEqual({ width: 192, height: 192 });
expect(pngSize("public/icons/56-love-512.png")).toEqual({ width: 512, height: 512 });
expect(pngSize("public/icons/56-love-maskable-512.png")).toEqual({ width: 512, height: 512 });
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm test -- tests/app/member-shell.test.ts tests/pwa/manifest.test.ts
```

Expected: FAIL because the shared shell/new icon files do not exist and the manifest still has the old app name.

- [ ] **Step 3: Implement the authenticated shared layout**

Create `app/(member)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { MemberShell } from "../../components/app/MemberShell";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";

export default async function MemberLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  return <MemberShell user={user}>{children}</MemberShell>;
}
```

Create `components/app/MemberSidebar.tsx` with the exact ordered data:

```ts
const memberNav = [
  { href: "/", label: "기도운동" },
  { href: "/visits", label: "심방신청" },
  { href: "/prayer-requests", label: "기도요청" },
  { href: "/notices", label: "공지" },
] as const;
```

Use `usePathname()` and `aria-current="page"`. `MemberShell` owns desktop sidebar, mobile drawer, overlay, exact brand title/scripture, `내 정보`, `로그아웃`, and admin-only `관리자`.

- [ ] **Step 4: Move prayer/profile pages into the route group without changing behavior**

Move `app/page.tsx` to `app/(member)/page.tsx`; preserve `getMemberDashboard(user.id)` and `PrayerDashboardNoSsr`.

Move `app/profile/page.tsx` to `app/(member)/profile/page.tsx`.

Remove the old prayer-specific global header from `PrayerDashboardClient`; keep only feature content:

```tsx
<>
  <section className="feature-heading">
    <p className="eyebrow">{dashboard.user.samLabel ?? "샘 미지정"}</p>
    <h2>{dashboard.challenge.title}</h2>
    <p><strong>{dashboard.user.displayName}</strong> 님의 기도 기록</p>
  </section>
  <ProgressCard dashboard={dashboard} />
  {message && <p className="error-text" role="alert">{message}</p>}
  <PrayerCalendar dashboard={dashboard} onToggle={toggle} pendingDates={pendingDates} />
</>
```

- [ ] **Step 5: Rebrand metadata, manifest, and icons**

Update `app/layout.tsx` metadata:

```ts
title: { default: "56사랑", template: "%s | 56사랑" },
description: "56공동체 기도운동, 심방신청, 기도요청, 공지",
applicationName: "56사랑",
```

Update `app/login/page.tsx` so the login hero uses the `56사랑` / `56공동체` brand. Update the existing e2e login expectation to the current `비밀번호` field label instead of the legacy phone-password label.

Update `app/manifest.ts`:

```ts
return {
  name: "56사랑",
  short_name: "56사랑",
  description: "56공동체 기도운동, 심방신청, 기도요청, 공지",
  start_url: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#ffffff",
  icons: [
    { src: "/icons/56-love-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/56-love-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/56-love-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
```

Generate a simple heart/cross community icon, then resize to the exact PNG dimensions. Commit only the resulting app image assets.

- [ ] **Step 6: Add responsive shell CSS and 360px browser test**

Add CSS with a 240–260px desktop sidebar, `min-width:0` content, a fixed mobile drawer below 860px, visible overlay, and 44px touch targets.

Update `tests/e2e/pwa.spec.ts`:

```ts
test("member drawer has no narrow-screen horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(page.getByRole("link", { name: "기도운동" })).toBeVisible();
  await expect(page.getByRole("link", { name: "심방신청" })).toBeVisible();
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )).toBe(false);
});
```

Use the repository's authenticated e2e seed/login helper if required by the test environment; do not weaken production auth.

- [ ] **Step 7: Verify Task 1 and commit**

```bash
npm test -- tests/app/member-shell.test.ts tests/pwa/manifest.test.ts
npm run lint
npm run build
git add app components public/icons tests
git commit -m "feat: add 56사랑 member shell and branding"
```

---

### Task 2: Notice schema, member APIs, and admin CRUD

**Files:**
- Create: `drizzle/0004_notices_push.sql`
- Modify: `src/db/schema.ts`
- Create: `src/features/notices/types.ts`
- Create: `src/features/notices/service.ts`
- Create: `app/api/notices/route.ts`
- Create: `app/api/notices/[id]/route.ts`
- Create: `app/api/notices/unread-count/route.ts`
- Create: `app/api/admin/notices/route.ts`
- Create: `app/api/admin/notices/[id]/route.ts`
- Test: `tests/notices/service.test.ts`
- Test: `tests/db/notices-schema.test.ts`

**Interfaces:**
- Produces: `listPublishedNotices(userId: string): Promise<MemberNoticeSummary[]>`
- Produces: `getPublishedNoticeForUser(noticeId: string, userId: string): Promise<MemberNoticeDetail | null>`
- Produces: `getUnreadNoticeCount(userId: string): Promise<number>`
- Produces: `markNoticeRead(noticeId: string, userId: string): Promise<void>`
- Produces admin CRUD: `createNotice`, `updateNotice`, `deleteNotice`, `listNoticesForAdmin`.
- `listNoticesForAdmin` includes `readCount` and `targetActiveUsers` for published notices so the admin UI can show 읽음/전체 대상 without loading member details.

- [ ] **Step 1: Write RED schema/policy tests**

Create `tests/db/notices-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { noticeReads, notices } from "../../src/db/schema";

describe("notice schema", () => {
  it("defines notices and per-user reads", () => {
    expect(notices.id).toBeDefined();
    expect(notices.status).toBeDefined();
    expect(noticeReads.noticeId).toBeDefined();
    expect(noticeReads.userId).toBeDefined();
  });
});
```

In `tests/notices/service.test.ts` pin:

```ts
expect(canMemberReadNotice({ status: "draft" })).toBe(false);
expect(canMemberReadNotice({ status: "published" })).toBe(true);
```

Also add a repository/service test proving direct member lookup of a draft returns null.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/db/notices-schema.test.ts tests/notices/service.test.ts
```

Expected: FAIL because notice tables and service do not exist.

- [ ] **Step 3: Add additive DB migration and Drizzle schema**

`drizzle/0004_notices_push.sql`:

```sql
create table prayer_app.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status varchar(20) not null check (status in ('draft','published')),
  author_user_id uuid not null references prayer_app.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notices_status_published_idx
  on prayer_app.notices(status, published_at desc);

create table prayer_app.notice_reads (
  notice_id uuid not null references prayer_app.notices(id) on delete cascade,
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

create table prayer_app.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
```

Mirror these in `src/db/schema.ts`. Apply the checked-in migration through Supabase after local schema tests are RED.

- [ ] **Step 4: Implement notice types and service**

`src/features/notices/types.ts`:

```ts
export type NoticeStatus = "draft" | "published";
export type MemberNoticeSummary = {
  id: string;
  title: string;
  publishedAt: string;
  isUnread: boolean;
};
export type MemberNoticeDetail = MemberNoticeSummary & { body: string };
export type AdminNoticeInput = {
  title: string;
  body: string;
  status: NoticeStatus;
};
```

`src/features/notices/service.ts`:

```ts
export function canMemberReadNotice(notice: { status: string }): boolean {
  return notice.status === "published";
}
```

Member DB queries must include `eq(notices.status, "published")`. `markNoticeRead` uses `onConflictDoNothing()`.

- [ ] **Step 5: Implement member APIs**

- `GET /api/notices`: session required, returns published summaries.
- `GET /api/notices/[id]`: session required, published-only, 404 `NOTICE_NOT_FOUND`, marks read idempotently.
- `GET /api/notices/unread-count`: session required, returns `{ count }`.

No member route may import admin mutation functions.

- [ ] **Step 6: Implement admin CRUD APIs**

Use:

```ts
const NoticeInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  status: z.enum(["draft", "published"]),
});
```

Every handler calls:

```ts
requireAdmin(await getCurrentSessionUser());
```

Rules:
- first transition from draft to `published` sets `publishedAt` and reports `didPublish: true`
- editing an already published notice preserves reads and reports `didPublish: false`
- draft uses `publishedAt = null`
- deleting a notice cascades read rows

- [ ] **Step 7: Verify Task 2 and commit**

```bash
npm test -- tests/db/notices-schema.test.ts tests/notices/service.test.ts
npm run lint
npm run build
git add drizzle src app/api tests
git commit -m "feat: add notice data model and APIs"
```

---

### Task 3: Notice member UI and persisted unread badge

**Files:**
- Create: `app/(member)/notices/page.tsx`
- Create: `app/(member)/notices/[id]/page.tsx`
- Create: `components/notices/NoticeList.tsx`
- Create: `components/notices/NoticeDetail.tsx`
- Create: `components/notices/UnreadNoticeBadge.tsx`
- Modify: `components/app/MemberSidebar.tsx`
- Modify: `app/globals.css`
- Test: `tests/notices/ui-contract.test.ts`

**Interfaces:**
- Consumes Task 2 services/APIs.
- Produces `UnreadNoticeBadge` and member notice pages.

- [ ] **Step 1: Write RED UI contract test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notice UI contract", () => {
  it("renders unread API usage and NEW copy", () => {
    expect(readFileSync("components/notices/UnreadNoticeBadge.tsx", "utf8"))
      .toContain("/api/notices/unread-count");
    expect(readFileSync("components/notices/NoticeList.tsx", "utf8"))
      .toContain("NEW");
  });
});
```

Run:

```bash
npm test -- tests/notices/ui-contract.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 2: Implement member notice list/detail**

`NoticeList` renders title, published date, unread `NEW`, and Link to `/notices/<id>`.

`app/(member)/notices/[id]/page.tsx` fetches the published notice, calls `markNoticeRead`, and `notFound()` for missing/draft ids.

- [ ] **Step 3: Implement pathname-driven unread badge refresh**

`UnreadNoticeBadge.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function UnreadNoticeBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/notices/unread-count", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) setCount(Number(body.count ?? 0));
      });
    return () => { cancelled = true; };
  }, [pathname]);

  if (count <= 0) return null;
  return (
    <span className="nav-badge" aria-label={"안 읽은 공지 " + count + "개"}>
      {count}
    </span>
  );
}
```

Mount only beside the `공지` nav item.

- [ ] **Step 4: Pin repeated-open idempotency**

Add a service/integration test proving:
- unread count starts 1
- `markNoticeRead` called twice
- unread count becomes 0
- no duplicate logical read row exists

Use the DB integration harness if available; otherwise inject a repository into the service so the test can assert one upsert.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- tests/notices
npm run lint
npm run build
git add app components src tests
git commit -m "feat: add member notices and unread badge"
```

---

### Task 4: Opt-in Web Push for published notices

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/lib/env.ts`
- Create: `src/features/push/service.ts`
- Create: `app/api/push/public-key/route.ts`
- Create: `app/api/push/subscribe/route.ts`
- Create: `public/sw.js`
- Create: `components/notices/PushOptIn.tsx`
- Modify: notice publish service/admin route
- Test: `tests/push/service.test.ts`
- Test: `tests/push/sw-contract.test.ts`

**Interfaces:**
- Produces `savePushSubscription(userId, subscription, userAgent)`
- Produces `removePushSubscription(userId, endpoint)`
- Produces `sendNoticePush(notice): Promise<PushSummary>`
- Consumes Task 2 `pushSubscriptions`.

- [ ] **Step 1: Install dependencies and write RED tests**

```bash
npm install web-push
npm install -D @types/web-push
```

Create `tests/push/service.test.ts`:

```ts
it("prunes a 410 subscription and continues fan-out", async () => {
  const removed: string[] = [];
  const result = await fanOutPush(
    [
      { endpoint: "expired", p256dh: "p", auth: "a" },
      { endpoint: "good", p256dh: "p", auth: "a" },
    ],
    async (sub) => {
      if (sub.endpoint === "expired") {
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      }
    },
    async (endpoint) => { removed.push(endpoint); },
  );
  expect(removed).toEqual(["expired"]);
  expect(result.attempted).toBe(2);
});
```

Create `tests/push/sw-contract.test.ts` that asserts `public/sw.js` includes `push` and `notificationclick` listeners.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/push/service.test.ts tests/push/sw-contract.test.ts
```

Expected: FAIL because push modules do not exist.

- [ ] **Step 3: Add optional env schema plus fail-closed push config accessor**

Add to `.env.example`:

```text
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_SUBJECT=
```

Add optional fields in `src/lib/env.ts` and:

```ts
export function requireWebPushConfig() {
  const env = getEnv();
  if (!env.WEB_PUSH_VAPID_PUBLIC_KEY ||
      !env.WEB_PUSH_VAPID_PRIVATE_KEY ||
      !env.WEB_PUSH_SUBJECT) {
    throw new Error("MISSING_WEB_PUSH_CONFIG");
  }
  return {
    publicKey: env.WEB_PUSH_VAPID_PUBLIC_KEY,
    privateKey: env.WEB_PUSH_VAPID_PRIVATE_KEY,
    subject: env.WEB_PUSH_SUBJECT,
  };
}
```

Do not make these globally required at process startup.

- [ ] **Step 4: Implement push fan-out and persistence**

Export:

```ts
export async function fanOutPush(
  subscriptions: PushTarget[],
  send: (target: PushTarget) => Promise<void>,
  removeExpired: (endpoint: string) => Promise<void>,
): Promise<{ attempted: number; sent: number; expired: number; failed: number }>
```

Rules:
- 404/410: remove endpoint and continue
- any other send error: count failure and continue
- never log subscription auth material

`sendNoticePush` payload:

```ts
{
  title: notice.title,
  body: notice.body.slice(0, 120),
  url: "/notices/" + notice.id,
  tag: "notice-" + notice.id,
}
```

- [ ] **Step 5: Implement subscription APIs and service worker**

`GET /api/push/public-key` returns only the VAPID public key.

`POST /api/push/subscribe` validates:

```ts
z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})
```

Upsert by endpoint and current user. `DELETE` removes only a subscription owned by that session user.

`public/sw.js`:

```js
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "56사랑", {
      body: data.body || "",
      icon: "/icons/56-love-192.png",
      badge: "/icons/56-love-192.png",
      tag: data.tag,
      data: { url: data.url || "/notices" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/notices"));
});
```

- [ ] **Step 6: Add explicit opt-in UI and unsupported/denied handling**

`PushOptIn` checks:

```ts
const supported =
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;
```

Only user click calls `Notification.requestPermission()`. Unsupported/denied states render helper text; they never hide or block notices.

- [ ] **Step 7: Fire push after notice publication commit**

After successful DB publication, invoke push outside the transaction and swallow/report delivery failures without changing the notice HTTP success:

```ts
await publishNotice(...);
try {
  await sendNoticePush({ id: notice.id, title: notice.title, body: notice.body });
} catch {
  // Notice stays published; operational logging only.
}
```

- [ ] **Step 8: Verify and commit**

```bash
npm test -- tests/push tests/notices
npm run lint
npm run build
git add package.json package-lock.json .env.example src app public components tests
git commit -m "feat: add notice web push"
```

---

### Task 5: Milestone operations and Preview verification

**Files:**
- Modify: `docs/operations.md`
- Create: `docs/superpowers/execution/2026-09-24-56-sarang-progress.md`

**Interfaces:**
- Consumes Tasks 1–4.
- Produces VAPID environment/setup and verification record.

- [ ] **Step 1: Document VAPID operations**

Document:
- generate VAPID keys securely
- install public/private/subject in Vercel Preview and Production
- redeploy after env changes
- never copy the private key into docs, GitHub issues, screenshots, or logs

- [ ] **Step 2: Run full automated verification**

```bash
npm test
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 3: Preview browser verification**

Desktop:
- exact brand copy
- four menu items in order
- prayer check remains functional
- notice list/detail and badge work

360px mobile:
- drawer opens/closes
- no horizontal overflow
- prayer calendar remains usable

Push:
- missing config does not break notices
- after VAPID installation, supported browser can opt in
- a published test notice shows a push
- clicking push opens the exact notice detail

- [ ] **Step 4: Commit operations record**

```bash
git add docs
git commit -m "docs: record 56사랑 shell notice verification"
```
