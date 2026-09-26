# Roster Auth + Optimistic Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace self-registration with an XLS-backed login allowlist, count only first-time logins as participants, give admins roster CRUD with the requested participant columns, and make prayer check-ins visually instantaneous with rollback-on-failure.

**Architecture:** Add a `member_roster` source-of-truth table that is populated once from the private `56공동체.xls` file; `users` remains the participation table and is created only on first successful roster login. Login matches canonical Korean name + normalized phone, roster phone values are searchable by HMAC and stored encrypted for admin display, and roster metadata drives position/sam labels and admin status. Check-ins use optimistic client state and a smaller POST response so UI rendering no longer waits for the database round-trip.

**Tech Stack:** Existing Next.js 16.3.5 / React 19.3.0 / TypeScript / Drizzle ORM / Postgres.js / Supabase PostgreSQL / Vercel / Vitest / Playwright; Node `crypto` for AES-256-GCM; SheetJS Community Edition 0.20.3 from the official SheetJS CDN for the one-off legacy `.xls` importer.

**Spec:** `docs/superpowers/specs/2026-09-23-roster-auth-optimistic-checkin-design.md`

## Global Constraints

- `56공동체.xls` is private input data and MUST NOT be committed to GitHub or bundled into the app.
- The roster is the login allowlist; only people with a successful login-created `users` row count as participants.
- Login identity is canonical Korean name + normalized phone number.
- Trailing ASCII alphabetic suffixes on Korean names are ignored for login matching.
- Phone formatting punctuation is ignored for matching.
- Roster rows with no phone remain importable but cannot log in until an admin supplies a phone.
- Participant display order is **이름 → 직분 → 전화번호 → 샘**.
- Sam display is `마을-샘`, for example `1마을 + 6샘 → 1-6`; missing either side renders `미지정`.
- The existing `현식` participant remains linked to all current check-ins/sessions and remains admin.
- Real phone numbers and private XLS contents never appear in GitHub source, commit messages, test fixtures, logs, or screenshots.
- Phone lookup uses HMAC; admin-readable phone storage uses AES-256-GCM and a server-only `ROSTER_ENCRYPTION_KEY`.
- General users cannot edit roster metadata or choose/change their sam.
- Existing server-side date validation for today/yesterday, Sundays, challenge range, and cross-user authorization remains authoritative.
- Prayer check-in UI changes immediately; failed persistence rolls back only the affected date.
- Different mutable dates may have independent in-flight check-in requests without disabling the entire calendar.
- All production changes are tested on the existing feature branch and Vercel Preview before `main` is merged.

## File Structure

```text
src/
  db/schema.ts
  features/
    roster/
      normalize.ts
      crypto.ts
      repository.ts
      import.ts
    auth/
      service.ts
      crypto.ts
      session.ts
    admin/
      service.ts
      roster-service.ts
    checkins/
      optimistic.ts
      service.ts
  lib/
    env.ts
    types.ts

app/
  api/
    auth/login/route.ts
    auth/register/route.ts              # remove
    admin/roster/route.ts
    admin/users/route.ts
    checkins/route.ts
  profile/page.tsx
  admin/page.tsx

components/
  auth/LoginForm.tsx
  auth/SamRegistration.tsx              # remove
  profile/ProfileForm.tsx               # replace with read-only identity or remove editing
  admin/AdminDashboard.tsx
  dashboard/PrayerDashboardClient.tsx
  calendar/PrayerCalendar.tsx

scripts/
  roster-import.ts

drizzle/
  0002_member_roster.sql

tests/
  roster/normalize.test.ts
  roster/crypto.test.ts
  roster/import.test.ts
  auth/roster-login.test.ts
  admin/roster.test.ts
  admin/participant-view.test.ts
  checkins/optimistic.test.ts
  e2e/roster-login.spec.ts
  e2e/optimistic-checkin.spec.ts
```

## Review Focus

1. **Same Korean name, different phones** — login must select only the row whose normalized phone matches; one namesake must never authenticate as another.
2. **Malformed/duplicate XLS rows** — missing phone is a warning and imports; duplicate canonical-name+phone or missing required header aborts before DB mutation.
3. **Roster edits on an active participant** — changing name/phone or disabling a roster entry must preserve check-ins but revoke active sessions so stale credentials cannot continue.
4. **Concurrent optimistic toggles** — two in-flight dates must not overwrite each other; a failure rolls back only its own date and recomputes progress from the current state.
5. **Encryption-key mismatch/rotation** — unreadable ciphertext must fail closed in admin APIs without leaking ciphertext, keys, raw DB error messages, or other users' phone data.

---

### Task 1: Roster normalization, encryption, and environment contract

**Files:**
- Create: `src/features/roster/normalize.ts`
- Create: `src/features/roster/crypto.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`
- Test: `tests/roster/normalize.test.ts`
- Test: `tests/roster/crypto.test.ts`
- Modify: `package.json`, `package-lock.json` only for the SheetJS importer dependency used in Task 3

