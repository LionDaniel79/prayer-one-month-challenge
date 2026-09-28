import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("notice push service worker", () => {
  it("handles push notifications and notification clicks", () => {
    const source = readFileSync("public/sw.js", "utf8");
    expect(source).toContain('addEventListener("push"');
    expect(source).toContain('addEventListener("notificationclick"');
    expect(source).toContain("/notices");
  });
});
