import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { SessionUser } from "../../src/features/auth/session";
import { prayerRequests } from "../../src/db/schema";

vi.mock("server-only", () => ({}));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: vi.fn() }));

import { getCurrentSessionUser } from "../../src/features/auth/http-session";
import { getDb } from "../../src/db/client";
import * as route from "../../app/api/admin/prayer-requests/[id]/route";

const targetId = "00000000-0000-4000-8000-000000000101";
const otherId = "00000000-0000-4000-8000-000000000102";
const rows = new Set<string>();
const where = vi.fn(async (condition: SQL) => {
  const query = new PgDialect().sqlToQuery(condition);
  expect(query.sql).toBe('"prayer_app"."prayer_requests"."id" = $1');
  rows.delete(query.params[0] as string);
});
const remove = vi.fn((table: unknown) => {
  expect(table).toBe(prayerRequests);
  return { where };
});
const context = (id = targetId) => ({ params: Promise.resolve({ id }) });
const request = (method: string) => new Request(`https://example.test/api/admin/prayer-requests/${targetId}`, {
  method,
  ...(method === "PATCH" ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "completed" }) } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  rows.clear();
  rows.add(targetId);
  rows.add(otherId);
  vi.mocked(getCurrentSessionUser).mockResolvedValue({ id: "admin", role: "admin" } as SessionUser);
  vi.mocked(getDb).mockReturnValue({ delete: remove } as unknown as ReturnType<typeof getDb>);
});

describe("administrator prayer request deletion", () => {
  it.each([null, { id: "member", role: "member" } as SessionUser])("rejects non-administrators before data access: %j", async (user) => {
    vi.mocked(getCurrentSessionUser).mockResolvedValue(user);
    const response = await route.DELETE(request("DELETE"), context());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
    expect(rows.size).toBe(2);
  });

  it("deletes only the requested record and succeeds when the same deletion is retried", async () => {
    const first = await route.DELETE(request("DELETE"), context());
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: "ok" });
    expect([...rows]).toEqual([otherId]);
    const retry = await route.DELETE(request("DELETE"), context());
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ status: "ok" });
    expect([...rows]).toEqual([otherId]);
  });

  it.each(["GET", "PATCH", "DELETE"] as const)("rejects malformed IDs before %s data access", async (method) => {
    const response = await route[method](request(method), context("not-a-uuid"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_INPUT" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("does not report a database failure as a successful deletion", async () => {
    where.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(route.DELETE(request("DELETE"), context())).rejects.toThrow("database unavailable");
    expect([...rows]).toEqual([targetId, otherId]);
  });
});
