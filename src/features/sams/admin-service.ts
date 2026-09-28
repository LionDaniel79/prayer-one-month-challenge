import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../../db/client";
import { sams } from "../../db/schema";
import { DomainError } from "../../lib/http";
import { normalizeSamLabel, normalizeSamLeaderName } from "./labels";

export type SamLeaderValues = { name: string; leaderName: string; isActive: boolean };
export type AdminSamLeader = SamLeaderValues & { id: string };
export type SamLeaderRepository = { upsertLeaders(rows: SamLeaderValues[]): Promise<void> };

export function prepareSamLeaderValues(input: {
  name: string;
  leaderName: string;
  isActive?: boolean;
}): SamLeaderValues {
  const name = normalizeSamLabel(input.name);
  const leaderName = normalizeSamLeaderName(input.leaderName);
  if (!name || !leaderName || name.length > 100 || leaderName.length > 100) {
    throw new DomainError("SAM_LEADER_ROW_INVALID", 400);
  }
  return { name, leaderName, isActive: input.isActive ?? true };
}

export async function listSamLeadersForAdmin(): Promise<AdminSamLeader[]> {
  return getDb().select({
    id: sams.id,
    name: sams.name,
    leaderName: sams.leaderName,
    isActive: sams.isActive,
  }).from(sams).where(ne(sams.leaderName, "")).orderBy(asc(sams.name));
}

export async function deleteSamLeaders(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  // Keep the sam identity: existing members can still reference it via users.sam_id.
  // An empty leader name means no registered leader and can be filled by a later import.
  const removed = await getDb().update(sams).set({ leaderName: "" })
    .where(and(inArray(sams.id, [...new Set(ids)]), ne(sams.leaderName, "")))
    .returning({ id: sams.id });
  return removed.length;
}

export const dbSamLeaderRepository: SamLeaderRepository = {
  async upsertLeaders(rows) {
    await getDb().transaction(async (tx) => {
      const existing = await tx.select({ id: sams.id, name: sams.name }).from(sams);
      for (const row of rows) {
        const matches = existing.filter((sam) => normalizeSamLabel(sam.name) === row.name);
        if (matches.length > 1) throw new DomainError("SAM_LEADER_DUPLICATE", 409);
        if (matches.length === 1) {
          await tx.update(sams).set(row).where(eq(sams.id, matches[0].id));
        } else {
          await tx.insert(sams).values(row).onConflictDoUpdate({
            target: sams.name,
            set: { leaderName: row.leaderName, isActive: row.isActive },
          });
        }
      }
    });
  },
};

export async function saveSamLeader(input: {
  name: string;
  leaderName: string;
  isActive?: boolean;
}): Promise<void> {
  await dbSamLeaderRepository.upsertLeaders([prepareSamLeaderValues(input)]);
}
