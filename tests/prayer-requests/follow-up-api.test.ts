import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../../src/features/auth/session";
vi.mock("server-only", () => ({}));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: vi.fn() }));
vi.mock("../../src/features/prayer-requests/service", () => ({
  listOwnPrayerRequests: vi.fn(), updateOwnPrayerRequest: vi.fn(),
  listPrayerComments: vi.fn(), addPrayerComment: vi.fn(), markPrayerCommentsRead: vi.fn(), editPrayerComment: vi.fn(),
  hasUnreadPrayerComments: vi.fn(),
}));
vi.mock("../../src/features/email/wakeup", () => ({ scheduleEmailDelivery: vi.fn() }));
import { getCurrentSessionUser } from "../../src/features/auth/http-session";
import * as service from "../../src/features/prayer-requests/service";
import * as collection from "../../app/api/prayer-requests/route";
import * as item from "../../app/api/prayer-requests/[id]/route";
import * as comments from "../../app/api/prayer-requests/[id]/comments/route";
import * as unread from "../../app/api/prayer-requests/unread/route";
import { scheduleEmailDelivery } from "../../src/features/email/wakeup";

const id = "00000000-0000-4000-8000-000000000111";
const context = { params: Promise.resolve({ id }) };
const actor = { id: "00000000-0000-4000-8000-000000000222", role: "member" } as SessionUser;
function request(method: string, body?: unknown, origin?: string) {
  return new Request("https://example.test/api/prayer-requests/" + id, { method,
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getCurrentSessionUser).mockResolvedValue(actor); });

describe("prayer follow-up HTTP boundary", () => {
  it("authenticates every new operation before accessing data", async () => {
    vi.mocked(getCurrentSessionUser).mockResolvedValue(null);
    const responses = await Promise.all([
      collection.GET(request("GET")), item.PATCH(request("PATCH", { complete: true }), context),
      comments.GET(request("GET"), context), comments.POST(request("POST", {}), context),
      comments.PATCH(request("PATCH", {}), context),
      unread.GET(),
    ]);
    expect(responses.map(response => response.status)).toEqual([401, 401, 401, 401, 401, 401]);
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
  });
  it("returns only a private unread flag for the verified session owner", async () => {
    vi.mocked(service.hasUnreadPrayerComments).mockResolvedValue(true);
    const response = await unread.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hasUnread: true });
    expect(service.hasUnreadPrayerComments).toHaveBeenCalledWith(actor.id);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("never accepts a submitted owner for the own-request listing and disables caching", async () => {
    vi.mocked(service.listOwnPrayerRequests).mockResolvedValue({ requests: [], hasMore: false });
    const response = await collection.GET(new Request("https://example.test/api/prayer-requests?userId=somebody-else&page=2"));
    expect(response.status).toBe(200);
    expect(service.listOwnPrayerRequests).toHaveBeenCalledWith(actor.id, 2);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects forged actors/status/read cursors and cross-site writes", async () => {
    expect((await item.PATCH(request("PATCH", { status: "praying" }), context)).status).toBe(400);
    expect((await item.PATCH(request("PATCH", { complete: true }, "https://other.test"), context)).status).toBe(403);
    expect((await comments.POST(request("POST", { content: "hi", clientId: id, authorRole: "admin" }), context)).status).toBe(400);
    expect((await comments.PATCH(request("PATCH", { sequence: 999999 }), context)).status).toBe(400);
    expect(service.updateOwnPrayerRequest).not.toHaveBeenCalled();
    expect(service.addPrayerComment).not.toHaveBeenCalled();
    expect(service.markPrayerCommentsRead).not.toHaveBeenCalled();
  });
  it("passes only the verified session and never schedules a receipt for follow-up writes", async () => {
    expect((await item.PATCH(request("PATCH", { content: "수정 내용", expectedVersion: 2 }), context)).status).toBe(200);
    expect(service.updateOwnPrayerRequest).toHaveBeenCalledWith(id, actor, { content: "수정 내용", expectedVersion: 2 });
    vi.mocked(service.addPrayerComment).mockResolvedValue(id);
    expect((await comments.POST(request("POST", { content: "댓글", clientId: id }), context)).status).toBe(201);
    expect(service.addPrayerComment).toHaveBeenCalledWith(id, actor, "댓글", id, undefined);
    expect((await comments.PATCH(request("PATCH", { commentId: id, content: "댓글 수정", expectedVersion: 1 }), context)).status).toBe(200);
    expect(service.editPrayerComment).toHaveBeenCalledWith(id, actor, { commentId: id, content: "댓글 수정", expectedVersion: 1 });
    expect((await comments.PATCH(request("PATCH", { throughCommentId: id }), context)).status).toBe(200);
    expect(service.markPrayerCommentsRead).toHaveBeenCalledWith(id, actor, id);
    expect(scheduleEmailDelivery).not.toHaveBeenCalled();
  });
});