**Interfaces:**
- Produces:
  - `canonicalizeRosterName(value: string): string`
  - `normalizeRosterPhone(value: string): string`
  - `normalizeOptionalPhone(value: string): string | null`
  - `formatPhoneForDisplay(value: string): string`
  - `normalizeVillage(value: string): string | null`
  - `normalizeSam(value: string): string | null`
  - `makeSamLabel(village: string | null, sam: string | null): string | null`
  - `encryptRosterPhone(phone: string): string`
  - `decryptRosterPhone(ciphertext: string): string`
  - `ROSTER_ENCRYPTION_KEY` validated as base64 encoding of exactly 32 bytes

- [ ] **Step 1: Add failing name/sam normalization tests**

Create `tests/roster/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canonicalizeRosterName,
  formatPhoneForDisplay,
  makeSamLabel,
  normalizeOptionalPhone,
  normalizeRosterPhone,
} from "../../src/features/roster/normalize";

describe("roster normalization", () => {
  it.each([
    ["김은희A", "김은희"],
    ["김은희 B", "김은희"],
    ["  김은희b  ", "김은희"],
    ["김은희", "김은희"],
  ])("canonicalizes %s to %s", (input, expected) => {
    expect(canonicalizeRosterName(input)).toBe(expected);
  });

  it("does not strip a fully non-Korean name", () => {
    expect(canonicalizeRosterName("Alice")).toBe("Alice");
  });

  it("normalizes phone punctuation, accepts blank roster phones, and formats admin display", () => {
    expect(normalizeRosterPhone("010-1234-5678")).toBe("01012345678");
    expect(normalizeOptionalPhone("010-1234-5678")).toBe("01012345678");
    expect(normalizeOptionalPhone("")).toBeNull();
    expect(formatPhoneForDisplay("01012345678")).toBe("010-1234-5678");
  });

  it("formats village and sam as village-sam", () => {
    expect(makeSamLabel("1마을", "6샘")).toBe("1-6");
    expect(makeSamLabel(" 12 마을 ", " 3 샘 ")).toBe("12-3");
    expect(makeSamLabel("1마을", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the normalization test and confirm RED**

Run:

```bash
npm test -- tests/roster/normalize.test.ts
```

Expected: FAIL because the roster normalization module does not exist.

- [ ] **Step 3: Implement normalization**

Create `src/features/roster/normalize.ts`:

```ts
export function canonicalizeRosterName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").normalize("NFC");
  if (!normalized) throw new Error("INVALID_NAME");

  const suffix = normalized.match(/^(.+[가-힣])\s*[A-Za-z]+$/u);
  return (suffix?.[1] ?? normalized).trim();
}

export function normalizeRosterPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{9,11}$/.test(digits)) throw new Error("INVALID_PHONE");
  return digits;
}

export function normalizeOptionalPhone(value: string): string | null {
  if (!value.trim()) return null;
  return normalizeRosterPhone(value);
}

export function formatPhoneForDisplay(value: string): string {
  const digits = normalizeRosterPhone(value);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function trimSuffix(value: string, suffix: string): string | null {
  const normalized = value.trim().replace(/\s+/g, "").normalize("NFC");
  if (!normalized) return null;
  const stripped = normalized.endsWith(suffix)
    ? normalized.slice(0, -suffix.length)
    : normalized;
  return stripped || null;
}

export function normalizeVillage(value: string): string | null {
  return trimSuffix(value, "마을");
}

export function normalizeSam(value: string): string | null {
  return trimSuffix(value, "샘");
}

export function makeSamLabel(
  villageValue: string | null,
  samValue: string | null,
): string | null {
  if (!villageValue || !samValue) return null;
  const village = normalizeVillage(villageValue);
  const sam = normalizeSam(samValue);
  return village && sam ? `${village}-${sam}` : null;
}
```

Also change auth `normalizeName()` to delegate to `canonicalizeRosterName()` then apply the existing case normalization, and change auth `normalizePhone()` to delegate to `normalizeRosterPhone()`. The roster module must not import the auth module; this keeps the dependency one-way and avoids an import cycle.

- [ ] **Step 4: Add failing encryption/env tests**

Create `tests/roster/crypto.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

describe("roster phone encryption", () => {
  afterEach(() => vi.resetModules());

  it("round-trips normalized phone without exposing plaintext in ciphertext", async () => {
    process.env.ROSTER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const { encryptRosterPhone, decryptRosterPhone } =
      await import("../../src/features/roster/crypto");

    const cipher = encryptRosterPhone("01012345678");
    expect(cipher).not.toContain("01012345678");
    expect(decryptRosterPhone(cipher)).toBe("01012345678");
  });

  it("rejects tampered ciphertext", async () => {
    process.env.ROSTER_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
    const { encryptRosterPhone, decryptRosterPhone } =
      await import("../../src/features/roster/crypto");

    const cipher = encryptRosterPhone("01012345678");
    const tampered = cipher.slice(0, -1) + (cipher.endsWith("A") ? "B" : "A");
    expect(() => decryptRosterPhone(tampered)).toThrow("PHONE_DECRYPT_FAILED");
  });
});
```

Extend `src/lib/env.test.ts` so a valid test env includes:

```ts
ROSTER_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
```

and assert malformed/non-32-byte keys are rejected.

- [ ] **Step 5: Implement AES-256-GCM and env validation**

Create `src/features/roster/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "../../lib/env";
import { normalizePhone } from "../auth/crypto";

function key(): Buffer {
  const decoded = Buffer.from(getEnv().ROSTER_ENCRYPTION_KEY, "base64");
  if (decoded.length !== 32) throw new Error("INVALID_ROSTER_ENCRYPTION_KEY");
  return decoded;
}

export function encryptRosterPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptRosterPhone(value: string): string {
  try {
    const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
    if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
      throw new Error("INVALID_FORMAT");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("PHONE_DECRYPT_FAILED");
  }
}
```

In `src/lib/env.ts`, require `ROSTER_ENCRYPTION_KEY` as base64 that decodes to exactly 32 bytes:

```ts
const RosterEncryptionKey = z.string().refine((value) => {
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}, "ROSTER_ENCRYPTION_KEY must decode to 32 bytes");

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  PHONE_LOOKUP_PEPPER: z.string().min(32),
  ROSTER_ENCRYPTION_KEY: RosterEncryptionKey,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});
