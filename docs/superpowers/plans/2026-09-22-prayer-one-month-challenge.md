# 기도운동 1달 도전 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 약 200명의 성도가 휴대폰에서 이름+전화번호로 한 번 로그인한 뒤 자동 로그인 상태로 한 달간 월~토 기도 완료를 체크하고, 관리자가 전체·샘별·개인별 진행률과 순위를 관리하는 PWA를 구축한다.

**Architecture:** Next.js App Router가 UI와 Route Handler를 함께 제공하고, Supabase PostgreSQL은 외부 DB로만 사용한다. 브라우저가 Supabase Data API에 직접 접근하지 않으며, Vercel 서버리스 런타임이 Supavisor transaction pooler를 통해 Drizzle ORM으로 private schema에 접근한다. 인증은 Supabase Auth가 아니라 이름+전화번호 기반의 커스텀 인증과 DB-backed HttpOnly 세션으로 구현한다.

**Tech Stack:** Next.js 16.3.5, React 19.3.0, TypeScript 6.0.2, Node 22.x, Drizzle ORM 0.45.3, Drizzle Kit 0.31.10, Postgres.js 3.4.9, Argon2 0.45.1, Zod 4.6.5, Vitest 5.0.1, Playwright 1.63.0, Supabase PostgreSQL, Vercel

**Spec:** `docs/superpowers/specs/2026-09-22-prayer-one-month-challenge-design.md`

## Global Constraints

- 앱 제목은 **기도운동 1달 도전**이다.
- 도전 기간은 30일 고정이 아니라 **시작일을 포함하여 다음 달 같은 날짜의 전날까지인 1개월**이다.
- 실제 기도 체크 대상 요일은 **월요일~토요일**이며 일요일은 제외한다.
- 사용자는 **오늘과 어제**만 체크/취소할 수 있다.
- 모든 날짜 판정은 **Asia/Seoul** 기준으로 처리한다.
- 아이디는 **이름**, 비밀번호는 **전화번호**다.
- 전화번호 원문은 DB 비밀번호 데이터나 localStorage에 저장하지 않는다.
- 최초 로그인/등록 때 샘을 선택하고, **샘 이름과 샘리더 이름 모두로 검색**할 수 있다.
- 로그인 성공 후 브라우저를 닫아도 자동 로그인 상태를 유지한다.
- 일반 사용자는 전체 순위를 볼 수 없고, 관리자는 전체·개인·샘별 통계와 공동순위를 볼 수 있다.
- 360px 폭 휴대폰에서 정상 사용 가능해야 한다.
- DB 비밀값은 GitHub에 커밋하지 않는다.
- Supabase의 Data API를 앱 데이터 경로로 사용하지 않는다. 앱 테이블은 노출되지 않는 `prayer_app` schema에 둔다.
- Vercel 런타임 DB URL은 Supavisor **transaction pooler** 연결을 사용하고 Postgres.js는 `prepare: false`로 생성한다.
- 런타임 패키지는 exact version으로 설치하고 `package-lock.json`을 커밋한다.

## File Structure

```text
app/
  api/
    auth/login/route.ts
    auth/logout/route.ts
    auth/register/route.ts
    auth/refresh/route.ts
    checkins/route.ts
    profile/route.ts
    sams/route.ts
    admin/challenge/route.ts
    admin/sams/route.ts
    admin/users/route.ts
  admin/page.tsx
  login/page.tsx
  profile/page.tsx
  layout.tsx
  manifest.ts
  page.tsx
  globals.css
components/
  auth/LoginForm.tsx
  auth/SamRegistration.tsx
  calendar/PrayerCalendar.tsx
  dashboard/ProgressCard.tsx
  profile/ProfileForm.tsx
  admin/AdminDashboard.tsx
src/
  db/client.ts
  db/schema.ts
  features/auth/crypto.ts
  features/auth/rate-limit.ts
  features/auth/session.ts
  features/auth/service.ts
  features/challenge/date.ts
  features/challenge/progress.ts
  features/checkins/service.ts
  features/profile/service.ts
  features/sams/service.ts
  features/admin/service.ts
  lib/env.ts
  lib/http.ts
  lib/types.ts
drizzle/
  0000_initial.sql
scripts/
  promote-admin.ts
  smoke-db.ts
tests/
  auth/crypto.test.ts
  auth/session.test.ts
  challenge/date.test.ts
  challenge/progress.test.ts
  checkins/service.test.ts
  admin/stats.test.ts
  e2e/member-flow.spec.ts
  e2e/admin-flow.spec.ts
public/
  icons/prayer-192.png
  icons/prayer-512.png
  icons/prayer-maskable-512.png
.env.example
drizzle.config.ts
playwright.config.ts
vitest.config.ts
```

