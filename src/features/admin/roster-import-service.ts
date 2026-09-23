import { DomainError } from "../../lib/http";
import {
  importRosterCandidates,
  parseRosterWorkbookBuffer,
  type ImportSummary,
  type RosterImportRepository,
} from "../roster/import";

export const MAX_ROSTER_FILE_BYTES = 2 * 1024 * 1024;

export function validateRosterUploadMeta({
  name,
  size,
}: {
  name: string;
  size: number;
}): void {
  if (!name.toLocaleLowerCase("en-US").endsWith(".xls")) {
    throw new DomainError("ROSTER_FILE_TYPE", 400);
  }
  if (size <= 0 || size > MAX_ROSTER_FILE_BYTES) {
    throw new DomainError("ROSTER_FILE_TOO_LARGE", 413);
  }
}

export async function importRosterUploadBuffer({
  buffer,
  adminCredential,
  repository,
}: {
  buffer: Buffer;
  adminCredential: {
    canonicalName: string;
    phoneLookupHash: string;
  };
  repository?: RosterImportRepository;
}): Promise<ImportSummary> {
  const rows = parseRosterWorkbookBuffer(buffer);
  return importRosterCandidates(rows, {
    adminCredential,
    repository,
  });
}