```

Add only the variable name to `.env.example`.

- [ ] **Step 6: Add SheetJS 0.20.3 as an importer-only dev dependency**

Run:

```bash
npm install --save-dev "xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"
```

Do not copy the XLS or SheetJS tarball into the repository.

- [ ] **Step 7: Run Task 1 gates and commit**

Run:

```bash
npm test -- tests/roster/normalize.test.ts tests/roster/crypto.test.ts src/lib/env.test.ts
npm run lint
npm run build
```

Expected: PASS.

Commit:

```bash
git add package.json package-lock.json .env.example src/lib/env.ts src/lib/env.test.ts src/features/auth/crypto.ts src/features/roster tests/roster
git commit -m "feat: add roster normalization and phone encryption"
```

### Task 2: Member roster database migration and repository

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0002_member_roster.sql`
- Create: `src/features/roster/repository.ts`
- Test: `tests/db/roster-schema.test.ts`
- Test: `tests/roster/repository.test.ts`

**Interfaces:**
- Produces:
  - Drizzle `memberRoster` table
  - `users.rosterId`
  - `type RosterCredential`
  - `findActiveRosterCredential(canonicalName: string, phoneLookupHash: string): Promise<RosterCredential | null>`
  - `findRosterById(id: string): Promise<RosterRecord | null>`

- [ ] **Step 1: Write failing schema contract tests**

Create `tests/db/roster-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { memberRoster, users } from "../../src/db/schema";

describe("member roster schema", () => {
  it("exports the roster table", () => {
    expect(getTableName(memberRoster)).toBe("member_roster");
  });

  it("links users to a roster identity", () => {
    expect(users.rosterId).toBeDefined();
  });
});
```

Run and confirm RED.

- [ ] **Step 2: Define the Drizzle model**

Add to `src/db/schema.ts`:

```ts
export const memberRoster = appSchema.table(
  "member_roster",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceName: varchar("source_name", { length: 120 }).notNull(),
    canonicalName: varchar("canonical_name", { length: 80 }).notNull(),
    position: varchar("position", { length: 80 }),
    phoneLookupHash: varchar("phone_lookup_hash", { length: 64 }),
    phoneCiphertext: text("phone_ciphertext"),
    village: varchar("village", { length: 80 }),
    sam: varchar("sam", { length: 80 }),
    samLabel: varchar("sam_label", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    isAdmin: boolean("is_admin").notNull().default(false),
    source: varchar("source", { length: 20 }).notNull(),
    sourceRow: integer("source_row"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("member_roster_name_phone_uq")
      .on(t.canonicalName, t.phoneLookupHash)
      .where(sql`${t.phoneLookupHash} is not null`),
    index("member_roster_name_idx").on(t.canonicalName),
    index("member_roster_sam_idx").on(t.samLabel),
  ],
);

export const users = appSchema.table(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 80 }).notNull(),
    phoneLookupHash: varchar("phone_lookup_hash", { length: 64 }).notNull(),
    phonePasswordHash: text("phone_password_hash").notNull(),
    samId: uuid("sam_id").references(() => sams.id),
    rosterId: uuid("roster_id").references(() => memberRoster.id),
    role: roleEnum("role").notNull().default("member"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_name_phone_uq").on(t.normalizedName, t.phoneLookupHash),
    uniqueIndex("users_roster_uq").on(t.rosterId),
    index("users_sam_idx").on(t.samId),
  ],
);
```

- [ ] **Step 3: Write the SQL migration**

Create `drizzle/0002_member_roster.sql` with matching DDL, including:
- private `prayer_app.member_roster`
- RLS enabled
- explicit deny policies matching the existing private-schema posture
- no `anon` or `authenticated` grants
- partial unique index for non-null phone hashes
- nullable `users.roster_id` foreign key + unique index
- no destructive change to `users.id` or `prayer_checkins.user_id`

