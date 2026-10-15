import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import type { SessionUser } from "../src/features/auth/session";
import { GET as memberGet } from "../app/api/prayer-menu/route";
import { GET as adminGet, PUT } from "../app/api/admin/prayer/menu-settings/route";
import { getPrayerMenuSettings } from "../src/features/prayer-menu/service";

const boundary = vi.hoisted(() => ({ query: vi.fn(), actor: null as SessionUser | null }));
vi.mock("../src/db/client", () => ({ getDb: () => drizzle(boundary as unknown as Pool) }));
vi.mock("../src/features/auth/http-session", () => ({ getCurrentSessionUser: async () => boundary.actor }));
const admin: SessionUser = { id: "admin", displayName: "관리자", samId: null, role: "admin" };
type Query = string | { text: string };
const sqlText = (query: Query) => typeof query === "string" ? query : query.text;
function put(body: unknown, headers: Record<string, string> = {}) {
  return PUT(new Request("http://localhost/api/admin/prayer/menu-settings", {
    method: "PUT", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  }));
}
beforeEach(() => { boundary.actor = admin; boundary.query.mockReset(); boundary.query.mockResolvedValue({ rows: [[true, "기도운동", ""]] }); });

describe("global prayer menu setting", () => {
  it("defaults to enabled when the singleton has not been inserted", async () => {
    boundary.query.mockResolvedValue({ rows: [] });
    expect(await getPrayerMenuSettings()).toEqual({ enabled: true, name: "기도운동", description: "" });
  });
  it.each(["member", "admin"] as const)("returns the same saved false value to %s without caching", async (role) => {
    boundary.actor = { ...admin, role };
    boundary.query.mockResolvedValue({ rows: [[false, "말씀 읽기", "매일 한 장\n함께 읽어요."]] });
    const response = await memberGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: false, name: "말씀 읽기", description: "매일 한 장\n함께 읽어요." });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(boundary.query.mock.calls[0][1]).toEqual([1, 1]); // singleton id and LIMIT
  });
  it("rejects anonymous reads without accessing the database", async () => {
    boundary.actor = null;
    expect((await memberGet()).status).toBe(401);
    expect(boundary.query).not.toHaveBeenCalled();
  });
  it.each([null, { ...admin, role: "member" as const }])("checks admin authorization before reading or writing", async (actor) => {
    boundary.actor = actor;
    expect((await adminGet()).status).toBe(403);
    expect((await put({ enabled: false })).status).toBe(403);
    expect(boundary.query).not.toHaveBeenCalled();
  });
  it.each([{}, null, { enabled: "false" }, { enabled: 0 }, { enabled: null }, { enabled: true, userId: "someone" }])("rejects malformed or per-user input %j", async (body) => {
    expect((await put(body)).status).toBe(400);
    expect(boundary.query).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    const response = await PUT(new Request("http://localhost/api/admin/prayer/menu-settings", { method: "PUT", body: "{" }));
    expect(response.status).toBe(400);
    expect(boundary.query).not.toHaveBeenCalled();
  });
  const crossSiteHeaders: Record<string, string>[] = [{ origin: "https://other.invalid" }, { "sec-fetch-site": "cross-site" }];
  it.each(crossSiteHeaders)("rejects cross-site writes", async (headers) => {
    expect((await put({ enabled: false }, headers)).status).toBe(403);
    expect(boundary.query).not.toHaveBeenCalled();
  });
  it.each([false, true])("upserts only the singleton and returns the persisted %s value", async (enabled) => {
    boundary.query.mockResolvedValue({ rows: [[enabled, "기도운동", ""]] });
    const response = await put({ enabled }, { origin: "http://localhost" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled, name: "기도운동", description: "" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(boundary.query).toHaveBeenCalledTimes(1);
    const [query, params] = boundary.query.mock.calls[0];
    expect(sqlText(query)).toMatch(/^insert into "prayer_app"\."prayer_menu_settings"/);
    expect(sqlText(query)).toContain("on conflict");
    expect(params.slice(0, 2)).toEqual([1, enabled]);
    expect(sqlText(query)).not.toMatch(/prayer_checkins|challenges|users/);
  });
  it("does not convert a failed write into success", async () => {
    boundary.query.mockRejectedValue(new Error("DB_UNAVAILABLE"));
    await expect(put({ enabled: false })).rejects.toThrow();
  });
  it("saves the trimmed name and multiline description without touching participation records", async () => {
    boundary.query.mockResolvedValue({ rows: [[true, "말씀 읽기", "매일 한 장\n함께 읽어요."]] });
    const response = await put({ enabled: true, name: "  말씀 읽기  ", description: "  매일 한 장\n함께 읽어요.  " });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: true, name: "말씀 읽기", description: "매일 한 장\n함께 읽어요." });
    const [query, params] = boundary.query.mock.calls[0];
    expect(params).toContain("말씀 읽기");
    expect(params).toContain("매일 한 장\n함께 읽어요.");
    expect(params).not.toContain("  말씀 읽기  ");
    expect(sqlText(query)).not.toMatch(/prayer_checkins|challenges|users/);
  });
  it("does not overwrite the saved name or description on a legacy visibility-only update", async () => {
    boundary.query.mockResolvedValue({ rows: [[false, "말씀 읽기", "기존 설명"]] });
    const response = await put({ enabled: false });
    expect(await response.json()).toEqual({ enabled: false, name: "말씀 읽기", description: "기존 설명" });
    const update = sqlText(boundary.query.mock.calls[0][0]).split("do update set")[1].split("returning")[0];
    expect(update).not.toMatch(/"name"|"description"/);
  });
  it.each([{ name: " " }, { name: "가".repeat(41) }, { description: "가".repeat(2001) }, { name: null }, { description: 7 }])("rejects invalid presentation fields %j", async (fields) => {
    expect((await put({ enabled: true, ...fields })).status).toBe(400);
    expect(boundary.query).not.toHaveBeenCalled();
  });
});
