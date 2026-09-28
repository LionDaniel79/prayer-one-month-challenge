import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin visit management UI", () => {
  it("exposes confirm, complete, and cancel workflow actions", () => {
    const source = readFileSync(
      "components/admin/visits/AdminVisitDetail.tsx",
      "utf8",
    );
    expect(source).toContain("유선확정 완료");
    expect(source).toContain("완료");
    expect(source).toContain("취소");
    expect(source).toContain("동기화");
  });
});