Use a named migration through Supabase `apply_migration`.

- [ ] **Step 4: Add repository tests using a fake repository boundary**

Test:
- exact canonical name + hash returns row
- inactive roster row is excluded
- null phone row cannot be returned as a credential
- same name with a different hash does not match

Then implement `src/features/roster/repository.ts` with a single active credential query:

```ts
export async function findActiveRosterCredential(
  canonicalName: string,
  lookupHash: string,
): Promise<RosterCredential | null> {
  const [row] = await getDb()
    .select({
      id: memberRoster.id,
      canonicalName: memberRoster.canonicalName,
      position: memberRoster.position,
      phoneLookupHash: memberRoster.phoneLookupHash,
      village: memberRoster.village,
      sam: memberRoster.sam,
      samLabel: memberRoster.samLabel,
      isActive: memberRoster.isActive,
      isAdmin: memberRoster.isAdmin,
    })
    .from(memberRoster)
    .where(and(
      eq(memberRoster.canonicalName, canonicalName),
      eq(memberRoster.phoneLookupHash, lookupHash),
      eq(memberRoster.isActive, true),
    ))
    .limit(1);

  return row ?? null;
}
```

- [ ] **Step 5: Apply migration and verify Supabase**

Apply the migration, then query:
- `information_schema.columns` for `member_roster`
- `pg_indexes` for the roster unique/indexes
- `users.roster_id` is nullable and unique
- current `prayer_checkins` row count is unchanged

Run both Supabase security and performance advisors. Fix new security findings attributable to this migration before continuing.

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- tests/db/roster-schema.test.ts tests/roster/repository.test.ts
npm run lint
npm run build
git add src/db/schema.ts src/features/roster/repository.ts drizzle/0002_member_roster.sql tests/db tests/roster
git commit -m "feat: add member roster database model"
```

### Task 3: Legacy XLS importer and live roster import

**Files:**
- Create: `src/features/roster/import.ts`
- Create: `scripts/roster-import.ts`
- Modify: `package.json`
- Test: `tests/roster/import.test.ts`
- Never create: a repository copy of `56공동체.xls`

**Interfaces:**
- Produces:
  - `parseRosterWorkbook(filePath: string): ImportCandidate[]`
  - `validateRosterCandidates(rows: ImportCandidate[]): ImportValidation`
  - `importRosterCandidates(rows, options): Promise<ImportSummary>`
  - CLI: `npm run roster:import -- --file /private/path/56공동체.xls`

- [ ] **Step 1: Write parser tests using an in-memory workbook, not real personal data**

Create a generated fixture in the test using SheetJS and write it to a temporary legacy-XLS path:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { utils, write } from "xlsx";

const sheet = utils.aoa_to_sheet([
  ["이름", "교회직분", "핸드폰", "마을", "샘"],
  ["김은희A", "집사", "010-1234-5678", "1마을", "6샘"],
  ["김은희B", "권사", "010-9999-0000", "2마을", "3샘"],
  ["전화없음", "성도", "", "1마을", "7샘"],
]);
const workbook = utils.book_new();
utils.book_append_sheet(workbook, sheet, "명단");
const file = join(mkdtempSync(join(tmpdir(), "roster-")), "fixture.xls");
writeFileSync(file, write(workbook, { type: "buffer", bookType: "xls" }));
```

Tests:
- recognizes required headers
- accepts aliases `직분`, `핸드폰 번호` as defensive compatibility
- preserves source row
- canonicalizes suffix names
- yields sam labels `1-6`, `2-3`
- blank phone yields null lookup/cipher fields and warning
- duplicate canonical-name+normalized-phone causes validation error
- missing required header causes validation error before any repository call

- [ ] **Step 2: Implement workbook parsing**

Use:

```ts
import { readFile, utils } from "xlsx";

const workbook = readFile(filePath, { cellText: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = utils.sheet_to_json<string[]>(sheet, {
  header: 1,
  raw: false,
  defval: "",
});
```

Find the header row by aliases within the first 20 rows. Use formatted text (`raw: false`) so a formatted phone cell keeps its leading zero.

Do not print row values or phone numbers.

- [ ] **Step 3: Write importer transaction tests**

Create a repository interface so the importer can be tested without a live DB.

Assert:
- validation completes before `replaceXlsRoster()` is called
- successful import replaces only `source='xls'` rows, preserving `source='admin'` rows
- import summary contains counts only: total, imported, missingPhone, errors
- no summary/log object contains raw phone
- the admin row is determined from private CLI credential options, not hard-coded source

- [ ] **Step 4: Implement import transaction**

Importer behavior:
1. parse + validate all rows
2. normalize each phone
3. create `phoneLookupHash`
4. create `phoneCiphertext`
5. transaction:
   - delete/replace prior `source='xls'` roster rows only when they are not already linked to a user; linked XLS rows are upserted by credential identity to preserve roster IDs
   - preserve `source='admin'` rows
   - set the privately supplied initial admin credential row `is_admin=true`
   - backfill existing users to roster by existing name/hash match
   - assert every existing active user maps to exactly one roster row before commit
