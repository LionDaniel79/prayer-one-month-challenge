import * as fs from "node:fs";
import { and, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.full.mjs";

XLSX.set_fs(fs);
XLSX.set_cptable(cptable);
import { getDb } from "../../db/client";
import { memberRoster, users } from "../../db/schema";
import { phoneLookupHash } from "../auth/crypto";
import { encryptRosterPhone } from "./crypto";
import {
  canonicalizeRosterName,
  makeSamLabel,
  normalizeOptionalPhone,
  normalizeRosterPhone,
} from "./normalize";

export type ImportCandidate = {
  sourceRow: number;
  sourceName: string;
  canonicalName: string;
  position: string | null;
  phone: string | null;
  village: string | null;
  sam: string | null;
  samLabel: string | null;
};

export type ImportValidationError = {
  code: "DUPLICATE_CREDENTIAL" | "MISSING_NAME";
  sourceRows: number[];
};

export type ImportValidation = {
  missingPhone: number;
  errors: ImportValidationError[];
};

export type PreparedRosterRow = {
  sourceRow: number;
  sourceName: string;
  canonicalName: string;
  position: string | null;
  phoneLookupHash: string | null;
  phoneCiphertext: string | null;
  village: string | null;
  sam: string | null;
  samLabel: string | null;
  isActive: boolean;
  isAdmin: boolean;
  source: "xls";
};

export type ImportSummary = {
  total: number;
  imported: number;
  missingPhone: number;
  errors: number;
};

export type RosterImportRepository = {
  replaceXlsRoster(rows: PreparedRosterRow[]): Promise<void>;
};

const HEADER_ALIASES = {
  name: ["이름"],
  position: ["교회직분", "직분"],
  phone: ["핸드폰", "핸드폰 번호", "핸드폰번호", "전화번호"],
  village: ["마을"],
  sam: ["샘"],
} as const;

function cellText(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

function findHeaderIndex(row: string[], aliases: readonly string[]): number {
  return row.findIndex((value) => aliases.includes(value));
}

function parseWorkbook(workbook: XLSX.WorkBook): ImportCandidate[] {
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("ROSTER_SHEET_MISSING");

  const sheet = workbook.Sheets[firstSheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }).map((row) => row.map(cellText));

  let headerRow = -1;
  let columns:
    | { name: number; position: number; phone: number; village: number; sam: number }
    | undefined;

  for (let index = 0; index < Math.min(20, matrix.length); index += 1) {
    const row = matrix[index];
    const candidate = {
      name: findHeaderIndex(row, HEADER_ALIASES.name),
      position: findHeaderIndex(row, HEADER_ALIASES.position),
      phone: findHeaderIndex(row, HEADER_ALIASES.phone),
      village: findHeaderIndex(row, HEADER_ALIASES.village),
      sam: findHeaderIndex(row, HEADER_ALIASES.sam),
    };
    if (Object.values(candidate).every((value) => value >= 0)) {
      headerRow = index;
      columns = candidate;
      break;
    }
  }

  if (headerRow < 0 || !columns) throw new Error("ROSTER_HEADERS_MISSING");

  const result: ImportCandidate[] = [];
  for (let index = headerRow + 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    if (row.every((value) => !value)) continue;

    const sourceName = row[columns.name] ?? "";
    const position = row[columns.position] || null;
    const phoneText = row[columns.phone] ?? "";
    const village = row[columns.village] || null;
    const sam = row[columns.sam] || null;

    let canonicalName = "";
    try {
      canonicalName = canonicalizeRosterName(sourceName);
    } catch {
      canonicalName = "";
    }

    result.push({
      sourceRow: index + 1,
      sourceName,
      canonicalName,
      position,
      phone: normalizeOptionalPhone(phoneText),
      village,
      sam,
      samLabel: makeSamLabel(village, sam),
    });
  }

  return result;
}

export function parseRosterWorkbook(filePath: string): ImportCandidate[] {
  return parseWorkbook(XLSX.readFile(filePath, { cellText: true }));
}

export function parseRosterWorkbookBuffer(buffer: Buffer): ImportCandidate[] {
  return parseWorkbook(XLSX.read(buffer, { type: "buffer", cellText: true }));
}

export function validateRosterCandidates(rows: ImportCandidate[]): ImportValidation {
  const errors: ImportValidationError[] = [];
  const byCredential = new Map<string, number[]>();
  let missingPhone = 0;

  for (const row of rows) {
    if (!row.canonicalName) {
      errors.push({ code: "MISSING_NAME", sourceRows: [row.sourceRow] });
      continue;
    }
    if (!row.phone) {
      missingPhone += 1;
      continue;
    }

    const key = `${row.canonicalName}\u0000${row.phone}`;
    const list = byCredential.get(key) ?? [];
    list.push(row.sourceRow);
    byCredential.set(key, list);
  }

  for (const sourceRows of byCredential.values()) {
    if (sourceRows.length > 1) {
      errors.push({ code: "DUPLICATE_CREDENTIAL", sourceRows });
    }
  }

  return { missingPhone, errors };
}

function credentialKey(name: string, hash: string): string {
  return `${name}\u0000${hash}`;
}

export const dbRosterImportRepository: RosterImportRepository = {
  async replaceXlsRoster(rows) {
    const db = getDb();

    await db.transaction(async (tx) => {
      const existingRows = await tx
        .select({
          id: memberRoster.id,
          canonicalName: memberRoster.canonicalName,
          phoneLookupHash: memberRoster.phoneLookupHash,
          source: memberRoster.source,
        })
        .from(memberRoster);

      const existingXls = existingRows.filter((row) => row.source === "xls");
      const existingAdminKeys = new Set(
        existingRows
          .filter((row) => row.source === "admin" && row.phoneLookupHash)
          .map((row) => credentialKey(row.canonicalName, row.phoneLookupHash!)),
      );

      for (const row of rows) {
        if (
          row.phoneLookupHash &&
          existingAdminKeys.has(credentialKey(row.canonicalName, row.phoneLookupHash))
        ) {
          throw new Error("ROSTER_ADMIN_CONFLICT");
        }
      }

      const existingByCredential = new Map(
        existingXls
          .filter((row) => row.phoneLookupHash)
          .map((row) => [
            credentialKey(row.canonicalName, row.phoneLookupHash!),
            row.id,
          ]),
      );

      const linkedUsers = await tx
        .select({
          id: users.id,
          displayName: users.displayName,
          phoneLookupHash: users.phoneLookupHash,
          rosterId: users.rosterId,
          isActive: users.isActive,
        })
        .from(users);
      const linkedRosterIds = new Set(
        linkedUsers.flatMap((row) => (row.rosterId ? [row.rosterId] : [])),
      );

      const processedIds = new Set<string>();
      const importedByCredential = new Map<
        string,
        { id: string; row: PreparedRosterRow }
      >();

      for (const row of rows) {
        const key = row.phoneLookupHash
          ? credentialKey(row.canonicalName, row.phoneLookupHash)
          : null;
        const existingId = key ? existingByCredential.get(key) : undefined;

        if (existingId) {
          await tx
            .update(memberRoster)
            .set({
              sourceName: row.sourceName,
              canonicalName: row.canonicalName,
              position: row.position,
              phoneLookupHash: row.phoneLookupHash,
              phoneCiphertext: row.phoneCiphertext,
              village: row.village,
              sam: row.sam,
              samLabel: row.samLabel,
              isActive: row.isActive,
              isAdmin: row.isAdmin,
              sourceRow: row.sourceRow,
              updatedAt: new Date(),
            })
            .where(eq(memberRoster.id, existingId));
          processedIds.add(existingId);
          if (key) importedByCredential.set(key, { id: existingId, row });
          continue;
        }

        const [inserted] = await tx
          .insert(memberRoster)
          .values(row)
          .returning({ id: memberRoster.id });
        processedIds.add(inserted.id);
        if (key) importedByCredential.set(key, { id: inserted.id, row });
      }

      for (const oldRow of existingXls) {
        if (!processedIds.has(oldRow.id) && !linkedRosterIds.has(oldRow.id)) {
          await tx.delete(memberRoster).where(eq(memberRoster.id, oldRow.id));
        }
      }

      for (const user of linkedUsers) {
        if (user.rosterId) continue;
        const canonicalName = canonicalizeRosterName(user.displayName);
        const match = importedByCredential.get(
          credentialKey(canonicalName, user.phoneLookupHash),
        );
        if (!match) continue;

        await tx
          .update(users)
          .set({
            rosterId: match.id,
            displayName: match.row.canonicalName,
            normalizedName: match.row.canonicalName.toLocaleLowerCase("ko-KR"),
            phoneLookupHash: match.row.phoneLookupHash!,
            role: match.row.isAdmin ? "admin" : "member",
            isActive: match.row.isActive,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }

      const activeUsers = await tx
        .select({ id: users.id, rosterId: users.rosterId })
        .from(users)
        .where(eq(users.isActive, true));

      if (activeUsers.some((row) => !row.rosterId)) {
        throw new Error("UNMAPPED_ACTIVE_USER");
      }
    });
  },
};

export async function importRosterCandidates(
  rows: ImportCandidate[],
  options:
    | {
        adminName: string;
        adminPhone: string;
        adminCredential?: never;
        repository?: RosterImportRepository;
      }
    | {
        adminName?: never;
        adminPhone?: never;
        adminCredential: {
          canonicalName: string;
          phoneLookupHash: string;
        };
        repository?: RosterImportRepository;
      },
): Promise<ImportSummary> {
  const validation = validateRosterCandidates(rows);
  if (validation.errors.length > 0) {
    throw new Error("ROSTER_VALIDATION_FAILED");
  }

  const rawAdmin =
    "adminCredential" in options && options.adminCredential
      ? {
          canonicalName: canonicalizeRosterName(options.adminCredential.canonicalName),
          phoneLookupHash: options.adminCredential.phoneLookupHash,
        }
      : {
          canonicalName: canonicalizeRosterName(options.adminName),
          phoneLookupHash: phoneLookupHash(normalizeRosterPhone(options.adminPhone)),
        };
  let adminMatches = 0;

  const prepared: PreparedRosterRow[] = rows.map((row) => {
    const lookupHash = row.phone ? phoneLookupHash(row.phone) : null;
    const isAdmin =
      row.canonicalName === rawAdmin.canonicalName &&
      lookupHash !== null &&
      lookupHash === rawAdmin.phoneLookupHash;
    if (isAdmin) adminMatches += 1;

    return {
      sourceRow: row.sourceRow,
      sourceName: row.sourceName,
      canonicalName: row.canonicalName,
      position: row.position,
      phoneLookupHash: lookupHash,
      phoneCiphertext: row.phone ? encryptRosterPhone(row.phone) : null,
      village: row.village,
      sam: row.sam,
      samLabel: row.samLabel,
      isActive: true,
      isAdmin,
      source: "xls" as const,
    };
  });

  if (adminMatches !== 1) throw new Error("INITIAL_ADMIN_NOT_FOUND");

  await (options.repository ?? dbRosterImportRepository).replaceXlsRoster(prepared);

  return {
    total: rows.length,
    imported: prepared.length,
    missingPhone: validation.missingPhone,
    errors: 0,
  };
}
