import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const boundary = vi.hoisted(() => ({ session: vi.fn(), search: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: boundary.session }));
vi.mock("../../src/features/sams/service", () => ({ searchSams: boundary.search }));
import { GET } from "../../app/api/sams/route";

beforeEach(() => { vi.resetAllMocks(); });
it("requires a member session before reading the separate leader directory", async () => {
  boundary.session.mockResolvedValue(null);
  const response = await GET(new NextRequest("https://example.test/api/sams"));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ code: "UNAUTHORIZED" });
  expect(boundary.search).not.toHaveBeenCalled();
});
it("preserves authenticated sam lookup", async () => {
  boundary.session.mockResolvedValue({ id: "member" });
  boundary.search.mockResolvedValue([{ id: "sam", name: "1-2", leaderName: "검증" }]);
  const response = await GET(new NextRequest("https://example.test/api/sams?q=1-2"));
  expect(response.status).toBe(200);
  expect(boundary.search).toHaveBeenCalledWith("1-2");
});
