import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../src/db/client", () => ({ getDb: vi.fn() }));
import { getDb } from "../../src/db/client";
import * as service from "../../src/features/prayer-requests/service";

it("rejects member attempts to post as administrator before database access", async () => {
  await expect(service.addPrayerComment("request", { id: "member", role: "member" }, "댓글", "nonce", true)).rejects.toThrow("FORBIDDEN");
  expect(getDb).not.toHaveBeenCalled();
});

it("allows only the original author to edit a prayer comment", () => {
  expect(() => service.assertPrayerCommentAuthor("author", { id: "author", role: "member" })).not.toThrow();
  expect(() => service.assertPrayerCommentAuthor("author", { id: "other", role: "member" })).toThrow("PRAYER_COMMENT_NOT_FOUND");
  expect(() => service.assertPrayerCommentAuthor("author", { id: "admin", role: "admin" })).toThrow("PRAYER_COMMENT_NOT_FOUND");
});
