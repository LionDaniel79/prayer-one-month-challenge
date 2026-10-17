import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("server-only", () => ({}));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: vi.fn() }));
import { getCurrentSessionUser } from "../../src/features/auth/http-session";
import { getDb } from "../../src/db/client";
import { getPendingNotifications } from "../../src/features/admin/pending-notifications";
import { GET } from "../../app/api/admin/notifications/route";

beforeEach(() => vi.resetAllMocks());
describe("pending community notifications", () => {
  it.each([null, { id: "member", displayName: "가상성도", samId: null, role: "member" as const }])("requires an administrator before querying: %j", async actor => {
    vi.mocked(getCurrentSessionUser).mockResolvedValue(actor);
    const response = await GET(new Request("https://example.test/api/admin/notifications"));
    expect(response.status).toBe(403); expect(getDb).not.toHaveBeenCalled();
  });
  it("rejects an invalid page before database access", async () => {
    vi.mocked(getCurrentSessionUser).mockResolvedValue({ id: "admin", displayName: "가상관리자", samId: null, role: "admin" });
    const response = await GET(new Request("https://example.test/api/admin/notifications?page=0"));
    expect(response.status).toBe(400); expect(getDb).not.toHaveBeenCalled();
  });
  it("uses a single metadata-only snapshot for filtered counts and five-row pagination", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ total: 12, pages: 3, page: 3, prayer: 5, visits: 5, reports: 2, items: [] }] });
    vi.mocked(getDb).mockReturnValue({ execute } as unknown as ReturnType<typeof getDb>);
    const result = await getPendingNotifications(3);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.activityPagination).toEqual({ total: 12, pages: 3, page: 3, pageSize: 5 });
    expect(result.counts).toEqual({ prayer: 5, visits: 5, reports: 2 });
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
    expect(query).not.toMatch(/q\.content|v\.reason|p\.form|p\.files|prayer_app\.notices/i);
  });
  it("returns a private empty result as one empty page without inventing pending records", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ total: 0, pages: 1, page: 1, prayer: 0, visits: 0, reports: 0, items: [] }] });
    vi.mocked(getDb).mockReturnValue({ execute } as unknown as ReturnType<typeof getDb>);
    vi.mocked(getCurrentSessionUser).mockResolvedValue({ id: "admin", displayName: "가상관리자", samId: null, role: "admin" });
    const response = await GET(new Request("https://example.test/api/admin/notifications"));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).activityPagination).toEqual({ total: 0, pages: 1, page: 1, pageSize: 5 });
  });
});
