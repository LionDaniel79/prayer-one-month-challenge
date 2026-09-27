import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import type { SessionUser } from "../../src/features/auth/session";
import { DELETE } from "../../app/api/admin/prayer/participants/[id]/route";
import { getAdminDashboard } from "../../src/features/admin/service";
import { getAdminHubDashboard } from "../../src/features/admin/hub-service";

const boundary = vi.hoisted(() => ({ query: vi.fn(), actor: null as SessionUser | null }));
vi.mock("../../src/db/client", () => ({ getDb: () => drizzle(boundary as unknown as Pool) }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: async () => boundary.actor }));

const challengeId = "00000000-0000-4000-8000-000000000001";
const nextChallengeId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";
const admin: SessionUser = { id: "admin", displayName: "관리자", samId: null, role: "admin" };
type Query = string | { text: string };
const sqlText = (query: Query) => typeof query === "string" ? query : query.text;

function statements() {
  return boundary.query.mock.calls.map(([query, params]) => ({ sql: sqlText(query), params }));
}

function writes() {
  return statements().filter(({ sql }) => /^(insert|update|delete)/.test(sql));
}

function deletionDatabase({ activeId = challengeId, targetExists = true }: { activeId?: string | null; targetExists?: boolean } = {}) {
  boundary.query.mockImplementation(async (query: Query) => {
    const text = sqlText(query);
    if (text.startsWith("select") && text.includes('from "prayer_app"."challenges"')) return { rows: activeId ? [[activeId]] : [] };
    if (text.startsWith("select") && text.includes('from "prayer_app"."users"')) return { rows: targetExists ? [[userId]] : [] };
    return { rows: [] };
  });
}

async function remove(body: unknown = { challengeId }, target = userId) {
  return DELETE(new Request(`http://localhost/api/admin/prayer/participants/${target}`, {
    method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: target }) });
}

beforeEach(() => { boundary.query.mockReset(); boundary.actor = admin; });

describe("remove participant only from the active prayer challenge", () => {
  it.each([null, { ...admin, role: "member" as const }])("requires an administrator before reading or writing member data", async (actor) => {
    boundary.actor = actor;
    const response = await remove();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "FORBIDDEN" });
    expect(boundary.query).not.toHaveBeenCalled();
  });

  it("requires explicit valid challenge and participant ids", async () => {
    expect((await remove({})).status).toBe(400);
    expect((await remove({ challengeId: "bad-id" })).status).toBe(400);
    expect((await remove({ challengeId }, "bad-id")).status).toBe(400);
    expect(boundary.query).not.toHaveBeenCalled();
  });

  it("rejects an old screen after another challenge becomes active", async () => {
    deletionDatabase({ activeId: nextChallengeId });
    const response = await remove();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "CHALLENGE_CHANGED" });
    expect(writes()).toEqual([]);
  });

  it("cannot remove participation without an active challenge", async () => {
    deletionDatabase({ activeId: null });
    const response = await remove();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "NO_ACTIVE_CHALLENGE" });
    expect(writes()).toEqual([]);
  });

  it("rejects a nonexistent or inactive participant", async () => {
    deletionDatabase({ targetExists: false });
    expect((await remove()).status).toBe(404);
    expect(writes()).toEqual([]);
  });

  it("writes only the challenge-specific exclusion and makes repeated removal idempotent", async () => {
    deletionDatabase();
    expect((await remove()).status).toBe(200);
    expect((await remove()).status).toBe(200);
    expect(writes()).toHaveLength(2);
    for (const statement of writes()) {
      expect(statement.sql).toMatch(/^insert into "prayer_app"\."prayer_participant_exclusions"/);
      expect(statement.sql).toContain('on conflict ("challenge_id","user_id") do nothing');
      expect(statement.params).toEqual([challengeId, userId]);
    }
    const challengeRead = statements().find(({ sql }) => sql.includes('from "prayer_app"."challenges"'))!;
    expect(challengeRead.sql).toContain('"is_active" = $1');
    expect(challengeRead.sql).toContain("for share");
    const participantRead = statements().find(({ sql }) => sql.includes('from "prayer_app"."users"'))!;
    expect(participantRead.sql).toContain('"is_active" = $2');
    expect(participantRead.params).toEqual([userId, true, 1]);
  });
});

function expectChallengeFilter(statement: { sql: string; params: unknown[] }) {
  expect(statement.sql).toContain('not exists (select 1 from "prayer_app"."prayer_participant_exclusions"');
  expect(statement.sql).toMatch(/"prayer_app"\."prayer_participant_exclusions"\."challenge_id" = \$\d+/);
  expect(statement.sql).toContain('"prayer_app"."prayer_participant_exclusions"."user_id" = "prayer_app"."users"."id"');
  expect(statement.params).toContain(challengeId);
}

describe("prayer participation exclusion query scope", () => {
  it("filters the participant list before calculating all prayer statistics", async () => {
    boundary.query.mockImplementation(async (query: Query) => {
      const text = sqlText(query);
      if (text.includes('from "prayer_app"."challenges"')) return { rows: [[challengeId, "가을 기도", "2026-09-01", "2026-09-30", true]] };
      return { rows: [] };
    });
    const result = await getAdminDashboard(new Date("2026-09-27T00:00:00Z"));
    const participantRead = statements().find(({ sql }) => sql.includes('from "prayer_app"."users"'))!;
    expectChallengeFilter(participantRead);
    expect(result.totals).toEqual({ members: 0, todayCompleted: 0, todayRate: 0, averageRate: 0 });
  });

  it("applies the same challenge exclusion to hub population and today's completion count", async () => {
    boundary.query.mockImplementation(async (query: Query) => {
      const text = sqlText(query);
      if (text.includes('from "prayer_app"."challenges"')) return { rows: [[challengeId]] };
      if (text.includes("count(*)")) return { rows: [[0]] };
      return { rows: [] };
    });
    const result = await getAdminHubDashboard(new Date("2026-09-27T00:00:00Z"));
    const countQueries = statements().filter(({ sql }) => sql.includes("count(*)") && (
      sql.includes('from "prayer_app"."users"') || sql.includes('from "prayer_app"."prayer_checkins"')
    ));
    expect(countQueries).toHaveLength(2);
    countQueries.forEach(expectChallengeFilter);
    expect(result.prayer).toEqual({ participants: 0, todayCompleted: 0, todayRate: 0 });
  });
});
