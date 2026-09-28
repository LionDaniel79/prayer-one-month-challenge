# 56사랑 Visits and Google Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a date-only consultation/visitation booking calendar that blocks any date with a Google Calendar event or an app-level block, creates one all-day Google event per successful request, and lets admins confirm/update/cancel requests.

**Architecture:** Keep booking state authoritative in Postgres and use a narrow `CalendarProvider` interface around Google Calendar so availability and compensation logic are testable without live Google calls. Google OAuth/token encryption is server-only. Availability is fail-closed: if Google cannot be queried, no date is presented as bookable. One non-cancelled visit per date is enforced by a partial unique index and rechecked immediately before booking.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, PostgreSQL/Supabase, Zod, `googleapis`, Node crypto AES-256-GCM, Vitest, Playwright, Google Calendar API v3.

**Spec:** `docs/superpowers/specs/2026-09-24-56-sarang-community-hub-design.md`

## Global Constraints

- One selected Google Calendar serves the whole app.
- Any non-cancelled Google Calendar event overlapping a Seoul calendar date makes that date unavailable.
- Any non-cancelled app visit, administrator-blocked date, or blocked weekday also makes the date unavailable.
- Google availability failure must fail closed and never guess that a date is free.
- One non-cancelled app visit per date maximum.
- Member form fields: 개인심방/샘심방, logged-in requester, 참석자 명단, 장소, 희망 시간, 심방 요청 이유.
- Exact guidance: `신청한 내용을 확인 후 유선으로 확정합니다.`
- Member submit button text: `확정`.
- Member submit creates state `requested`, not `confirmed`.
- Google event is an all-day event; its description includes requester, type, location, preferred time, attendees.
- Visit reason must never be sent to Google Calendar.
- Google refresh token must be encrypted at rest with a key distinct from roster-phone encryption.
- Admin can block individual dates and recurring weekdays.
- Admin can move requests through `requested | confirmed | completed | cancelled`.
- Existing app features must continue when Google Calendar is disconnected; only visit booking is blocked.

## Review Focus

- **Timed event crossing midnight:** both Seoul dates touched by the event must be blocked. Task 1 pins this.
- **All-day Google end-date semantics:** Google all-day `end.date` is exclusive; only inclusive dates are blocked. Task 1 pins this.
- **Two simultaneous visit submissions:** partial unique DB constraint ensures exactly one succeeds. Task 2 pins domain error mapping.
- **OAuth state replay/mismatch:** callback rejects missing, expired, or non-matching state and does not store tokens. Task 3 pins this.
- **Partial Google/DB failure:** event-create/save failure triggers compensation and never returns success. Task 4 pins both compensation directions.

---

### Task 1: Visit schema and pure date-availability policy

**Files:**
- Create: `drizzle/0006_visits_google_calendar.sql`
- Modify: `src/db/schema.ts`
- Create: `src/features/visits/types.ts`
- Create: `src/features/visits/date-policy.ts`
- Create: `src/features/visits/service.ts`
- Test: `tests/db/visits-schema.test.ts`
- Test: `tests/visits/date-policy.test.ts`

**Interfaces:**
- Produces `VisitStatus = "requested" | "confirmed" | "completed" | "cancelled"`
- Produces `CalendarSyncStatus = "pending" | "synced" | "failed"`
- Produces `googleEventBlockedDates(event: CalendarEventLike): Set<string>`
- Produces `evaluateVisitDate(input: VisitDatePolicyInput): VisitDateAvailability`
- Produces repository/service functions for blocked dates/weekdays and existing visit dates.

- [ ] **Step 1: Write RED date-policy tests**

