import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { noticeReads, notices, pushSubscriptions } from "../../src/db/schema";

describe("notice schema", () => {
  it("defines notices, per-user reads, and push subscriptions", () => {
    expect(notices.id).toBeDefined();
    expect(notices.status).toBeDefined();
    expect(noticeReads.noticeId).toBeDefined();
    expect(noticeReads.userId).toBeDefined();
    expect(pushSubscriptions.endpoint).toBeDefined();
    it("keeps new private tables inaccessible to anon/authenticated roles", () => {
    const migration = readFileSync("drizzle/0004_notices_push.sql", "utf8");
    for (const table of ["notices", "notice_reads", "push_subscriptions"]) {
      expect(migration).toContain(
        `revoke all on prayer_app.${table} from anon, authenticated;`,
      );
    }
  });
});
});
