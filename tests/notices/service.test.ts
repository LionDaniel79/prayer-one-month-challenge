import { describe, expect, it } from "vitest";
import {
  canMemberReadNotice,
  nextNoticePublishedAt,
  transitionNoticePublication,
} from "../../src/features/notices/service";

describe("notice rules", () => {
  it("keeps drafts private from members", () => {
    expect(canMemberReadNotice({ status: "draft" })).toBe(false);
    expect(canMemberReadNotice({ status: "published" })).toBe(true);
  });

  it("clears publishedAt when a published notice returns to draft", () => {
    const oldPublishedAt = new Date("2026-09-24T00:00:00.000Z");
    const now = new Date("2026-09-25T00:00:00.000Z");

    expect(
      nextNoticePublishedAt("published", "draft", oldPublishedAt, now),
    ).toBeNull();
    expect(
      nextNoticePublishedAt("draft", "published", null, now),
    ).toBe(now);
    expect(
      nextNoticePublishedAt("published", "published", oldPublishedAt, now),
    ).toBe(oldPublishedAt);
  });

  it("reports push-worthy publication only on the first draft to published transition", () => {
    expect(transitionNoticePublication("draft", "published")).toEqual({
      nextStatus: "published",
      didPublish: true,
    });
    expect(transitionNoticePublication("published", "published")).toEqual({
      nextStatus: "published",
      didPublish: false,
    });
    expect(transitionNoticePublication("draft", "draft")).toEqual({
      nextStatus: "draft",
      didPublish: false,
    });
  });
});
