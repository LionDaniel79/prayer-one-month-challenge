import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { sams } from "../../db/schema";
import type { SamOption } from "../../lib/types";

function normalizeSearch(value: string): string {
  return value.trim().normalize("NFC").toLocaleLowerCase("ko-KR");
}

export function filterSamOptions(rows: SamOption[], query: string): SamOption[] {
  const needle = normalizeSearch(query);
  return rows
    .filter((row) => {
      if (!needle) return true;
      return (
        normalizeSearch(row.name).includes(needle) ||
        normalizeSearch(row.leaderName).includes(needle)
      );
    })
    .slice(0, 30);
}

export async function searchSams(query: string): Promise<SamOption[]> {
  const rows = await getDb()
    .select({ id: sams.id, name: sams.name, leaderName: sams.leaderName })
    .from(sams)
    .where(eq(sams.isActive, true))
    .orderBy(asc(sams.name))
    .limit(200);
  return filterSamOptions(rows, query);
}
