import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../../db/client";
import { sams } from "../../db/schema";
import { DomainError } from "../../lib/http";
import { ReportError, selectLeaderIdentity } from "../pastoral/policy";
import { rosterIdentities, registrationTarget, bindingState, type LeaderState } from "./identity-service";
import { normalizeSamLabel, normalizeSamLeaderName } from "./labels";

export type SamLeaderValues = { name: string; leaderName: string; isActive: boolean; leaderRosterId?: string };
export type AdminSamLeader = Omit<SamLeaderValues,"leaderRosterId"> & { id: string; leaderRosterId?: string | null; leaderBindingLocked?: boolean; bindingState?: LeaderState };
export type SamLeaderRepository = { upsertLeaders(rows: SamLeaderValues[]): Promise<void> };

export function prepareSamLeaderValues(input: {
  name: string;
  leaderName: string;
  isActive?: boolean;
  leaderRosterId?: string;
}): SamLeaderValues {
  const name = normalizeSamLabel(input.name);
  const leaderName = normalizeSamLeaderName(input.leaderName);
  if (input.name.includes("마을장") || !name || !leaderName || name.length > 100 || leaderName.length > 100) {
    throw new DomainError("SAM_LEADER_ROW_INVALID", 400);
  }
  return { name, leaderName, isActive: input.isActive ?? true, ...(input.leaderRosterId ? {leaderRosterId:input.leaderRosterId} : {}) };
}

export async function listSamLeadersForAdmin(): Promise<AdminSamLeader[]> {
  const roster = await rosterIdentities();
  const result = await getDb().select({
    id: sams.id,
    name: sams.name,
    leaderName: sams.leaderName,
    leaderRosterId: sams.leaderRosterId,
    leaderBindingLocked: sams.leaderBindingLocked,
    isActive: sams.isActive,
  }).from(sams).where(ne(sams.leaderName, "")).orderBy(asc(sams.name));
  return result.map(row => ({...row,bindingState:bindingState(registrationTarget("sam",row),row,roster)}));
}

export async function deleteSamLeaders(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  // Keep the sam identity: existing members can still reference it via users.sam_id.
  // An empty leader name means no registered leader and can be filled by a later import.
  const removed = await getDb().update(sams).set({ leaderName: "", leaderRosterId:null,leaderBindingLocked:false })
    .where(and(inArray(sams.id, [...new Set(ids)]), ne(sams.leaderName, "")))
    .returning({ id: sams.id });
  return removed.length;
}

export const dbSamLeaderRepository: SamLeaderRepository = {
  async upsertLeaders(rows) {
    await upsertLeaderRows(rows, true);
  },
};

async function upsertLeaderRows(rows:SamLeaderValues[], allowUnresolved:boolean) {
    await getDb().transaction(async (tx) => {
      const existing = await tx.select({ id: sams.id, name: sams.name, leaderName:sams.leaderName,leaderRosterId:sams.leaderRosterId,leaderBindingLocked:sams.leaderBindingLocked }).from(sams).for("update");
      const roster=await rosterIdentities(tx);
      for (const row of rows) {
        const matches = existing.filter((sam) => normalizeSamLabel(sam.name) === row.name);
        if (matches.length > 1) throw new DomainError("SAM_LEADER_DUPLICATE", 409);
        let binding;
        try {binding=selectLeaderIdentity(registrationTarget("sam",row),roster,matches[0]??null,row.leaderRosterId);}
        catch(e){if(allowUnresolved&&e instanceof ReportError&&e.code==="LEADER_SELECTION_REQUIRED")binding={rosterId:null,locked:false};else if(e instanceof ReportError)throw new DomainError(e.code,e.status);else throw e;}
        const values={...row,leaderRosterId:binding.rosterId,leaderBindingLocked:binding.locked};
        if (matches.length === 1) {
          await tx.update(sams).set(values).where(eq(sams.id, matches[0].id));
        } else {
          await tx.insert(sams).values(values).onConflictDoUpdate({
            target: sams.name,
            set: values,
          });
        }
      }
    });
}

export async function saveSamLeader(input: {
  name: string;
  leaderName: string;
  isActive?: boolean;
  leaderRosterId?: string;
}): Promise<void> {
  await upsertLeaderRows([prepareSamLeaderValues(input)], false);
}
