import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notice API contract", () => {
  it("member routes use published-only notice services and mark detail reads", () => {
    const list = readFileSync("app/api/notices/route.ts", "utf8");
    const detail = readFileSync("app/api/notices/[id]/route.ts", "utf8");
    const unread = readFileSync("app/api/notices/unread-count/route.ts", "utf8");

    expect(list).toContain("listPublishedNotices");
    expect(detail).toContain("getPublishedNoticeForUser");
    expect(detail).toContain("markNoticeRead");
    expect(unread).toContain("getUnreadNoticeCount");
  });

  it("admin notice mutation routes require admin authorization", () => {
    const collection = readFileSync("app/api/admin/notices/route.ts", "utf8");
    const item = readFileSync("app/api/admin/notices/[id]/route.ts", "utf8");

    expect(collection).toContain("requireAdmin");
    expect(item).toContain("requireAdmin");
  });
});
