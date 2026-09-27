import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("member prayer request UI", () => {
  it("contains the approved guidance, send action, and success copy", () => {
    const source = readFileSync(
      "components/prayer-requests/PrayerRequestForm.tsx",
      "utf8",
    );
    expect(source).toContain("중보 기도가 필요한 내용을 자유롭게 적어주세요.");
    expect(source).toContain("전송");
    expect(source).toContain("기도요청이 전달되었습니다.");
  });

});
