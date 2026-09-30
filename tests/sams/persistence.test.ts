import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { dbSamLeaderRepository, prepareSamLeaderValues } from "../../src/features/sams/admin-service";

const boundary = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../src/db/client", () => ({
  getDb: () => drizzle(boundary as unknown as Pool),
}));

type Statement = { text: string };

function databaseWithSams(existing: Array<[string, string]>) {
  boundary.query.mockImplementation(async (query: Statement | string) => ({
    rows: (typeof query === "string" ? query : query.text).startsWith("select") && !(typeof query === "string" ? query : query.text).includes("member_roster") ? existing.map(([id,name])=>[id,name,"",null,false]) : [],
  }));
}

function writes() {
  return boundary.query.mock.calls
    .map(([query, params]) => ({ text: typeof query === "string" ? query : query.text, params }))
    .filter(({ text }) => /^(update|insert|delete)/.test(text));
}

beforeEach(() => { boundary.query.mockReset(); });

describe("sam leader persistence", () => {
  it("updates an existing label alias by id without recreating the sam", async () => {
    databaseWithSams([["existing-sam", "01-02샘"]]);
    await dbSamLeaderRepository.upsertLeaders([
      prepareSamLeaderValues({ name: "1마을-2샘", leaderName: "김가람A 집사" }),
    ]);
    expect(writes()).toEqual([{
      text: expect.stringMatching(/^update "prayer_app"\."sams" set .*"leader_roster_id".*"leader_binding_locked".* where "prayer_app"\."sams"\."id" = \$6$/),
      params: ["1-2", "김가람A", null, false, true, "existing-sam"],
    }]);
  });

  it("inserts a new mapping and retains unrelated existing sams", async () => {
    databaseWithSams([["unrelated-sam", "5-6"]]);
    await dbSamLeaderRepository.upsertLeaders([
      prepareSamLeaderValues({ name: "1-2", leaderName: "김가람", isActive: false }),
    ]);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].text).toMatch(/^insert into "prayer_app"\."sams"/);
    expect(writes()[0].params).toEqual(["1-2", "김가람", null, false, false, "1-2", "김가람", null, false, false]);
  });

  it("rejects ambiguous existing mappings before changing either row", async () => {
    databaseWithSams([["sam-one", "1-2"], ["sam-two", "1-2샘"]]);
    await expect(dbSamLeaderRepository.upsertLeaders([
      prepareSamLeaderValues({ name: "1-2", leaderName: "김가람" }),
    ])).rejects.toThrow("SAM_LEADER_DUPLICATE");
    expect(writes()).toEqual([]);
  });

  it("rejects empty or excessive leader names after title removal", () => {
    expect(() => prepareSamLeaderValues({ name: "1-2", leaderName: "집사" })).toThrow("SAM_LEADER_ROW_INVALID");
    expect(() => prepareSamLeaderValues({ name: "1-2", leaderName: "가".repeat(101) })).toThrow("SAM_LEADER_ROW_INVALID");
  });
});
