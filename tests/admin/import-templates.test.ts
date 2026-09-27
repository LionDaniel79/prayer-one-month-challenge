import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSamLeaderWorkbookBuffer } from "../../src/features/sams/import";
import { parseRosterWorkbookBuffer, validateRosterCandidates } from "../../src/features/roster/import";
import { validateRosterUploadMeta } from "../../src/features/admin/roster-import-service";

describe("downloadable import examples", () => {
  it("parses the roster example with leading zeroes and separate village/sam values", () => {
    const buffer = readFileSync("public/templates/community-roster-example.xlsx");
    validateRosterUploadMeta({ name: "community-roster-example.xlsx", size: buffer.length });
    const rows = parseRosterWorkbookBuffer(buffer);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ canonicalName: "예시관리자", phone: "01000000001", samLabel: "1-1" });
    expect(rows[1].samLabel).toBe("1-2");
    expect(validateRosterCandidates(rows)).toEqual({ missingPhone: 0, errors: [] });
  });
  it("parses the separate leader example without importing its instructions sheet", () => {
    expect(parseSamLeaderWorkbookBuffer(readFileSync("public/templates/sam-leaders-example.xlsx"))).toEqual([
      { sourceRow: 2, name: "1-1", leaderName: "예시리더A" },
      { sourceRow: 3, name: "1-2", leaderName: "예시리더B" },
      { sourceRow: 4, name: "2-1", leaderName: "예시리더C" },
    ]);
  });
});
