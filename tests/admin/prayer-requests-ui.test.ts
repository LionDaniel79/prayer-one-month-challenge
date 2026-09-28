import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin prayer request management UI", () => {
  it("shows the three approved workflow labels", () => {
    const source = readFileSync(
      "components/admin/prayer-requests/AdminPrayerRequestDetail.tsx",
      "utf8",
    );
    expect(source).toContain("접수");
    expect(source).toContain("기도중");
    expect(source).toContain("완료");
  });

  it("keeps request management inside the admin surface", () => {
    const source = readFileSync(
      "components/admin/prayer-requests/AdminPrayerRequestList.tsx",
      "utf8",
    );
    expect(source).not.toContain('href="/prayer-requests/');
    expect(source).toContain("요청자");
    expect(source).toContain("요청일");
  });
});