Create `tests/visits/date-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  googleEventBlockedDates,
  evaluateVisitDate,
} from "../../src/features/visits/date-policy";

describe("visit date policy", () => {
  it("blocks one Seoul date for a normal timed event", () => {
    expect([...googleEventBlockedDates({
      status: "confirmed",
      start: { dateTime: "2026-10-03T10:00:00+09:00" },
      end: { dateTime: "2026-10-03T11:00:00+09:00" },
    })]).toEqual(["2026-10-03"]);
  });

  it("blocks both dates when a timed event crosses midnight", () => {
    expect([...googleEventBlockedDates({
      status: "confirmed",
      start: { dateTime: "2026-10-03T23:30:00+09:00" },
      end: { dateTime: "2026-10-04T00:30:00+09:00" },
    })]).toEqual(["2026-10-03", "2026-10-04"]);
  });

  it("treats all-day end date as exclusive", () => {
    expect([...googleEventBlockedDates({
      status: "confirmed",
      start: { date: "2026-10-03" },
      end: { date: "2026-10-05" },
    })]).toEqual(["2026-10-03", "2026-10-04"]);
  });

  it("ignores cancelled Google events", () => {
    expect(googleEventBlockedDates({
      status: "cancelled",
      start: { date: "2026-10-03" },
      end: { date: "2026-10-04" },
    }).size).toBe(0);
  });

  it("blocks admin weekday, admin date, app visit, and Google event", () => {
    expect(evaluateVisitDate({
      date: "2026-10-04",
      calendarHealthy: true,
      googleBlockedDates: new Set(),
      blockedDates: new Set(),
      blockedWeekdays: new Set([0]),
      activeVisitDates: new Set(),
    }).available).toBe(false);
  });

  it("fails closed when calendar health is false", () => {
    expect(evaluateVisitDate({
      date: "2026-10-05",
      calendarHealthy: false,
      googleBlockedDates: new Set(),
      blockedDates: new Set(),
      blockedWeekdays: new Set(),
      activeVisitDates: new Set(),
    })).toMatchObject({
      available: false,
      reason: "calendar_unavailable",
    });
  });
});
```

- [ ] **Step 2: Write RED schema test and run**

`tests/db/visits-schema.test.ts` asserts definitions for:
- `visitRequests`
- `visitBlockedDates`
- `visitBlockedWeekdays`
- `googleCalendarConnections`

Run:

```bash
npm test -- tests/db/visits-schema.test.ts tests/visits/date-policy.test.ts
```

Expected: FAIL because schema/policy do not exist.

- [ ] **Step 3: Add additive visit/Google connection migration**

Create `drizzle/0006_visits_google_calendar.sql`:

```sql
create table prayer_app.visit_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references prayer_app.users(id),
  visit_date date not null,
  visit_type varchar(20) not null check (visit_type in ('personal','sam')),
  attendees text not null,
  location text not null,
  preferred_time text not null,
  reason text not null,
  status varchar(20) not null default 'requested'
    check (status in ('requested','confirmed','completed','cancelled')),
  calendar_sync_status varchar(20) not null default 'pending'
    check (calendar_sync_status in ('pending','synced','failed')),
  google_event_id text,
  confirmed_at timestamptz,
  confirmed_by_user_id uuid references prayer_app.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index visit_requests_active_date_uq
  on prayer_app.visit_requests(visit_date)
  where status <> 'cancelled';

create index visit_requests_status_date_idx
  on prayer_app.visit_requests(status, visit_date);

create table prayer_app.visit_blocked_dates (
  visit_date date primary key,
  reason text,
  created_by_user_id uuid not null references prayer_app.users(id),
  created_at timestamptz not null default now()
);

create table prayer_app.visit_blocked_weekdays (
  weekday integer primary key check (weekday between 0 and 6),
  created_by_user_id uuid not null references prayer_app.users(id),
  created_at timestamptz not null default now()
);

create table prayer_app.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  connected_by_user_id uuid not null references prayer_app.users(id),
  google_account_email text,
  refresh_token_ciphertext text not null,
  selected_calendar_id text,
  selected_calendar_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index google_calendar_single_connection_uq
  on prayer_app.google_calendar_connections ((true));
```

Mirror in `src/db/schema.ts`. Apply through Supabase after the checked-in migration is reviewed.

- [ ] **Step 4: Implement pure event-to-date conversion**

Use existing `addDays` from `src/features/challenge/date.ts`.

For all-day events:
- start.date inclusive
- end.date exclusive
- iterate with `addDays`

For timed events:
- parse instants with `new Date(dateTime)`
- derive first and last Seoul date using `todayInSeoul(date)`
- subtract 1ms from end because Google event end is exclusive

Core logic:

