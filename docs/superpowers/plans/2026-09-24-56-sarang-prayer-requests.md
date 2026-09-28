# 56사랑 Prayer Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private prayer-request submission flow for members and a status-managed admin view, without exposing one member's request content to other members.

**Architecture:** Prayer requests are a private server-owned domain in the existing `prayer_app` schema. Members get one write-only form and no list endpoint. Admins get authenticated list/detail/status APIs. The member UI is intentionally minimal and uses the shared `56사랑` shell from the previous milestone.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, PostgreSQL/Supabase, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-24-56-sarang-community-hub-design.md`

## Global Constraints

- User copy must include exactly: `중보 기도가 필요한 내용을 자유롭게 적어주세요.`
- Member UI consists of the guidance, one content input, and a `전송` button.
- Member success copy must be `기도요청이 전달되었습니다.`
- Other members must never be able to list or read prayer requests.
- Admins can view requester, request date, content, and status.
- Status values are exactly `received | praying | completed`.
- Prayer-request body content must not be written into application logs.
- Existing prayer, notice, roster, profile, and login functionality must remain unchanged.

## Review Focus

- **Direct member enumeration attempt:** there must be no member GET collection/detail endpoint that leaks requests. Task 2 pins route surface.
- **Blank/whitespace content:** server rejects it even if client-side required attributes are bypassed. Task 2 pins Zod/service behavior.
- **Oversized content:** impose a high but finite server safety limit so pathological requests do not exhaust memory; Task 2 pins 10,000 characters.
- **Double-submit:** UI disables while pending and does not create two requests from one click. Task 3 pins client behavior.
- **Admin status tampering:** arbitrary strings cannot be written as status. Task 2 pins the enum schema.

---

### Task 1: Prayer-request data model and service

**Files:**
- Create: `drizzle/0005_prayer_requests.sql`
- Modify: `src/db/schema.ts`
- Create: `src/features/prayer-requests/types.ts`
- Create: `src/features/prayer-requests/service.ts`
- Test: `tests/db/prayer-requests-schema.test.ts`
- Test: `tests/prayer-requests/service.test.ts`

**Interfaces:**
- Produces: `createPrayerRequest(userId: string, content: string): Promise<string>`
- Produces: `listPrayerRequestsForAdmin(filter?: { status?: PrayerRequestStatus }): Promise<AdminPrayerRequestSummary[]>`
- Produces: `getPrayerRequestForAdmin(id: string): Promise<AdminPrayerRequestDetail | null>`
- Produces: `updatePrayerRequestStatus(id: string, status: PrayerRequestStatus): Promise<void>`

- [ ] **Step 1: Write RED schema and validation tests**

Create `tests/db/prayer-requests-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prayerRequests } from "../../src/db/schema";

describe("prayer request schema", () => {
  it("defines private prayer request fields", () => {
    expect(prayerRequests.id).toBeDefined();
    expect(prayerRequests.userId).toBeDefined();
    expect(prayerRequests.content).toBeDefined();
    expect(prayerRequests.status).toBeDefined();
  });
});
```

Create `tests/prayer-requests/service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  normalizePrayerRequestContent,
  parsePrayerRequestStatus,
} from "../../src/features/prayer-requests/service";