6. rollback the entire transaction if a current participant cannot be mapped

- [ ] **Step 5: Add CLI without putting credentials in source**

`package.json`:

```json
{
  "scripts": {
    "roster:import": "tsx scripts/roster-import.ts"
  }
}
```

CLI reads:
- `--file`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_PHONE`
- existing server env: `DATABASE_URL`, `PHONE_LOOKUP_PEPPER`, `ROSTER_ENCRYPTION_KEY`

The script must never echo any secret or phone number.

- [ ] **Step 6: Validate the actual uploaded XLS privately**

During execution, use the uploaded file at its private runtime path. Do not move/copy it under the Git repository.

Run a dry parse/validation first and verify the approved data characteristics:
- total logical roster rows: 411
- trailing-letter names are canonicalized
- same canonical names remain distinguishable by phone
- missing-phone rows are warnings, not fatal

If the actual file disagrees with any approved assumption, stop before DB mutation and report the exact non-sensitive mismatch.

- [ ] **Step 7: Configure the roster encryption key before live import**

Generate a 32-byte random key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set it as `ROSTER_ENCRYPTION_KEY` for both Preview and Production in Vercel without committing it.

Ensure the trusted import process uses the exact same value. Do not paste this secret into GitHub issues, source, test snapshots, or logs.

- [ ] **Step 8: Run the live import and verify without exposing PII**

Run the importer against `56공동체.xls`.

Then verify in Supabase only with aggregates:

```sql
select
  count(*) as roster_count,
  count(*) filter (where phone_lookup_hash is null) as missing_phone,
  count(*) filter (where is_admin) as admin_rows
from prayer_app.member_roster;
```

Also verify:
- existing participant count unchanged
- existing prayer check-in count unchanged
- existing admin user has non-null `roster_id`
- exactly one roster row is linked to that existing admin user
- no phone plaintext column exists

- [ ] **Step 9: Commit importer code only**

```bash
git add package.json package-lock.json src/features/roster/import.ts scripts/roster-import.ts tests/roster/import.test.ts
git commit -m "feat: add private roster XLS importer"
```

Never `git add` the XLS.

### Task 4: Allowlist login and first-login participant creation

**Files:**
- Modify: `src/features/auth/service.ts`
- Modify: `src/features/auth/crypto.ts`
- Modify: `app/api/auth/login/route.ts`
- Delete: `app/api/auth/register/route.ts`
- Modify: `components/auth/LoginForm.tsx`
- Delete: `components/auth/SamRegistration.tsx`
- Modify: `app/login/page.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/api/profile/route.ts`
- Modify: `src/features/profile/service.ts`
- Modify: `components/profile/ProfileForm.tsx`
- Test: `tests/auth/roster-login.test.ts`
- Modify existing auth tests as required

**Interfaces:**
- Produces:
  - `authenticateRosterLogin(name: string, phone: string, now?: Date): Promise<{ user: SessionUser; token: string } | null>`
  - no public registration endpoint
  - first successful roster login creates `users` exactly once

- [ ] **Step 1: Write failing allowlist auth tests**

Use fake repositories and assert:

```ts
it("authenticates 김은희 against roster 김은희A with the same phone", async () => {
  // canonicalization removes A; matching HMAC finds the roster identity
});

it("rejects the same Korean name with the wrong phone", async () => {
  // no participant is created
});

it("creates a participant exactly once on first successful login", async () => {
  // second login reuses the same user id
});

it("does not allow a roster row without a phone", async () => {
  // fail closed
});

it("does not allow an inactive roster row", async () => {
  // fail closed
});

