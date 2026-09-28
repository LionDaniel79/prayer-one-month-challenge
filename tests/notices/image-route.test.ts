import { beforeEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({session: vi.fn(), image: vi.fn()}));
vi.mock("../../src/features/auth/http-session", () => ({getCurrentSessionUser: boundary.session}));
vi.mock("../../src/features/notices/service", () => ({getNoticeImage: boundary.image}));
import { GET } from "../../app/api/notices/[id]/image/route";
const id = "00000000-0000-4000-8000-000000000111";
const context = {params: Promise.resolve({id})};
beforeEach(() => { vi.resetAllMocks(); });

it("denies anonymous requests before reading image bytes", async () => {
  boundary.session.mockResolvedValue(null);
  const response = await GET(new Request(`https://example.test/api/notices/${id}/image`), context);
  expect(response.status).toBe(401);
  expect(boundary.image).not.toHaveBeenCalled();
});
it.each(["member", "admin"])("uses %s permission when loading the image", async role => {
  boundary.session.mockResolvedValue({id: "actor", role});
  boundary.image.mockResolvedValue({data: Buffer.from("image bytes"), version: "version1"});
  const response = await GET(new Request(`https://example.test/api/notices/${id}/image`), context);
  expect(boundary.image).toHaveBeenCalledWith(id, role === "admin");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-cache");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.text()).toBe("image bytes");
});
it("does not honor cached ETags before checking visibility", async () => {
  boundary.session.mockResolvedValue({id: "actor", role: "member"});
  boundary.image.mockResolvedValue(null);
  const response = await GET(new Request(`https://example.test/api/notices/${id}/image`, {headers: {"if-none-match": '"old-image"'}}), context);
  expect(response.status).toBe(404);
});
it("rejects malformed notice IDs without querying the DB", async () => {
  boundary.session.mockResolvedValue({id: "actor", role: "member"});
  const response = await GET(new Request("https://example.test/api/notices/invalid/image"), {params: Promise.resolve({id: "invalid"})});
  expect(response.status).toBe(404);
  expect(boundary.image).not.toHaveBeenCalled();
});