describe("prayer request rules", () => {
  it("rejects blank content", () => {
    expect(() => normalizePrayerRequestContent("   ")).toThrow("INVALID_PRAYER_REQUEST");
  });

  it("accepts content up to 10,000 characters", () => {
    expect(normalizePrayerRequestContent("가".repeat(10000))).toHaveLength(10000);
  });

  it("rejects content over 10,000 characters", () => {
    expect(() => normalizePrayerRequestContent("가".repeat(10001)))
      .toThrow("PRAYER_REQUEST_TOO_LONG");
  });

  it("accepts only the three admin statuses", () => {
    expect(parsePrayerRequestStatus("received")).toBe("received");
    expect(parsePrayerRequestStatus("praying")).toBe("praying");
    expect(parsePrayerRequestStatus("completed")).toBe("completed");
    expect(() => parsePrayerRequestStatus("deleted")).toThrow();
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/db/prayer-requests-schema.test.ts tests/prayer-requests/service.test.ts
```

Expected: FAIL because table/service do not exist.

- [ ] **Step 3: Add additive migration and Drizzle schema**

Create `drizzle/0005_prayer_requests.sql`:

```sql
create table prayer_app.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  content text not null,
  status varchar(20) not null default 'received'
    check (status in ('received','praying','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prayer_requests_status_created_idx
  on prayer_app.prayer_requests(status, created_at desc);

create index prayer_requests_user_created_idx
  on prayer_app.prayer_requests(user_id, created_at desc);
```

Mirror in `src/db/schema.ts`.

Apply via Supabase migration only after the migration is committed.

- [ ] **Step 4: Implement focused domain types and validation**

`src/features/prayer-requests/types.ts`:

```ts
export type PrayerRequestStatus = "received" | "praying" | "completed";

export type AdminPrayerRequestSummary = {
  id: string;
  requesterName: string;
  createdAt: string;
  status: PrayerRequestStatus;
  preview: string;
};

export type AdminPrayerRequestDetail = AdminPrayerRequestSummary & {
  content: string;
};
```

`src/features/prayer-requests/service.ts` pure helpers:

```ts
const STATUSES = new Set(["received", "praying", "completed"]);

export function normalizePrayerRequestContent(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new DomainError("INVALID_PRAYER_REQUEST", 400);
  if (normalized.length > 10000) {
    throw new DomainError("PRAYER_REQUEST_TOO_LONG", 400);
  }
  return normalized;
}

export function parsePrayerRequestStatus(value: string): PrayerRequestStatus {
  if (!STATUSES.has(value)) {
    throw new DomainError("INVALID_PRAYER_REQUEST_STATUS", 400);
  }
  return value as PrayerRequestStatus;
}
```

- [ ] **Step 5: Implement DB service functions**

`createPrayerRequest`:
- normalizes content
- inserts `status="received"`
- returns id
- does not log content

Admin list joins `users` for `displayName`, sorts newest first, and returns preview using a fixed slice such as first 120 characters.

Admin detail returns full content.

Status update writes `updatedAt = new Date()` and returns 404 `PRAYER_REQUEST_NOT_FOUND` when id does not exist.

- [ ] **Step 6: Verify Task 1 and commit**

```bash
npm test -- tests/db/prayer-requests-schema.test.ts tests/prayer-requests/service.test.ts
npm run lint
npm run build
git add drizzle src tests
git commit -m "feat: add private prayer request model"
```

---

### Task 2: Member submission API and admin management APIs

**Files:**
- Create: `app/api/prayer-requests/route.ts`
- Create: `app/api/admin/prayer-requests/route.ts`
- Create: `app/api/admin/prayer-requests/[id]/route.ts`
- Test: `tests/prayer-requests/api-contract.test.ts`

**Interfaces:**
- Consumes Task 1 service functions.
- Produces member `POST /api/prayer-requests` only.
- Produces admin GET collection/detail and PATCH status routes.

- [ ] **Step 1: Write RED route-surface tests**

Create `tests/prayer-requests/api-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("prayer request API surface", () => {
  it("member route exposes POST but not GET", () => {
    const source = readFileSync("app/api/prayer-requests/route.ts", "utf8");
    expect(source).toContain("export async function POST");
    expect(source).not.toContain("export async function GET");
  });

  it("admin route requires admin authorization", () => {
    const source = readFileSync("app/api/admin/prayer-requests/route.ts", "utf8");
    expect(source).toContain("requireAdmin");
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/prayer-requests/api-contract.test.ts
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement member POST route**

Use exact schema:

```ts
const PrayerRequestInput = z.object({
  content: z.string().trim().min(1).max(10000),
});
```

Handler:

```ts
export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const parsed = PrayerRequestInput.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  const id = await createPrayerRequest(user.id, parsed.data.content);
  return NextResponse.json({ status: "ok", id }, { status: 201 });
}
```

Do not export GET from the member route.

- [ ] **Step 4: Implement admin list/detail/status APIs**

Collection GET:
- authenticate
- `requireAdmin`
- optional `status` search param parsed through `parsePrayerRequestStatus`
- returns summaries

Detail GET:
- admin only
- returns full content

PATCH body:

```ts
const StatusPatch = z.object({
  status: z.enum(["received", "praying", "completed"]),
});
```

Return generic domain error codes, never include request content in error logs.

- [ ] **Step 5: Verify route contracts and commit**

```bash
npm test -- tests/prayer-requests
npm run lint
npm run build
git add app/api tests
git commit -m "feat: add prayer request APIs"
```

---

### Task 3: Member prayer-request form

**Files:**
- Create: `app/(member)/prayer-requests/page.tsx`
- Create: `components/prayer-requests/PrayerRequestForm.tsx`
- Modify: `app/globals.css`
- Test: `tests/prayer-requests/member-ui.test.ts`
- Test: `tests/e2e/prayer-request.spec.ts`

**Interfaces:**
- Consumes `POST /api/prayer-requests`.
- Produces the exact approved member form and success copy.

- [ ] **Step 1: Write RED UI contract test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("member prayer request UI", () => {
  it("contains the approved guidance and send action", () => {
    const source = readFileSync(
      "components/prayer-requests/PrayerRequestForm.tsx",
      "utf8",
    );
    expect(source).toContain("중보 기도가 필요한 내용을 자유롭게 적어주세요.");
    expect(source).toContain("전송");
    expect(source).toContain("기도요청이 전달되었습니다.");
  });
});
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/prayer-requests/member-ui.test.ts
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement member page and client form**

`app/(member)/prayer-requests/page.tsx` renders a feature heading and `PrayerRequestForm`.

The form state must include `content`, `busy`, `message`, `error`.

Submit logic:

```ts
if (busy) return;
setBusy(true);
const response = await fetch("/api/prayer-requests", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ content }),
});
```

On success:
- clear content
- show exact success copy
- keep form on the page

On failure:
- keep content
- show a concise Korean error message

Button has `disabled={busy || !content.trim()}`.

Textarea uses `maxLength={10000}` as a usability hint, while server validation remains authoritative.

- [ ] **Step 4: Add accessible, minimal styling**

Add:
- large textarea min-height around 220px desktop / 180px mobile
- helper text
- status/error region
- button aligned without introducing a new card hierarchy inconsistent with the app shell

- [ ] **Step 5: Add e2e double-submit/confirmation coverage**

`tests/e2e/prayer-request.spec.ts` should assert:
- page displays the exact guidance
- entering content enables send
- first click disables the button while pending
- success message appears once
- content clears after success

Use route mocking if test DB credentials are unavailable; keep one service/API test for server validation.

- [ ] **Step 6: Full milestone verification and commit**

```bash
npm test
npm run lint
npm run build
git add app components tests
git commit -m "feat: add member prayer request form"
```