```ts
const lastInstant = new Date(end.getTime() - 1);
const firstDate = todayInSeoul(start);
const lastDate = todayInSeoul(lastInstant);
for (let cursor = firstDate; cursor <= lastDate; cursor = addDays(cursor, 1)) {
  blocked.add(cursor);
}
```

Cancelled events return an empty set.

- [ ] **Step 5: Implement one-source availability reason precedence**

Define:

```ts
export type VisitUnavailableReason =
  | "calendar_unavailable"
  | "google_event"
  | "blocked_date"
  | "blocked_weekday"
  | "existing_visit";

export type VisitDateAvailability =
  | { date: string; available: true }
  | { date: string; available: false; reason: VisitUnavailableReason };
```

Precedence:
1. calendar unavailable
2. Google event
3. blocked date
4. blocked weekday
5. existing visit
6. available

This keeps UI labels deterministic.

- [ ] **Step 6: Verify and commit Task 1**

```bash
npm test -- tests/db/visits-schema.test.ts tests/visits/date-policy.test.ts
npm run lint
npm run build
git add drizzle src tests
git commit -m "feat: add visit scheduling data model and policy"
```

---

### Task 2: Member visit calendar, side panel, and booking API against a provider interface

**Files:**
- Create: `src/features/visits/calendar-provider.ts`
- Extend: `src/features/visits/service.ts`
- Create: `app/api/visits/availability/route.ts`
- Create: `app/api/visits/route.ts`
- Create: `app/(member)/visits/page.tsx`
- Create: `components/visits/VisitCalendar.tsx`
- Create: `components/visits/VisitRequestPanel.tsx`
- Modify: `app/globals.css`
- Test: `tests/visits/service.test.ts`
- Test: `tests/visits/ui-contract.test.ts`

**Interfaces:**
- Produces provider interface:
```ts
export interface CalendarProvider {
  listEvents(input: { timeMin: string; timeMax: string }): Promise<CalendarEventLike[]>;
  createVisitEvent(input: VisitCalendarEventInput): Promise<{ eventId: string }>;
  updateVisitEvent(eventId: string, input: VisitCalendarEventInput): Promise<void>;
  deleteVisitEvent(eventId: string): Promise<void>;
}
```
- Produces `getMonthAvailability(month, provider): Promise<VisitDateAvailability[]>`
- Produces `submitVisitRequest(input, provider): Promise<{ id: string }>`

- [ ] **Step 1: Write RED service tests with a fake CalendarProvider**

Pin:
- Google query failure returns `CALENDAR_AVAILABILITY_UNAVAILABLE`
- server rechecks selected date before insert
- a simulated `23505` unique violation maps to `VISIT_ALREADY_EXISTS`
- reason never appears in `VisitCalendarEventInput`
- member state after success is `requested`

Example fake:

```ts
const provider: CalendarProvider = {
  async listEvents() { return []; },
  async createVisitEvent(input) {
    expect(JSON.stringify(input)).not.toContain("민감한 심방 이유");
    return { eventId: "g1" };
  },
  async updateVisitEvent() {},
  async deleteVisitEvent() {},
};
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/visits/service.test.ts
```

Expected: FAIL because provider/service functions do not exist.

- [ ] **Step 3: Implement month availability service**

Validate `month` as `YYYY-MM`.

Build Seoul query bounds:
- month start `YYYY-MM-01T00:00:00+09:00`
- next month start `YYYY-MM-01T00:00:00+09:00`

Query in parallel only if DB connection behavior allows; otherwise keep DB queries sequential to respect existing `max:1` postgres client:
1. provider.listEvents
2. blocked dates
3. blocked weekdays
4. active visit dates

Convert Google events to a blocked date set, then call `evaluateVisitDate` for every date in the month.

If provider list fails, return every month date with `calendar_unavailable` rather than partial availability.

- [ ] **Step 4: Implement member APIs**

`GET /api/visits/availability?month=YYYY-MM`:
- session required
- if calendar not connected return 409 `CALENDAR_NOT_CONNECTED`
- otherwise return `{ dates }`

`POST /api/visits` schema:

```ts
z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visitType: z.enum(["personal", "sam"]),
  attendees: z.string().trim().min(1).max(3000),
  location: z.string().trim().min(1).max(500),
  preferredTime: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(10000),
})
```

Requester id/name comes from session/DB, never from trusted client identity fields.