it("creates an admin participant when roster.isAdmin is true", async () => {
  // user.role === "admin"
});
```

Also test the Review Focus namesake case with two `김은희` rows and different phones.

- [ ] **Step 2: Implement participant ensure transaction**

Refactor auth service around roster identity:

```ts
export async function ensureParticipantForRoster(
  roster: RosterCredential,
  phone: string,
  now = new Date(),
): Promise<{ userId: string; role: "member" | "admin" }> {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.rosterId, roster.id))
      .limit(1);

    if (existing) {
      await tx.update(users).set({
        displayName: roster.canonicalName,
        normalizedName: roster.canonicalName.toLocaleLowerCase("ko-KR"),
        phoneLookupHash: roster.phoneLookupHash!,
        role: roster.isAdmin ? "admin" : "member",
        isActive: roster.isActive,
        updatedAt: now,
      }).where(eq(users.id, existing.id));
      return { userId: existing.id, role: roster.isAdmin ? "admin" : "member" };
    }

    const [created] = await tx.insert(users).values({
      rosterId: roster.id,
      displayName: roster.canonicalName,
      normalizedName: roster.canonicalName.toLocaleLowerCase("ko-KR"),
      phoneLookupHash: roster.phoneLookupHash!,
      phonePasswordHash: await hashPhonePassword(phone),
      role: roster.isAdmin ? "admin" : "member",
      isActive: true,
    }).returning({ id: users.id });

    return { userId: created.id, role: roster.isAdmin ? "admin" : "member" };
  });
}
```

Do not create or change `prayer_checkins` here.

- [ ] **Step 3: Replace login flow**

`POST /api/auth/login`:
- rate-limit by canonical name + IP as today
- canonicalize name
- normalize phone
- compute phone HMAC
- find active roster credential
- if absent, record failure and return generic `401 { code: "ROSTER_MISMATCH" }`
- if present, ensure/reuse participant
- clear failures
- create session
- set existing HttpOnly rolling cookie
- return `{ status: "ok" }`

Delete the `REGISTRATION_REQUIRED` branch entirely.

- [ ] **Step 4: Remove self-registration/sam selection UI**

`LoginForm` always stays on the name/phone screen for a mismatch.

Display:

```text
등록된 명단과 일치하지 않습니다. 이름과 전화번호를 확인해 주세요.
```

Remove `SamRegistration` and `/api/auth/register`.

- [ ] **Step 5: Make profile roster-driven and non-editable**

Replace the current sam-edit profile behavior with read-only:
- 이름
- 직분
- 전화번호 is NOT shown on ordinary member profile unless explicitly desired later
- 샘 label

Make `GET /api/profile` roster-driven and remove/disable general-user `PATCH /api/profile`; admin remains the only roster editor. A PATCH attempt from a member returns `405 METHOD_NOT_ALLOWED` or the route no longer exports PATCH.

- [ ] **Step 6: Run auth tests, build, and commit**

```bash
npm test -- tests/auth tests/roster
npm run lint
npm run build
git add src/features/auth app/api/auth app/login components/auth app/profile components/profile
git commit -m "feat: switch login to roster allowlist"
```

### Task 5: Roster-driven participant identity, statistics, and admin CRUD

**Files:**
- Create: `src/features/admin/roster-service.ts`
- Modify: `src/features/admin/service.ts`
- Modify: `src/features/checkins/service.ts`
- Modify: `src/lib/types.ts`
- Create: `app/api/admin/roster/route.ts`
- Modify: `app/api/admin/users/route.ts`
- Modify: `components/admin/AdminDashboard.tsx`
- Test: `tests/admin/roster.test.ts`
- Test: `tests/admin/participant-view.test.ts`

**Interfaces:**
- Produces:
  - `listRosterForAdmin(filters): Promise<AdminRosterRow[]>`
  - `createRosterMember(input): Promise<string>`
  - `updateRosterMember(id, input): Promise<void>`
  - participant rows include `name, position, phone, samLabel`
  - member dashboard identity reads roster canonical name/sam label
  - stats group by `member_roster.sam_label`, not legacy `sams`

- [ ] **Step 1: Write failing participant projection tests**

Assert participant output order semantically:

```ts
expect(row).toMatchObject({
  name: "김은희",
  position: "집사",
  phone: "010-1234-5678",
  samLabel: "1-6",
});
```

Test that roster-only rows are excluded from participant totals and rankings until a `users` row exists.

Test same sam label aggregation:
- two logged-in `1-6` participants count as 2
- five other roster-only `1-6` people do not enter denominator

- [ ] **Step 2: Make dashboard/member identity roster-driven**

Change `CheckinRepository.getMemberIdentity` to join `users.roster_id → member_roster.id` and return:
- canonical name
- position
- sam label

No new code should use `users.sam_id` or legacy `sams.name` as the source of member identity.

- [ ] **Step 3: Write admin roster CRUD tests**

Cover:
- admin can create a `source='admin'` roster row
- new row gets canonical name, HMAC lookup hash, encrypted phone, sam label
- edit updates fields and preserves roster id
- changing name or phone revokes all linked sessions
- deactivating row sets linked user inactive and revokes sessions
- reactivating row allows a future login
- changing `isAdmin` synchronizes linked `users.role`
- duplicate canonical name + phone returns 409
- decrypt failure returns a generic admin error and does not leak ciphertext or key

- [ ] **Step 4: Implement roster admin service**

Input type:

```ts
export type AdminRosterInput = {
  name: string;
  position: string | null;
  phone: string | null;
  village: string | null;
  sam: string | null;
  isActive: boolean;
  isAdmin: boolean;
};
```

For create/update:
- canonicalize name
- normalize phone if present
- compute HMAC if present
- encrypt phone if present
- recompute sam label server-side
- never accept `samLabel` directly from client
- perform conflict checks in a transaction
- revoke linked sessions when auth identity changes
- synchronize linked participant user state/role

- [ ] **Step 5: Add admin roster API**

`GET /api/admin/roster?q=&participation=all|joined|not_joined`:
- admin-only
- returns paginated/limited rows with decrypted phone passed through `formatPhoneForDisplay()` for admin use
- search name, phone (by normalized exact phone when query is phone-like), and sam label
- default limit 100; support offset/next pagination so 411 rows do not create one huge response

`POST` creates.
`PATCH` edits.

Every method calls `requireAdmin` server-side.

- [ ] **Step 6: Refactor admin UI into two clear sections**

**참여자 명단**:
- only logged-in users
- first columns/cards in this exact order:
  1. 이름
  2. 직분
  3. 전화번호
  4. 샘
- then rank/progress/today status
- sam displays `1-6`, never legacy sam name

**전체 로그인 허용 명단**:
- roster rows
- joined/not joined indicator
- search
- add button
- edit button
- active/admin toggles inside edit form

Under 640px, display stacked cards but preserve the same field order.

- [ ] **Step 7: Remove legacy sam editing as member identity source**

The old `sams` table/admin sam editor may remain for backward-compatible migration history, but:
- it is no longer shown as the authoritative member management UI
- new roster CRUD owns village/sam fields
- no new participant/stat query joins legacy `users.sam_id`

- [ ] **Step 8: Run tests and commit**

```bash
npm test -- tests/admin tests/checkins
npm run lint
npm run build
git add src/features/admin src/features/checkins src/lib/types.ts app/api/admin components/admin
git commit -m "feat: add roster administration and participant views"
```

### Task 6: Preserve and verify the existing 현식 admin participant

**Files:**
- No source changes unless Task 3 import/backfill exposes a bug
- Add migration verification notes: `docs/operations.md`
- Test: live Supabase verification queries

**Interfaces:**
- Consumes: imported roster and existing user/check-in/session data
- Produces: one existing admin user linked by `users.roster_id`, unchanged `users.id`, unchanged prayer records

- [ ] **Step 1: Capture pre-migration aggregate baselines**

Before live roster backfill, record non-sensitive counts:
- users
- prayer_checkins
- sessions
- challenges

Do not print phone/hash/ciphertext.

- [ ] **Step 2: Verify current admin mapping after import**

Query by the current admin user id already present in the database, not by embedding their phone in SQL/source.

Assert:
- `users.roster_id is not null`
- linked roster canonical name is `현식`
- linked roster `is_admin=true`
- user `role='admin'`
- user `is_active=true`
- existing check-ins still reference the same user id

- [ ] **Step 3: Verify first-login participation semantics**

Use a non-admin roster entry that has never logged in:
- confirm it exists in `member_roster`
- confirm no `users` row exists
- login with the roster credential in Preview
- confirm exactly one new `users` row is created
- log out/in again
- confirm no duplicate `users` row

Delete only a deliberately created test participant after verification if it is not a real roster member; never delete a real member's row/check-ins.

- [ ] **Step 4: Update operations documentation**

Document:
- roster is login allowlist
- participant means logged-in user
- roster import command and privacy rules
- `ROSTER_ENCRYPTION_KEY` rotation requires re-encrypting roster phones before switching keys
- editing auth identity revokes sessions
- XLS is never stored in repo/runtime

- [ ] **Step 5: Commit documentation**

```bash
git add docs/operations.md
git commit -m "docs: document roster-based participant operations"
```

### Task 7: Optimistic prayer check-in UI

**Files:**
- Create: `src/features/checkins/optimistic.ts`
- Modify: `components/dashboard/PrayerDashboardClient.tsx`
- Modify: `components/calendar/PrayerCalendar.tsx`
- Modify: `app/api/checkins/route.ts`
- Test: `tests/checkins/optimistic.test.ts`
- Modify: `tests/checkins/service.test.ts`

**Interfaces:**
- Produces:
  - `optimisticToggleDashboard(dashboard, prayerDate): MemberDashboard`
  - `reconcileCheckinState(dashboard, prayerDate, state): MemberDashboard`
  - POST `/api/checkins` returns `{ state: "checked" | "unchecked" }` only
  - Calendar accepts `pendingDates: ReadonlySet<string>`

- [ ] **Step 1: Write failing pure optimistic-state tests**

Create `tests/checkins/optimistic.test.ts`:

```ts
it("shows a check and progress immediately before any server response", () => {
  const next = optimisticToggleDashboard(baseDashboard, "2026-09-23");
  expect(next.completedDates).toContain("2026-09-23");
  expect(next.progress.completed).toBe(baseDashboard.progress.completed + 1);
});

