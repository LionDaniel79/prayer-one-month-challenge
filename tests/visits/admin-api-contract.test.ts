import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminRoutes = [
  "app/api/admin/visits/route.ts",
  "app/api/admin/visits/[id]/route.ts",
  "app/api/admin/visits/[id]/confirm/route.ts",
  "app/api/admin/visits/[id]/complete/route.ts",
  "app/api/admin/visits/[id]/cancel/route.ts",
  "app/api/admin/visits/blocked-dates/route.ts",
  "app/api/admin/visits/blocked-weekdays/route.ts",
];

describe("admin visit API boundaries", () => {
  it("requires admin authorization on every visit management route", () => {
    for (const path of adminRoutes) {
      expect(readFileSync(path, "utf8")).toContain("requireAdmin");
    }
  });

  it("exposes explicit confirm, complete, and cancel actions", () => {
    for (const path of [
      "app/api/admin/visits/[id]/confirm/route.ts",
      "app/api/admin/visits/[id]/complete/route.ts",
      "app/api/admin/visits/[id]/cancel/route.ts",
    ]) {
      expect(readFileSync(path, "utf8")).toContain("export async function POST");
    }
  });
});