## Review Focus

1. **월말 시작일** — 1월 31일처럼 다음 달에 같은 날짜가 없을 때 종료일 계산이 흔들리지 않고, 관리자가 명시적으로 바꾼 종료일은 존중되어야 한다. Task 3의 월말 단위 테스트로 고정한다.
2. **자정 경계** — 서버 UTC 날짜가 아니라 Asia/Seoul 날짜로 오늘/어제를 판단해야 한다. Task 3에 KST 자정 직전·직후 테스트를 둔다.
3. **동명이인** — 같은 이름의 다른 성도가 로그인할 때 전화번호 lookup hash와 Argon2 검증으로 정확한 계정을 선택해야 한다. Task 4에 동명이인 인증 테스트를 둔다.
4. **이미 체크가 존재하는 도전 기간 변경** — 관리자가 기간을 줄여 기존 체크 기록이 범위 밖으로 밀려나는 변경은 409로 거부한다. Task 7에 관리자 변경 테스트를 둔다.
5. **연속 로그인 실패** — 전화번호가 사실상 개인식별정보이므로 무제한 대입을 허용하지 않고 15분 창에서 8회 실패 후 15분 차단한다. Task 4에 rate-limit 테스트를 둔다.

---

### Task 1: Next.js 앱 골격과 테스트/환경설정

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `.env.example`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `src/lib/env.ts`, `vitest.config.ts`, `playwright.config.ts`
- Modify: `README.md`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `env` with `DATABASE_URL`, `SESSION_SECRET`, `PHONE_LOOKUP_PEPPER`, `NODE_ENV`; `npm test`, `npm run test:e2e`, `npm run build`

- [ ] **Step 1: Scaffold with exact dependencies**

Create the Next.js App Router project in the repository root and install exact versions:

```bash
npm install --save-exact next@16.3.5 react@19.3.0 react-dom@19.3.0 drizzle-orm@0.45.3 postgres@3.4.9 argon2@0.45.1 zod@4.6.5
npm install --save-dev --save-exact typescript@6.0.2 drizzle-kit@0.31.10 vitest@5.0.1 @playwright/test@1.63.0 @types/node@22.20.4 @types/react@19.3.0 @types/react-dom@19.3.0 eslint@10.11.0 eslint-config-next@16.3.5 tsx@4.23.13
```

Set `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "admin:bootstrap": "tsx scripts/bootstrap-admin.ts",
    "admin:promote": "tsx scripts/promote-admin.ts",
    "db:smoke": "tsx scripts/smoke-db.ts"
  },
  "engines": { "node": "22.x" }
}
```

- [ ] **Step 2: Write the failing environment test**

```ts
import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('parseEnv', () => {
  it('rejects missing secrets', () => {
    expect(() => parseEnv({ DATABASE_URL: '' })).toThrow()
  })

  it('accepts the required server environment', () => {
    expect(parseEnv({
      DATABASE_URL: 'postgres://example',
      SESSION_SECRET: 's'.repeat(32),
      PHONE_LOOKUP_PEPPER: 'p'.repeat(32),
      NODE_ENV: 'test',
    }).NODE_ENV).toBe('test')
  })
})
```

