import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin hub dashboard UI", () => {
  it("links summary cards to focused management pages", () => {
    const source = readFileSync(
      "components/admin/AdminHubDashboard.tsx",
      "utf8",
    );
    for (const href of [
      "/admin/prayer",
      "/admin/visits",
      "/admin/prayer-requests",
      "/admin/notices",
    ]) {
      expect(source).toContain(href);
    }
  });

  it("does not render sensitive request body or visit reason fields", () => {
    const source = readFileSync(
      "components/admin/AdminHubDashboard.tsx",
      "utf8",
    );
    expect(source).not.toContain(".content");
    expect(source).not.toContain(".reason");
  });
});