it("rolls back only the failed date while preserving another optimistic date", () => {
  const a = optimisticToggleDashboard(baseDashboard, "2026-09-23");
  const b = optimisticToggleDashboard(a, "2026-09-22");
  const rolledBackFirst = reconcileCheckinState(b, "2026-09-23", "unchecked");
  expect(rolledBackFirst.completedDates).not.toContain("2026-09-23");
  expect(rolledBackFirst.completedDates).toContain("2026-09-22");
});

it("reconciles an unexpected server state without replacing unrelated dates", () => {
  // pin race-safe behavior
});
```

- [ ] **Step 2: Implement optimistic helpers**

Helpers use the existing pure `calculateProgress()`:

```ts
function withCompletedDates(
  dashboard: MemberDashboard,
  completedDates: string[],
): MemberDashboard {
  const unique = [...new Set(completedDates)].sort();
  return {
    ...dashboard,
    completedDates: unique,
    progress: calculateProgress({
      startDate: dashboard.challenge.startDate,
      endDate: dashboard.challenge.endDate,
      today: dashboard.today,
      completedDates: unique,
    }),
  };
}
```

No network code belongs in this helper.

- [ ] **Step 3: Shrink the POST API response**

Change `POST /api/checkins` from:
- toggle
- re-query the entire dashboard
- return `{ state, dashboard }`

to:
- toggle
- return `{ state }`

Keep `GET` unchanged for initial/reload state.

This removes the second DB query from every tap.

- [ ] **Step 4: Implement per-date optimistic requests**

`PrayerDashboardClient`:
- replace `busyDate: string | null` with `pendingDates: Set<string>`
- before fetch:
  - capture `previouslyChecked = dashboard.completedDates.includes(date)`
  - immediately `setDashboard(current => optimisticToggleDashboard(current, date))`
  - add only that date to pending set
- on success:
  - `setDashboard(current => reconcileCheckinState(current, date, body.state))`
- on failure:
  - reconcile date back to `previouslyChecked ? "checked" : "unchecked"`
  - show small inline retry message
- finally remove only that date from pending set

Use functional React state setters in every async completion path.

- [ ] **Step 5: Allow another mutable date while one is pending**

`PrayerCalendar`:
- disable a date only when `pendingDates.has(date)`
- do not disable every button when any request is running
- add `aria-busy` on the pending date
- preserve existing Sunday/range/today-yesterday disabled reasons

- [ ] **Step 6: Run tests/build and commit**

```bash
npm test -- tests/checkins tests/challenge
npm run lint
npm run build
git add src/features/checkins components/dashboard components/calendar app/api/checkins tests/checkins
git commit -m "feat: make prayer check-ins optimistic"
```

### Task 8: Preview integration verification, security review, and PR readiness

**Files:**
- Modify tests only when verification reveals a missing regression case
- Modify: `docs/superpowers/execution/2026-09-23-roster-auth-progress.md`
- Modify: `docs/operations.md` if final behavior differs from earlier docs

**Interfaces:**
- Produces a Preview-tested PR with roster data loaded, current admin preserved, no PII in Git, and responsive check-in behavior.

- [ ] **Step 1: Run the full local/CI suite**

```bash
npm ci
npm test
npm run lint
npm run build
npm run test:e2e
```

Expected:
- all unit tests PASS
- lint has 0 errors
- production build PASS
- non-seeded browser tests PASS

- [ ] **Step 2: Add Preview login E2E/manual verification**

On Vercel Preview, verify with real roster credentials without recording them in test source:
1. roster person logs in
2. no sam-registration screen appears
3. dashboard name/sam label are roster-driven
4. refresh/browser reopen remains logged in
5. unknown credentials are rejected and cannot self-register

For the current admin:
1. existing session or fresh login reaches `/admin`
2. participant list row shows **이름 → 직분 → 전화번호 → 샘** in order
3. current admin status is preserved

- [ ] **Step 3: Verify admin roster CRUD on a synthetic admin-created row**

Use a non-real synthetic test identity:
- add via admin UI
- edit position/village/sam
- verify sam label changes
- login using synthetic credential and confirm participant count increases only after first login
- change phone and verify previous session is revoked
- deactivate and verify login is blocked
- clean up the synthetic roster/user/session rows after the test

Never use a real person's roster row for destructive CRUD testing.

- [ ] **Step 4: Verify optimistic check-in perceptually and in DB**

On Preview:
1. tap today
2. visually confirm checkmark and progress change before network completion
3. query Supabase and confirm one check-in row
4. tap again; UI clears immediately
5. confirm DB row is removed
6. test yesterday independently if it is a prayer day
7. induce a safe failing request in a test path and confirm only that date rolls back

- [ ] **Step 5: Run Supabase advisors**

Run:
- Security Advisor
- Performance Advisor

Requirements:
- no new unresolved security findings from `member_roster`
- document expected informational unused-index findings if any
- verify RLS/private grants still block `anon/authenticated`

- [ ] **Step 6: PII/source-control scan**

Search Git history/tree for:
- `56공동체.xls`
- the real current administrator phone in both dashed and digit-only forms
- generic mobile regex `01[016789][- ]?\d{3,4}[- ]?\d{4}`; manually verify every match is confined to synthetic test fixtures
- `ROSTER_ENCRYPTION_KEY=`
- copied real roster names outside approved synthetic fixtures

Any real roster PII in Git is a release blocker. Synthetic phone fixtures may remain only in test files and must not match a real roster credential.

- [ ] **Step 7: Record final verification and update PR**

Execution log must record:
- roster aggregate import counts only
- test counts
- CI run IDs
- Vercel Preview deployment status
- Supabase advisor status
- current admin/check-in preservation checks
- any deferred low-risk issue

Update PR #1 summary to include the roster-auth and optimistic-check-in changes.

Do not merge `main` until this task is green and the user approves the Preview behavior.