- [ ] **Step 5: Implement member calendar and side panel**

`VisitCalendar`:
- month navigation
- seven-column calendar
- disabled days use reason-specific accessible label
- enabled date calls `onSelect(date)`

`VisitRequestPanel`:
- desktop: fixed/right side panel
- mobile: bottom/full-width sheet
- radio choices `개인심방`, `샘심방`
- requester read-only
- fields `참석자 명단`, `장소`, `희망 시간`, `심방 요청 이유`
- exact guidance `신청한 내용을 확인 후 유선으로 확정합니다.`
- exact submit text `확정`

Create `tests/visits/ui-contract.test.ts` asserting all labels and exact guidance/button copy.

- [ ] **Step 6: Pin double-book race mapping**

Inject a repository into `submitVisitRequest` or expose a narrow repository interface:

```ts
type VisitRepository = {
  createPending(input: NewVisit): Promise<{ id: string }>;
  markSynced(id: string, eventId: string): Promise<void>;
  cancelAfterSyncFailure(id: string): Promise<void>;
};
```

A fake `createPending` throws `{ code: "23505" }`; test must expect `DomainError("VISIT_ALREADY_EXISTS", 409)`.

- [ ] **Step 7: Verify and commit Task 2**

```bash
npm test -- tests/visits/service.test.ts tests/visits/ui-contract.test.ts
npm run lint
npm run build
git add app components src tests
git commit -m "feat: add member visit booking flow"
```

---

### Task 3: Google OAuth, token encryption, Calendar selection, and Google provider

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/lib/env.ts`
- Create: `src/features/google-calendar/crypto.ts`
- Create: `src/features/google-calendar/oauth.ts`
- Create: `src/features/google-calendar/repository.ts`
- Create: `src/features/google-calendar/provider.ts`
- Create: `app/api/admin/google-calendar/connect/route.ts`
- Create: `app/api/admin/google-calendar/callback/route.ts`
- Create: `app/api/admin/google-calendar/status/route.ts`
- Create: `app/api/admin/google-calendar/calendars/route.ts`
- Create: `app/api/admin/google-calendar/selection/route.ts`
- Create: `app/api/admin/google-calendar/connection/route.ts`
- Test: `tests/google-calendar/crypto.test.ts`
- Test: `tests/google-calendar/oauth.test.ts`
- Test: `tests/google-calendar/provider.test.ts`

**Interfaces:**
- Produces `encryptGoogleRefreshToken`, `decryptGoogleRefreshToken`
- Produces OAuth URL/callback helpers
- Produces `GoogleCalendarProvider implements CalendarProvider`
- Produces `getSelectedCalendarProvider(): Promise<CalendarProvider>`
- Produces admin connect/status/list/select/disconnect APIs.

- [ ] **Step 1: Install Google API dependency and write RED crypto/OAuth tests**

```bash
npm install googleapis
```

Crypto test mirrors roster encryption expectations:
- ciphertext does not contain token
- decrypt round-trip
- wrong key fails closed
- required key must decode to exactly 32 bytes

OAuth test pins:
- scopes include Calendar event access and Calendar list readonly
- `access_type=offline`
- `prompt=consent` when connecting to obtain refresh token
- state mismatch throws `GOOGLE_OAUTH_STATE_MISMATCH`

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/google-calendar/crypto.test.ts tests/google-calendar/oauth.test.ts
```

Expected: FAIL because modules/env fields do not exist.

- [ ] **Step 3: Add env configuration**

Append to `.env.example`:

```text
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY=
```

Extend env schema with optional values and a strict base64 32-byte Google token key validator.

Add:

```ts
export function requireGoogleCalendarConfig() {
  const env = getEnv();
  if (!env.GOOGLE_OAUTH_CLIENT_ID ||
      !env.GOOGLE_OAUTH_CLIENT_SECRET ||
      !env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY) {
    throw new Error("MISSING_GOOGLE_CALENDAR_CONFIG");
  }
  return env;
}
```

Keep globally optional so non-visit app functions stay live before OAuth setup.

- [ ] **Step 4: Implement dedicated AES-256-GCM token encryption**

Use versioned serialization, separate from roster phone key:

```ts
type CipherParts = {
  version: "v1";
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};
```

