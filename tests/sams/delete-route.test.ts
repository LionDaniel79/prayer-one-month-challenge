import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ user: vi.fn(), remove: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: boundary.user }));
vi.mock("../../src/features/sams/admin-service", () => ({
  listSamLeadersForAdmin: vi.fn(), saveSamLeader: vi.fn(), deleteSamLeaders: boundary.remove,
}));
import * as route from "../../app/api/admin/sams/route";

const id = "00000000-0000-4000-8000-000000000001";
const request = (body: unknown) => new Request("https://example.test/api/admin/sams", {
  method: "DELETE", body: JSON.stringify(body),
});

beforeEach(() => {
  boundary.user.mockReset().mockResolvedValue({ id: "admin", role: "admin" });
  boundary.remove.mockReset().mockResolvedValue(1);
});

describe("sam leader deletion boundary", () => {
  it.each([null, { id: "member", role: "member" }])("rejects unauthorized deletion before persistence", async (user) => {
    boundary.user.mockResolvedValue(user);
    const response = await route.DELETE(request({ ids: [id] }));
    expect(response.status).toBe(403);
    expect(boundary.remove).not.toHaveBeenCalled();
  });
  it.each([{ ids: [] }, { ids: ["bad"] }, { ids: Array(501).fill(id) }, null])("rejects invalid selection", async (body) => {
    const response = await route.DELETE(request(body));
    expect(response.status).toBe(400);
    expect(boundary.remove).not.toHaveBeenCalled();
  });
  it("deduplicates selection and reports the actual deletion count", async () => {
    const response = await route.DELETE(request({ ids: [id, id] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", deleted: 1 });
    expect(boundary.remove).toHaveBeenCalledWith([id]);
  });
  it("returns a recoverable JSON error without exposing database details", async () => {
    boundary.remove.mockRejectedValue(new Error("private database details"));
    const response = await route.DELETE(request({ ids: [id] }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "SAM_LEADER_DELETE_FAILED" });
  });
});
