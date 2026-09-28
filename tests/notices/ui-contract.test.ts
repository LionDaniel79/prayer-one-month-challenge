import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notice UI contract", () => {
  it("uses unread-count API in the sidebar badge", () => {
    const source = readFileSync(
      "components/notices/UnreadNoticeBadge.tsx",
      "utf8",
    );
    expect(source).toContain("/api/notices/unread-count");
  });

  it("shows NEW only for unread list items", () => {
    const source = readFileSync(
      "components/notices/NoticeList.tsx",
      "utf8",
    );
    expect(source).toContain("NEW");
    expect(source).toContain("isUnread");
  });

  it("renders one notice detail body on the detail route", () => {
    const source = readFileSync(
      "app/(member)/notices/[id]/page.tsx",
      "utf8",
    );
    expect(source).toContain("markNoticeRead");
    expect(source).toContain("NoticeDetail");
  });
});