Use 12-byte random IV, `aes-256-gcm`, base64url segments. Never log token/ciphertext in normal request logs.

- [ ] **Step 5: Implement OAuth state cookie and authorization URL**

Use an HttpOnly cookie such as `google_calendar_oauth_state`:
- random 32-byte base64url nonce
- `httpOnly: true`
- `sameSite: "lax"`
- `secure: NODE_ENV === "production"`
- maxAge 10 minutes

Google scopes:

```ts
const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
```

Connect route:
- admin required
- generates state cookie
- redirects to Google OAuth URL

Callback:
- admin session required
- compare query `state` with cookie using timing-safe equality
- clear state cookie after one use
- exchange code
- require refresh token on first connection
- fetch Google account email only if available from returned profile/token info; do not request broader profile scope solely for display
- encrypt and store refresh token

- [ ] **Step 6: Implement calendar list/status/selection/disconnect APIs**

`GET /calendars`:
- admin only
- refresh credentials
- CalendarList.list
- return only `id`, `summary`, `primary`, `accessRole`
- allow selecting calendars with sufficient event write access

`PUT /selection`:

```ts
z.object({
  calendarId: z.string().min(1).max(1024),
  calendarName: z.string().min(1).max(500),
})
```

Server verifies `calendarId` exists in the live CalendarList response before storing it; do not trust client-provided name alone.

`DELETE /connection` deletes stored connection. If token revocation is available, attempt revocation but delete local token even if remote revoke fails.

- [ ] **Step 7: Implement GoogleCalendarProvider**

Provider constructor receives authenticated `calendar_v3.Calendar` client + selected calendar id.

`listEvents` uses:
- `singleEvents: true`
- `showDeleted: false`
- provided `timeMin`/`timeMax`
- pagination until no `nextPageToken`

Map only fields needed by `CalendarEventLike`.

`createVisitEvent` creates:

```ts
{
  summary: "[56사랑 심방] " + requesterName + " - " + typeLabel,
  start: { date: visitDate },
  end: { date: addDays(visitDate, 1) },
  description: [
    "신청자: " + requesterName,
    "심방 유형: " + typeLabel,
    "장소: " + location,
    "희망 시간: " + preferredTime,
    "참석자 명단: " + attendees,
  ].join("\n"),
}
```

The `reason` property is not present in `VisitCalendarEventInput`, making accidental Calendar leakage structurally harder.

- [ ] **Step 8: Verify Task 3 and commit**

```bash
npm test -- tests/google-calendar
npm run lint
npm run build
git add package.json package-lock.json .env.example src app/api/admin/google-calendar tests
git commit -m "feat: connect Google Calendar for visits"
```

---

### Task 4: Booking compensation, Google event sync, and admin visit service APIs

**Files:**
- Modify: `src/features/visits/service.ts`
- Create: `src/features/visits/admin-service.ts`
- Create: `app/api/admin/visits/route.ts`
- Create: `app/api/admin/visits/[id]/route.ts`
- Create: `app/api/admin/visits/[id]/confirm/route.ts`
- Create: `app/api/admin/visits/[id]/complete/route.ts`
- Create: `app/api/admin/visits/[id]/cancel/route.ts`
- Create: `app/api/admin/visits/blocked-dates/route.ts`
- Create: `app/api/admin/visits/blocked-weekdays/route.ts`
- Test: `tests/visits/compensation.test.ts`
- Test: `tests/visits/admin-service.test.ts`

**Interfaces:**
- Produces full transactional/compensating `submitVisitRequest`
- Produces `confirmVisit`, `completeVisit`, `cancelVisit`, `updateVisitDetails`
- Produces blocked date/weekday CRUD used by admin UI in the final integration plan.

- [ ] **Step 1: Write RED compensation tests**

Cases:
1. DB request created, Google create throws → repository cancel/delete compensation called, final error `CALENDAR_EVENT_CREATE_FAILED`.
2. Google event created, DB `markSynced` throws → provider.deleteVisitEvent(eventId) called, final error.
3. provider.deleteVisitEvent compensation also throws → request remains `failed`/cancelled-safe, never returned as success.
4. reason is absent from Google event input.

Use fakes; no network.

- [ ] **Step 2: Implement booking compensation sequence**

