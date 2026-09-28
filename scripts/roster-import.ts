import { closeDb } from "../src/db/client";
import {
  importRosterCandidates,
  parseRosterWorkbook,
} from "../src/features/roster/import";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const file = argument("--file");
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME;
  const adminPhone = process.env.BOOTSTRAP_ADMIN_PHONE;

  if (!file) throw new Error("USAGE: --file is required");
  if (!adminName || !adminPhone) throw new Error("BOOTSTRAP_ADMIN_ENV_REQUIRED");

  const rows = parseRosterWorkbook(file);
  const summary = await importRosterCandidates(rows, { adminName, adminPhone });
  console.log(JSON.stringify(summary));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "ROSTER_IMPORT_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
