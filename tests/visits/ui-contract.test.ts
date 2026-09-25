import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("visit member UI", () => {
  it("contains the approved visit request fields and copy", () => {
    const source = readFileSync("components/visits/VisitRequestPanel.tsx", "utf8");
    for (const copy of [
      "개인심방",
      "샘심방",
      "참석자 명단",
      "장소",
      "희망 시간",
      "심방 요청 이유",
      "신청한 내용을 확인 후 유선으로 확정합니다.",
      "확정",
    ]) {
      expect(source).toContain(copy);
    }
  });

  it("renders a calendar that loads monthly availability", () => {
    const source = readFileSync("components/visits/VisitCalendar.tsx", "utf8");
    expect(source).toContain("/api/visits/availability");
    expect(source).toContain("onSelect");
  });
});
