import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.full.mjs";
import { DomainError } from "../../lib/http";
import { dbSamLeaderRepository, prepareSamLeaderValues, type SamLeaderRepository } from "./admin-service";
import { normalizeSamLabel } from "./labels";

XLSX.set_cptable(cptable);
export { normalizeSamLeaderName } from "./labels";

export type SamLeaderCandidate = { sourceRow: number; name: string; leaderName: string };
export type SamLeaderImportSummary = { total: number; imported: number };
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function validateSamLeaderUploadMeta({ name, size }: { name: string; size: number }): void {
  if (!/\.xlsx?$/i.test(name)) throw new DomainError("SAM_LEADER_FILE_TYPE", 400);
  if (size <= 0 || size > MAX_FILE_BYTES) throw new DomainError("SAM_LEADER_FILE_TOO_LARGE", 413);
}

function cellText(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

export function parseSamLeaderWorkbookBuffer(buffer: Buffer): SamLeaderCandidate[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellText: true });
  } catch {
    throw new DomainError("SAM_LEADER_FILE_INVALID", 400);
  }
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new DomainError("SAM_LEADER_SHEET_MISSING", 400);
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], {
    header: 1, raw: false, defval: "",
  }).map((row) => row.map(cellText));
  let headerRow = -1;
  let samColumn = -1;
  let leaderColumn = -1;
  let villageColumn = -1;
  for (let index = 0; index < Math.min(20, matrix.length); index += 1) {
    const header = matrix[index].map((cell) => cell.replace(/\s+/g, ""));
    const sam = header.findIndex((cell) => ["샘", "샘이름"].includes(cell));
    const leader = header.findIndex((cell) => ["샘리더", "리더", "리더이름"].includes(cell));
    if (sam >= 0 && leader >= 0) {
      headerRow = index;
      samColumn = sam;
      leaderColumn = leader;
      villageColumn = header.indexOf("마을");
      break;
    }
  }
  if (headerRow < 0) throw new DomainError("SAM_LEADER_HEADERS_MISSING", 400);

  const result: SamLeaderCandidate[] = [];
  let currentVillage = "";
  for (let index = headerRow + 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    if (row.every((cell) => !cell)) continue;
    let rawSam = row[samColumn] ?? "";
    let rawLeader = row[leaderColumn] ?? "";
    const filled = row.filter(Boolean);
    const shifted = samColumn >= 2 && !rawSam && !rawLeader && filled.length === 2 && /(?:샘|^\d+(?:-\d+)?)$/.test(filled[0]);
    if (shifted) {
      [rawSam, rawLeader] = filled;
    } else if (villageColumn >= 0 && row[villageColumn]) {
      currentVillage = row[villageColumn].replace(/\s+/g, "").replace(/마을$/, "");
    }
    let name = normalizeSamLabel(rawSam);
    if (name && /^\d+$/.test(name) && currentVillage) {
      name = normalizeSamLabel(`${currentVillage}-${name}`);
    }
    const prepared = prepareSamLeaderValues({ name: name ?? "", leaderName: rawLeader });
    result.push({ sourceRow: index + 1, name: prepared.name, leaderName: prepared.leaderName });
  }
  if (result.length === 0) throw new DomainError("SAM_LEADER_FILE_EMPTY", 400);
  return result;
}

export async function importSamLeaderCandidates(
  rows: SamLeaderCandidate[],
  repository: SamLeaderRepository = dbSamLeaderRepository,
): Promise<SamLeaderImportSummary> {
  if (rows.length === 0) throw new DomainError("SAM_LEADER_FILE_EMPTY", 400);
  const prepared = rows.map(prepareSamLeaderValues);
  if (new Set(prepared.map((row) => row.name)).size !== prepared.length) {
    throw new DomainError("SAM_LEADER_DUPLICATE", 409);
  }
  await repository.upsertLeaders(prepared);
  return { total: rows.length, imported: prepared.length };
}
