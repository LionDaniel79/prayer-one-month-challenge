import { describe, expect, it } from "vitest";
import {
  canMemberReadNotice,
  transitionNoticePublication,
} from "../../src/features/notices/service";

describe("notice rules", () => {
  it("keeps drafts private from members", () => {
    expect(canMemberReadNotice({ status: "draft" })).toBe(false);
    expect(canMemberReadNotice({ status: "published" })).toBe(true);
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
