import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("prayer request API surface", () => {
  it("member route exposes POST but not GET", () => {
    const source = readFileSync("app/api/prayer-requests/route.ts", "utf8");
    expect(source).toContain("export async function POST");
    expect(source).not.toContain("export async function GET");
  });

  it("admin collection requires admin authorization", () => {
    const source = readFileSync(
      "app/api/admin/prayer-requests/route.ts",
      "utf8",
    );
    expect(source).toContain("requireAdmin");
    expect(source).toContain("listPrayerRequestsForAdmin");
  });

  it("admin item route exposes detail and status update", () => {
    const source = readFileSync(
      "app/api/admin/prayer-requests/[id]/route.ts",
      "utf8",
    );
    expect(source).toContain("getPrayerRequestForAdmin");
    expect(source).toContain("updatePrayerRequestStatus");
  });
});
