import { describe, expect, it } from "vitest";
import { noticeReads, notices, pushSubscriptions } from "../../src/db/schema";

describe("notice schema", () => {
  it("defines notices, per-user reads, and push subscriptions", () => {
    expect(notices.id).toBeDefined();
    expect(notices.status).toBeDefined();
    expect(noticeReads.noticeId).toBeDefined();
    expect(noticeReads.userId).toBeDefined();
    expect(pushSubscriptions.endpoint).toBeDefined();
  });
});