Exact success sequence:
1. validate/requester resolve
2. blocked date/weekday check
3. provider list events for the selected day
4. reject any Google overlap
5. insert DB row `requested/pending`
6. create Google all-day event
7. update DB row with event id + `synced`
8. return id

Failure rules:
- step 5 unique conflict → `VISIT_ALREADY_EXISTS`
- step 6 failure → cancel/delete pending DB row and return `CALENDAR_EVENT_CREATE_FAILED`
- step 7 failure → try delete Google event, mark DB request failed/cancelled, return failure

No path returns HTTP 2xx before step 7 succeeds.

- [ ] **Step 3: Write RED admin-state tests**

Pin valid transitions:

```ts
expect(canTransitionVisit("requested", "confirmed")).toBe(true);
expect(canTransitionVisit("confirmed", "completed")).toBe(true);
expect(canTransitionVisit("requested", "cancelled")).toBe(true);
expect(canTransitionVisit("completed", "requested")).toBe(false);
```

Pin that updating location/preferredTime/attendees on a synced visit calls provider.updateVisitEvent.

- [ ] **Step 4: Implement admin visit service and APIs**

Admin list:
- filters `status`, `from`, `to`
- includes requester display name and sync status

PATCH edit allows:
- visitType
- attendees
- location
- preferredTime
- reason

If Calendar-visible fields change and event id exists, update Google event after DB validation; if Google update fails, do not silently claim sync success.

Confirm route:
- only `requested -> confirmed`
- sets `confirmedAt`, `confirmedByUserId`
- updates Google summary to include `[확정]`

Complete route:
- `confirmed -> completed`
- may update summary with `[완료]` but must not delete event

Cancel route:
- requested/confirmed -> cancelled
- delete Google event if present
- release partial unique date constraint by status change

- [ ] **Step 5: Implement blocked-date APIs**

`POST /api/admin/visits/blocked-dates` body:

```ts
z.object({
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().max(500).optional().nullable(),
})
```

Before blocking, query any existing non-cancelled visit for that date. Return 409 `BLOCK_CONFLICTS_WITH_VISIT` instead of silently invalidating an existing booking.

DELETE accepts exact date and removes the block.

- [ ] **Step 6: Implement blocked-weekday API**

GET returns sorted integer weekdays.

PUT accepts:

```ts
z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
})
```

Before replacing settings, detect existing future active visits whose weekday would become newly blocked. Return 409 with safe conflict dates/count; do not cancel those visits automatically.

- [ ] **Step 7: Verify Task 4 and commit**

```bash
npm test -- tests/visits
npm run lint
npm run build
git add src app/api/admin/visits tests
git commit -m "feat: synchronize visit requests with Google Calendar"
```

---

### Task 5: Visit milestone integration and live Google verification

**Files:**
- Modify: `docs/operations.md`
- Modify: `docs/superpowers/execution/2026-09-24-56-sarang-progress.md`

**Interfaces:**
- Consumes Tasks 1–4.
- Produces the operations checklist for Google Cloud OAuth and live Preview verification.

- [ ] **Step 1: Document Google Cloud setup**

Document exact operator actions:
- enable Google Calendar API
- configure OAuth consent screen
- create Web application OAuth client
- register Preview callback URL: `https://<preview-host>/api/admin/google-calendar/callback`
- register Production callback URL after custom domain is known
- install `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` in Vercel
- token encryption key is base64 for exactly 32 random bytes
- never place secret values in GitHub/docs/screenshots

- [ ] **Step 2: Run complete automated verification**

```bash
npm test
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 3: Preview live OAuth/Calendar test**

As the admin:
1. open settings
2. connect Google account
3. choose one calendar
4. create a temporary Google event on a test date and verify date is disabled
5. delete temporary event and verify availability returns
6. submit one visit request on a free date
7. verify the Google event is all-day and description includes requester/type/location/preferred time/attendees
8. verify reason is absent from Google Calendar
9. confirm the visit in admin
10. cancel/delete the test visit and verify Google event removal according to status action

Use test content only; do not expose real counseling reasons during verification.

- [ ] **Step 4: Record results and commit docs**

```bash
git add docs
git commit -m "docs: record visit calendar integration verification"
```