- [ ] **Step 3: Run the test and confirm failure**

Run: `npm test -- src/lib/env.test.ts`  
Expected: FAIL because `parseEnv` does not exist.

- [ ] **Step 4: Implement validated server environment**

```ts
import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  PHONE_LOOKUP_PEPPER: z.string().min(32),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export function parseEnv(input: Record<string, string | undefined>) {
  return EnvSchema.parse(input)
}

export const env = parseEnv(process.env)
```

Create `.env.example` with names only, never real values.

- [ ] **Step 5: Run quality gates and commit**

Run:
```bash
npm test -- src/lib/env.test.ts
npm run lint
npm run build
```

Expected: PASS.

Commit:
```bash
git add .
git commit -m "chore: scaffold prayer challenge app"
```

### Task 2: Supabase 프로젝트와 private DB schema

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`
- Create: `drizzle/0000_initial.sql`
- Create: `scripts/smoke-db.ts`
- Test: database smoke transaction

**Interfaces:**
- Consumes: `env.DATABASE_URL`
- Produces: `db`; tables `challenges`, `sams`, `users`, `prayer_checkins`, `sessions`, `auth_rate_limits`

- [ ] **Step 1: Provision the Supabase project**

Using the connected Supabase account:
1. list organizations,
2. fetch the project creation cost for the selected organization,
3. obtain the required explicit cost confirmation,
4. create project name `prayer-one-month-challenge` in region `ap-northeast-2`,
5. wait until status is healthy.

Do not create a paid resource until the Supabase cost confirmation flow has completed.

- [ ] **Step 2: Define the Drizzle schema**

Use a private schema:

```ts
import {
  boolean, date, index, integer, pgEnum, pgSchema, text,
  timestamp, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

export const appSchema = pgSchema('prayer_app')
export const roleEnum = appSchema.enum('prayer_role', ['member', 'admin'])

export const challenges = appSchema.table('challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull().default('기도운동 1달 도전'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  timezone: text('timezone').notNull().default('Asia/Seoul'),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sams = appSchema.table('sams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  leaderName: varchar('leader_name', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('sams_name_uq').on(t.name)])

export const users = appSchema.table('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: varchar('display_name', { length: 80 }).notNull(),
  normalizedName: varchar('normalized_name', { length: 80 }).notNull(),
  phoneLookupHash: varchar('phone_lookup_hash', { length: 64 }).notNull(),
  phonePasswordHash: text('phone_password_hash').notNull(),
  samId: uuid('sam_id').references(() => sams.id),
  role: roleEnum('role').notNull().default('member'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('users_name_phone_uq').on(t.normalizedName, t.phoneLookupHash),
  index('users_sam_idx').on(t.samId),
])

export const prayerCheckins = appSchema.table('prayer_checkins', {
  id: uuid('id').defaultRandom().primaryKey(),
  challengeId: uuid('challenge_id').notNull().references(() => challenges.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  prayerDate: date('prayer_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('checkin_user_date_uq').on(t.challengeId, t.userId, t.prayerDate),
  index('checkin_date_idx').on(t.challengeId, t.prayerDate),
])

export const sessions = appSchema.table('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, t => [uniqueIndex('sessions_token_uq').on(t.tokenHash)])

export const authRateLimits = appSchema.table('auth_rate_limits', {
  keyHash: varchar('key_hash', { length: 64 }).primaryKey(),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
  failureCount: integer('failure_count').notNull().default(0),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
})
```

The SQL migration must also add:
- `CHECK (end_date >= start_date)`
- partial unique index permitting only one `is_active = true` challenge
- no grants of `prayer_app` to `anon` or `authenticated`

- [ ] **Step 3: Configure serverless DB connection**

```ts
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { env } from '@/src/lib/env'

const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(client)
```

Use the Supavisor transaction-pooler URL for Vercel runtime.

- [ ] **Step 4: Apply and verify schema**

Apply the migration through the Supabase SQL execution tool, then query `information_schema.tables` and `pg_indexes` to assert all six tables and both key unique constraints exist.

Run Supabase security and performance advisors after DDL changes. Fix every actionable issue affecting these objects before continuing.

- [ ] **Step 5: Add rollback-only smoke test and commit**

`scripts/smoke-db.ts` must open a transaction, insert a dummy sam/challenge/user/session/checkin, verify joins, and throw a sentinel error to force rollback so no test data remains.

Commit:
```bash
git add src/db drizzle scripts drizzle.config.ts
git commit -m "feat: add Supabase database schema"
```

### Task 3: 1개월 날짜 규칙과 달성률 도메인

**Files:**
- Create: `src/features/challenge/date.ts`, `src/features/challenge/progress.ts`
- Test: `tests/challenge/date.test.ts`, `tests/challenge/progress.test.ts`

**Interfaces:**
- Produces:
  - `todayInSeoul(now?: Date): DateKey`
  - `defaultEndDate(start: DateKey): DateKey`
  - `isPrayerDay(date: DateKey): boolean`
  - `isMutablePrayerDate(args): boolean`
  - `eligiblePrayerDates(args): DateKey[]`
  - `calculateProgress(args): { completed: number; eligible: number; rate: number }`

- [ ] **Step 1: Write date tests first**

Cover:
```ts
expect(defaultEndDate('2026-09-22')).toBe('2026-10-21')
expect(defaultEndDate('2027-01-31')).toBe('2027-02-27')
expect(isPrayerDay('2026-09-27')).toBe(false) // Sunday
expect(isPrayerDay('2026-09-28')).toBe(true)

expect(todayInSeoul(new Date('2026-09-21T14:59:59Z'))).toBe('2026-09-21')
expect(todayInSeoul(new Date('2026-09-21T15:00:00Z'))).toBe('2026-09-22')
```

Also assert today=17 permits 16 and 17, but not 15, future dates, Sundays, start-before, or end-after.

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/challenge/date.test.ts`  
Expected: FAIL because domain functions do not exist.

- [ ] **Step 3: Implement date-only arithmetic without local-machine timezone dependence**

Represent domain dates as `YYYY-MM-DD`, parse with UTC helpers, and derive Seoul today with `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })`.

For month-end, compute the next-month same day with day clamping to the next month's final day, then subtract one day.

- [ ] **Step 4: Write and implement progress tests**

Tests must cover:
- Sunday excluded from denominator
- future excluded before challenge ends
- full period used after end
- duplicate check-in input deduplicated defensively
- out-of-range/Sunday check-in ignored
- zero eligible days returns `rate: 0`

Use exact ratio for classification and `Math.round(rate * 100)` only for display.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/challenge
git add src/features/challenge tests/challenge
git commit -m "feat: add challenge date and progress rules"
```

### Task 4: 이름+전화번호 인증, 자동 로그인, 세션, 로그인 차단

**Files:**
- Create: `src/features/auth/crypto.ts`, `rate-limit.ts`, `session.ts`, `service.ts`
- Create: `app/api/auth/login/route.ts`, `register/route.ts`, `logout/route.ts`, `refresh/route.ts`
- Test: `tests/auth/crypto.test.ts`, `tests/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `normalizeName(name: string): string`
  - `normalizePhone(phone: string): string`
  - `phoneLookupHash(phone: string): string`
  - `hashPhonePassword(phone: string): Promise<string>`
  - `verifyPhonePassword(hash: string, phone: string): Promise<boolean>`
  - `createSession(userId: string): Promise<{ token: string; expiresAt: Date }>`
  - `getSessionUser(token: string): Promise<SessionUser | null>`
  - `revokeSession(token: string): Promise<void>`

- [ ] **Step 1: Write failing crypto/auth tests**

Tests:
- `010-1234-5678` and `01012345678` normalize identically.
- 9~11 digits are accepted; non-phone garbage rejected.
- same phone gives stable HMAC lookup hash.
- Argon2 hash never contains the original phone substring.
- same display name with two different phones authenticates the matching account only.
- inactive user login fails with generic credentials error.

- [ ] **Step 2: Implement phone secrecy**

```ts
import { createHmac, randomBytes } from 'node:crypto'
import * as argon2 from 'argon2'
import { env } from '@/src/lib/env'

export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').normalize('NFC')
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!/^\d{9,11}$/.test(digits)) throw new Error('INVALID_PHONE')
  return digits
}

export function phoneLookupHash(phone: string) {
  return createHmac('sha256', env.PHONE_LOOKUP_PEPPER)
    .update(normalizePhone(phone))
    .digest('hex')
}

export async function hashPhonePassword(phone: string) {
  return argon2.hash(normalizePhone(phone), { type: argon2.argon2id })
}

export async function verifyPhonePassword(hash: string, phone: string) {
  return argon2.verify(hash, normalizePhone(phone))
}

export function sessionTokenHash(token: string) {
  return createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex')
}

export function newSessionToken() {
  return randomBytes(32).toString('base64url')
}
```

- [ ] **Step 3: Implement 180-day rolling sessions**

Cookie:
```ts
{
  name: 'prayer_session',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 180,
}
```

DB session expiry is 180 days. `POST /api/auth/refresh` extends `expires_at` and resets the cookie at most once per 24 hours. Logout sets `revoked_at` and deletes the cookie.

- [ ] **Step 4: Implement login failure throttling**

Key = HMAC of normalized name + first forwarded IP value. Rules:
- 15-minute window
- 8 failed attempts => `blocked_until = now + 15 minutes`
- success clears the row
- blocked response is generic `429 로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.`

Write tests with a fake clock covering the 8th failure and expiry after 15 minutes.

- [ ] **Step 5: Implement login/register routes**

`POST /api/auth/login`:
- validate payload with Zod
- rate-limit check
- look up by normalized name + phone lookup hash
- Argon2 verify
- create session and cookie
- return `{ status: 'ok' }`
- if no account, return `404 { code: 'REGISTRATION_REQUIRED' }`

`POST /api/auth/register`:
- require valid active `samId`
- reject duplicate name+phone with 409
- create member + session in one transaction
- set same session cookie

Never return whether a different phone exists for a given name.

- [ ] **Step 6: Run auth tests and commit**

```bash
npm test -- tests/auth
git add src/features/auth app/api/auth
git commit -m "feat: add secure persistent login"
```

### Task 5: 샘 검색, 최초 등록 UI, 내 정보 수정

**Files:**
- Create: `src/features/sams/service.ts`, `src/features/profile/service.ts`
- Create: `app/api/sams/route.ts`, `app/api/profile/route.ts`
- Create: `app/login/page.tsx`, `components/auth/LoginForm.tsx`, `components/auth/SamRegistration.tsx`
- Create: `app/profile/page.tsx`, `components/profile/ProfileForm.tsx`
- Test: service tests + Playwright registration flow

**Interfaces:**
- `searchSams(query: string): Promise<SamOption[]>`
- `updateMySam(userId: string, samId: string): Promise<void>`

- [ ] **Step 1: Write sam search tests**

Given:
- 샘: `사랑샘`, leader: `김은혜`
- 샘: `믿음샘`, leader: `박사랑`

Assert query `사랑` returns both records, one by sam name and one by leader name. Inactive sams are excluded.

- [ ] **Step 2: Implement `GET /api/sams?q=`**

Return only:
```ts
type SamOption = {
  id: string
  name: string
  leaderName: string
}
```

Trim query, cap at 30 results, order by sam name.

- [ ] **Step 3: Implement first-login UI**

Flow:
1. name + phone form
2. call login
3. if `REGISTRATION_REQUIRED`, show searchable sam list
4. select sam
5. call register
6. navigate to `/`

If no active sam exists, display `등록 가능한 샘이 없습니다. 관리자에게 문의해 주세요.`

- [ ] **Step 4: Implement profile editing**

Authenticated `GET /api/profile` returns display name and sam.
Authenticated `PATCH /api/profile` accepts only `samId`; name and phone are not edited in v1.

Profile UI searches by sam/leader the same way as registration.

- [ ] **Step 5: Add E2E registration/profile test and commit**

Playwright must verify:
- first login moves to sam selection
- leader-name search works
- registration lands on dashboard
- page reload remains logged in
- changing sam persists after reload

Commit:
```bash
git add app components src/features/sams src/features/profile tests/e2e
git commit -m "feat: add registration and sam profile flow"
```

### Task 6: 기도 체크 API와 회원 대시보드 달력

**Files:**
- Create: `src/features/checkins/service.ts`
- Create: `app/api/checkins/route.ts`
- Create: `components/calendar/PrayerCalendar.tsx`, `components/dashboard/ProgressCard.tsx`
- Modify: `app/page.tsx`, `app/globals.css`
- Test: `tests/checkins/service.test.ts`, `tests/e2e/member-flow.spec.ts`

**Interfaces:**
- `toggleCheckin({ userId, challengeId, prayerDate, now }): Promise<'checked' | 'unchecked'>`
- `getMemberDashboard(userId, now): Promise<MemberDashboard>`

- [ ] **Step 1: Write check-in service tests**

Cover:
- today check creates row
- same date again deletes row
- yesterday works
- two days ago rejected
- Sunday rejected
- future rejected
- outside challenge rejected
- duplicate concurrent insert resolves to checked state without duplicate row
- user A cannot mutate user B because service receives user ID from session, never request body

- [ ] **Step 2: Implement server-side toggle transaction**

Pseudo-code must follow this exact decision order:

```ts
const challenge = await getActiveChallenge()
if (!challenge) throw new DomainError('NO_ACTIVE_CHALLENGE', 409)

const today = todayInSeoul(now)
if (!isMutablePrayerDate({
  prayerDate,
  today,
  startDate: challenge.startDate,
  endDate: challenge.endDate,
})) {
  throw new DomainError('DATE_NOT_MUTABLE', 400)
}

const existing = await findCheckin(userId, challenge.id, prayerDate)
if (existing) {
  await deleteCheckin(existing.id)
  return 'unchecked'
}

await insertCheckin(userId, challenge.id, prayerDate)
return 'checked'
```

- [ ] **Step 3: Implement `GET/POST /api/checkins`**

`GET` returns dashboard state.  
`POST { prayerDate }` toggles only for the session user and returns refreshed progress.

- [ ] **Step 4: Build continuous challenge calendar**

Calendar characteristics:
- headers: 월 화 수 목 금 토 일
- grid spans from the Monday of the start-date week through the Sunday of the end-date week
- cells outside challenge are visually muted
- Sundays disabled
- checked date has large ✓
- today has strong outline
- only today/yesterday prayer days have enabled buttons
- tapping an enabled checked date cancels it
- optimistic UI is allowed only if failure rolls back and displays an inline error

Accessibility:
- each button has `aria-label="9월 22일 기도 완료 체크"` or cancellation equivalent
- disabled dates expose reason in visually hidden text

- [ ] **Step 5: Build progress header**

Show:
- `현재 달성률 92%`
- `11 / 12일 완료`
- challenge date range
- name + sam

The percentage uses Task 3 progress calculation.

- [ ] **Step 6: E2E + responsive checks and commit**

Playwright viewport `360x800`:
- dashboard has no horizontal scroll
- today toggles on/off
- immutable past date cannot be clicked
- reload preserves check state

Commit:
```bash
git add app components src/features/checkins tests
git commit -m "feat: add prayer check-in dashboard"
```

### Task 7: 관리자 통계, 순위, 샘/사용자/도전 관리

**Files:**
- Create: `src/features/admin/service.ts`
- Create: `app/admin/page.tsx`, `components/admin/AdminDashboard.tsx`
- Create: `app/api/admin/challenge/route.ts`, `sams/route.ts`, `users/route.ts`
- Create: `scripts/bootstrap-admin.ts`, `scripts/promote-admin.ts`
- Test: `tests/admin/stats.test.ts`, `tests/e2e/admin-flow.spec.ts`

**Interfaces:**
- `requireAdmin(sessionUser): void`
- `getAdminDashboard(now): Promise<AdminDashboardData>`
- `updateChallenge(input): Promise<void>`
- `upsertSam(input): Promise<void>`
- `updateUserAdmin(input): Promise<void>`

- [ ] **Step 1: Write admin aggregation tests**

For a fixed eligible-day count of 10:
- A completed 10 => 100%
- B completed 8 => 80%
- C completed 8 => same dense rank as B
- D completed 5 => below 60%
- sam averages use member progress, not raw check-in count
- today-completion rate denominator = active members in sam

Expected dense ranks: `1, 2, 2, 3`.

- [ ] **Step 2: Implement server-side admin guard**

Every `/api/admin/*` route and `/admin` page must obtain the session user and assert `role === 'admin'`. Client-side hiding is never the authorization mechanism.

- [ ] **Step 3: Implement admin dashboard data**

Return:
```ts
type AdminDashboardData = {
  totals: {
    members: number
    todayCompleted: number
    todayRate: number
    averageRate: number
  }
  buckets: {
    perfect: number
    high: number
    medium: number
    low: number
  }
  members: Array<{
    userId: string
    name: string
    samName: string | null
    completed: number
    eligible: number
    rate: number
    rank: number
    completedToday: boolean
  }>
  sams: Array<{
    samId: string
    name: string
    leaderName: string
    members: number
    averageRate: number
    todayCompleted: number
    todayRate: number
  }>
}
```

Bucket classification uses unrounded ratio:
- 100%
- 80% ≤ x < 100%
- 60% ≤ x < 80%
- x < 60%

- [ ] **Step 4: Implement management APIs**

Challenge:
- create/update start/end/title/active
- only one active challenge
- reject end < start
- if check-ins exist, reject an update when any existing prayer_date would fall outside the new range

Sam:
- create
- rename
- update leader
- activate/deactivate

User:
- change sam
- activate/deactivate
- member/admin role change
- revoking/deactivating a user also revokes all active sessions

- [ ] **Step 5: Implement admin UI**

Sections in one responsive page:
1. KPI cards
2. 달성률 구간
3. 샘별 통계
4. 개인 현황 with name search + sam filter
5. settings dialogs for challenge/sam/user

Desktop can use tables; under 640px rows become stacked cards.

- [ ] **Step 6: Implement first-admin bootstrap and later promotion scripts**

The first deployment cannot depend on an existing sam or member account. Add a one-time bootstrap command that reads secrets from environment variables rather than shell arguments:

```bash
BOOTSTRAP_ADMIN_NAME="관리자이름" \
BOOTSTRAP_ADMIN_PHONE="01012345678" \
BOOTSTRAP_SAM_NAME="관리자샘" \
BOOTSTRAP_SAM_LEADER="샘리더이름" \
npm run admin:bootstrap
```

`bootstrap-admin.ts` must:
- abort if any admin already exists;
- create the named sam if it does not exist;
- normalize/hash the phone with the same production functions;
- create exactly one admin linked to that sam in one transaction;
- never print or persist the plaintext phone beyond process memory.

For later administrators, keep:

```bash
npm run admin:promote -- --name "홍길동" --phone "01012345678"
```

`promote-admin.ts` derives the lookup HMAC, verifies Argon2, then updates exactly one matching active user to admin. It never prints the phone.

- [ ] **Step 7: Run admin tests and commit**

```bash
npm test -- tests/admin
npm run test:e2e -- tests/e2e/admin-flow.spec.ts
git add app/admin app/api/admin components/admin src/features/admin scripts/bootstrap-admin.ts scripts/promote-admin.ts tests/admin
git commit -m "feat: add administrator dashboard"
```

### Task 8: PWA 아이콘과 모바일 완성도

**Files:**
- Create: `app/manifest.ts`
- Create: `public/icons/prayer-192.png`, `prayer-512.png`, `prayer-maskable-512.png`
- Modify: `app/layout.tsx`, `app/globals.css`
- Test: manifest smoke test + Playwright mobile UI

**Interfaces:**
- Produces installable manifest metadata and complete mobile visual system.

- [ ] **Step 1: Generate the app icon**

Use the image-generation tool with this fixed brief:

> "기도운동 1달 도전 모바일 웹앱 아이콘. 단순하고 또렷한 플랫 디자인. 기도하는 두 손의 실루엣과 완료를 뜻하는 체크 표시를 하나의 심볼로 결합. 작은 홈 화면 아이콘에서도 식별 가능. 글자는 넣지 않음. 교회용이지만 과도하게 장식적이지 않고 차분하고 따뜻한 인상. 정사각형 중심 구도, 넓은 안전 여백."

From the approved master, create 192×192, 512×512, and maskable 512×512 assets.

- [ ] **Step 2: Implement manifest**

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '기도운동 1달 도전',
    short_name: '기도 1달',
    description: '한 달 동안 월~토 기도 완료를 기록하는 앱',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icons/prayer-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/prayer-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/prayer-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

- [ ] **Step 3: Mobile visual polish**

Use plain CSS with:
- minimum touch target 44px
- body max content width 720px for member views
- admin max width 1200px
- `font-family: system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
- `prefers-reduced-motion` respected
- visible focus ring
- checked/unchecked state distinguishable without color alone

- [ ] **Step 4: Verify mobile/PWA and commit**

Playwright at 360×800 and 430×932:
- no horizontal overflow
- login fields and calendar buttons fit
- manifest returns 200
- icon URLs return 200

Commit:
```bash
git add app public/icons
git commit -m "feat: add mobile PWA experience"
```

### Task 9: 전체 검증, Supabase advisors, 운영 문서

**Files:**
- Modify: `README.md`
- Create: `docs/operations.md`
- Modify only as needed from failures found by verification

**Interfaces:**
- Produces a release-ready branch with documented setup and no unverified claims.

- [ ] **Step 1: Run full local quality suite**

```bash
npm ci
npm test
npm run lint
npm run build
npm run test:e2e
```

Expected: all pass.

- [ ] **Step 2: Run DB smoke test against Supabase**

Using the transaction-pooler `DATABASE_URL`:
```bash
npm run db:smoke
```

Then query the DB to confirm the smoke transaction left no dummy records.

- [ ] **Step 3: Run Supabase advisors**

Run both:
- security advisor
- performance advisor

No unresolved high-severity security findings attributable to this schema may remain. Record any informational warnings and rationale in `docs/operations.md`.

- [ ] **Step 4: Write deployment/operations guide**

README and operations docs must include:
- Supabase project region and private schema name
- Vercel environment variable names
- use of transaction pooler
- how to bootstrap the first administrator and first sam with `npm run admin:bootstrap`
- how the administrator creates the remaining sams before public registration
- how later administrators are promoted with `npm run admin:promote`
- how to create/activate the challenge
- how to revoke a user/session
- backup/export considerations
- no real phone numbers in GitHub issues, logs, or screenshots

- [ ] **Step 5: Final functional checklist**

Manually verify:
1. new member registration
2. auto login after browser restart/reload
3. today/yesterday toggle
4. Sunday and older dates disabled
5. progress percentage
6. member sam change
7. normal member blocked from admin
8. admin stats/ranking
9. challenge date edit validation
10. logout removes automatic login

- [ ] **Step 6: Commit release readiness**

```bash
git add .
git commit -m "docs: add deployment and operations guide"
```

Do not merge/deploy until the implementation branch has passed the Superpowers review and verification-before-completion workflow.
