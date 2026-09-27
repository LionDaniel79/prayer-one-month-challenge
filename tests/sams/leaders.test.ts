import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { normalizeSamLabel } from "../../src/features/sams/labels";
import {
  importSamLeaderCandidates,
  normalizeSamLeaderName,
  parseSamLeaderWorkbookBuffer,
  validateSamLeaderUploadMeta,
} from "../../src/features/sams/import";

function workbookBuffer(rows: string[][], merges: string[] = []) {
  const sheet = utils.aoa_to_sheet(rows);
  sheet["!merges"] = merges.map((range) => utils.decode_range(range));
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "샘 리더");
  return Buffer.from(write(workbook, { type: "buffer", bookType: "xls" }));
}

describe("sam leader labels", () => {
  it.each([
    [" 01마을 - 02샘 ", "1-2"],
    ["1 - 2", "1-2"],
    ["직장샘", "직장"],
    ["", null],
    [null, null],
  ])("normalizes %s for roster matching", (input, expected) => {
    expect(normalizeSamLabel(input)).toBe(expected);
  });

  it.each([
    ["  김가람A 집사님  ", "김가람A"],
    ["이가람B권사", "이가람B"],
    ["박가람C (장로)", "박가람C"],
    ["최가람", "최가람"],
  ])("removes church title and preserves name suffix in %s", (input, expected) => {
    expect(normalizeSamLeaderName(input)).toBe(expected);
  });
});

describe("separate sam leader workbook", () => {
  it("reads merged village cells and ignores village leader names", () => {
    const rows = parseSamLeaderWorkbookBuffer(workbookBuffer([
      ["2026 샘 리더"],
      ["마을", "마을장", "샘", "샘리더"],
      ["01마을", "마을담당 집사", "1샘", "김가람A 집사"],
      ["", "", "2샘", "이가람 권사"],
      ["2마을", "다른담당 권사", "1샘", "박가람 장로"],
    ], ["A3:A4", "B3:B4"]));

    expect(rows).toEqual([
      { sourceRow: 3, name: "1-1", leaderName: "김가람A" },
      { sourceRow: 4, name: "1-2", leaderName: "이가람" },
      { sourceRow: 5, name: "2-1", leaderName: "박가람" },
    ]);
  });

  it("reads shifted two-cell continuation rows without overwriting current village", () => {
    const rows = parseSamLeaderWorkbookBuffer(workbookBuffer([
      ["마을", "마을장", "샘", "샘 리더"],
      ["1마을", "마을담당", "1-1샘", "김가람 집사"],
      ["1-2샘", "이가람B 권사"],
      ["3샘", "박가람 장로"],
    ]));
    expect(rows.map(({ name, leaderName }) => ({ name, leaderName }))).toEqual([
      { name: "1-1", leaderName: "김가람" },
      { name: "1-2", leaderName: "이가람B" },
      { name: "1-3", leaderName: "박가람" },
    ]);
  });

  it("reads a simple two-column leader file independently of the member roster", () => {
    expect(parseSamLeaderWorkbookBuffer(workbookBuffer([
      ["샘", "리더"],
      ["01-02샘", "김가람C 목사"],
      ["직장샘", "이가람 전도사"],
    ]))).toEqual([
      { sourceRow: 2, name: "1-2", leaderName: "김가람C" },
      { sourceRow: 3, name: "직장", leaderName: "이가람" },
    ]);
  });

  it("rejects member roster headers and missing leader values", () => {
    expect(() => parseSamLeaderWorkbookBuffer(workbookBuffer([
      ["이름", "교회직분", "핸드폰", "마을", "샘"],
    ]))).toThrow("SAM_LEADER_HEADERS_MISSING");
    expect(() => parseSamLeaderWorkbookBuffer(workbookBuffer([
      ["샘", "리더"], ["1-1", ""],
    ]))).toThrow("SAM_LEADER_ROW_INVALID");
  });

  it("does not persist a file with conflicting normalized sam labels", async () => {
    let writes = 0;
    await expect(importSamLeaderCandidates([
      { sourceRow: 2, name: "1-1", leaderName: "김가람" },
      { sourceRow: 3, name: "01-01샘", leaderName: "이가람" },
    ], { upsertLeaders: async () => { writes += 1; } })).rejects.toThrow("SAM_LEADER_DUPLICATE");
    expect(writes).toBe(0);
  });

  it("saves normalized leaders and returns only counts", async () => {
    const persisted: unknown[] = [];
    const summary = await importSamLeaderCandidates([
      { sourceRow: 2, name: "1마을-2샘", leaderName: "김가람A 집사" },
    ], { upsertLeaders: async (rows) => { persisted.push(...rows); } });
    expect(persisted).toEqual([{ name: "1-2", leaderName: "김가람A", isActive: true }]);
    expect(summary).toEqual({ total: 1, imported: 1 });
  });

  it("accepts XLS and XLSX and rejects non-spreadsheets and oversized files", () => {
    expect(() => validateSamLeaderUploadMeta({ name: "leaders.xls", size: 1000 })).not.toThrow();
    expect(() => validateSamLeaderUploadMeta({ name: "leaders.xlsx", size: 1000 })).not.toThrow();
    expect(() => validateSamLeaderUploadMeta({ name: "leaders.csv", size: 1000 })).toThrow("SAM_LEADER_FILE_TYPE");
    expect(() => validateSamLeaderUploadMeta({ name: "leaders.xls", size: 2 * 1024 * 1024 + 1 })).toThrow("SAM_LEADER_FILE_TOO_LARGE");
  });
});
