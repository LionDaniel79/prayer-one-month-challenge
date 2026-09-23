import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import {
  importRosterCandidates,
  parseRosterWorkbook,
  validateRosterCandidates,
} from "../../src/features/roster/import";

function workbookFile(rows: string[][]) {
  const sheet = utils.aoa_to_sheet(rows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "명단");
  const dir = mkdtempSync(join(tmpdir(), "roster-"));
  const file = join(dir, "fixture.xls");
  writeFileSync(file, write(workbook, { type: "buffer", bookType: "xls" }));
  return file;
}

describe("legacy XLS roster import parsing", () => {
  it("parses required columns and canonicalizes names and sam labels", () => {
    const file = workbookFile([
      ["이름", "교회직분", "핸드폰", "마을", "샘"],
      ["김은희A", "집사", "010-1234-5678", "1마을", "6샘"],
      ["김은희B", "권사", "010-9999-0000", "2마을", "3샘"],
      ["전화없음", "성도", "", "1마을", "7샘"],
    ]);

    const rows = parseRosterWorkbook(file);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      sourceRow: 2,
      sourceName: "김은희A",
      canonicalName: "김은희",
      position: "집사",
      phone: "01012345678",
      village: "1마을",
      sam: "6샘",
      samLabel: "1-6",
    });
    expect(rows[2].phone).toBeNull();
    expect(rows[2].samLabel).toBe("1-7");
  });

  it("accepts defensive header aliases", () => {
    const file = workbookFile([
      ["이름", "직분", "핸드폰 번호", "마을", "샘"],
      ["테스트A", "집사", "010-1111-2222", "3마을", "2샘"],
    ]);
    expect(parseRosterWorkbook(file)[0].canonicalName).toBe("테스트");
  });

  it("rejects a workbook missing a required header", () => {
    const file = workbookFile([
      ["이름", "교회직분", "핸드폰", "마을"],
      ["테스트", "집사", "010-1111-2222", "3마을"],
    ]);
    expect(() => parseRosterWorkbook(file)).toThrow("ROSTER_HEADERS_MISSING");
  });

  it("reports blank phones as warnings but duplicate credentials as fatal", () => {
    const rows = [
      {
        sourceRow: 2,
        sourceName: "김은희A",
        canonicalName: "김은희",
        position: "집사",
        phone: "01012345678",
        village: "1마을",
        sam: "6샘",
        samLabel: "1-6",
      },
      {
        sourceRow: 3,
        sourceName: "김은희B",
        canonicalName: "김은희",
        position: "권사",
        phone: "01012345678",
        village: "2마을",
        sam: "3샘",
        samLabel: "2-3",
      },
      {
        sourceRow: 4,
        sourceName: "전화없음",
        canonicalName: "전화없음",
        position: "성도",
        phone: null,
        village: "1마을",
        sam: "7샘",
        samLabel: "1-7",
      },
    ];

    const result = validateRosterCandidates(rows);
    expect(result.missingPhone).toBe(1);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "DUPLICATE_CREDENTIAL" }),
    ]);
  });
});


describe("roster import transaction boundary", () => {
  it("does not call the repository when duplicate credentials exist", async () => {
    process.env.DATABASE_URL = "postgres://example";
    process.env.SESSION_SECRET = "s".repeat(32);
    process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
    process.env.ROSTER_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");

    let calls = 0;
    const rows = [
      {
        sourceRow: 2,
        sourceName: "김은희A",
        canonicalName: "김은희",
        position: "집사",
        phone: "01012345678",
        village: "1마을",
        sam: "6샘",
        samLabel: "1-6",
      },
      {
        sourceRow: 3,
        sourceName: "김은희B",
        canonicalName: "김은희",
        position: "권사",
        phone: "01012345678",
        village: "2마을",
        sam: "3샘",
        samLabel: "2-3",
      },
    ];

    await expect(importRosterCandidates(rows, {
      adminName: "김은희",
      adminPhone: "01012345678",
      repository: {
        replaceXlsRoster: async () => {
          calls += 1;
        },
      },
    })).rejects.toThrow("ROSTER_VALIDATION_FAILED");
    expect(calls).toBe(0);
  });

  it("prepares private phone fields and returns count-only summary", async () => {
    process.env.DATABASE_URL = "postgres://example";
    process.env.SESSION_SECRET = "s".repeat(32);
    process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
    process.env.ROSTER_ENCRYPTION_KEY = Buffer.alloc(32, 10).toString("base64");

    const captured: unknown[] = [];
    const rows = [
      {
        sourceRow: 2,
        sourceName: "관리자A",
        canonicalName: "관리자",
        position: "집사",
        phone: "01012345678",
        village: "1마을",
        sam: "6샘",
        samLabel: "1-6",
      },
      {
        sourceRow: 3,
        sourceName: "전화없음",
        canonicalName: "전화없음",
        position: "성도",
        phone: null,
        village: null,
        sam: null,
        samLabel: null,
      },
    ];

    const summary = await importRosterCandidates(rows, {
      adminName: "관리자",
      adminPhone: "010-1234-5678",
      repository: {
        replaceXlsRoster: async (prepared) => {
          captured.push(...prepared);
        },
      },
    });

    expect(summary).toEqual({ total: 2, imported: 2, missingPhone: 1, errors: 0 });
    expect(JSON.stringify(summary)).not.toContain("01012345678");
    expect(captured[0]).toMatchObject({
      canonicalName: "관리자",
      isAdmin: true,
      phoneLookupHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(captured[0])).not.toContain("01012345678");
    expect(captured[1]).toMatchObject({ phoneLookupHash: null, phoneCiphertext: null });
  });
});
