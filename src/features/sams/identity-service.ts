import { getDb, rows, sql, type Executor } from "../pastoral/db";
import { leaderCandidates, leaderInScope, selectLeaderIdentity, samKey, villageKey, type Identity, type LeaderBinding, type LeaderTarget } from "../pastoral/policy";
import { decryptRosterPhone } from "../roster/crypto";

export type LeaderState = "linked" | "ambiguous" | "unmatched" | "unavailable";
export type CandidateView = { id: string; name: string; village: string; sam: string; phoneSuffix: string | null; eligible: boolean };
export type IdentityResolution = { state: LeaderState; rosterId: string | null; candidates: CandidateView[]; candidateCount: number };
type Registration = LeaderBinding & { id: string; name: string; leaderName: string; isActive: boolean; village?: string };
export const identityColumns = sql`id,source_name as "sourceName",canonical_name as "canonicalName",village,sam_label as "samLabel",is_active as "isActive"`;
export const bindingColumns = sql`leader_roster_id as "leaderRosterId",leader_binding_locked as "leaderBindingLocked"`;
export async function rosterIdentities(db: Executor = getDb()) { return rows<Identity>(db,sql`select ${identityColumns} from prayer_app.member_roster`); }
export function registrationTarget(kind: "sam" | "village", registration: {name: string;leaderName:string;village?:string}): LeaderTarget {
  return {kind,name:registration.name,leaderName:registration.leaderName,scope:kind==="sam"?samKey(registration.name):villageKey(registration.village??registration.name.replace(/장$/u,""))};
}
export function bindingState(target: LeaderTarget, registration: LeaderBinding, roster: Identity[]): LeaderState {
  if (registration.leaderRosterId) {
    const person=roster.find(r=>r.id===registration.leaderRosterId);
    return person&&leaderInScope(target,person)?"linked":"unavailable";
  }
  if(registration.leaderBindingLocked)return "unavailable";
  return leaderCandidates(target,roster).length>1?"ambiguous":"unmatched";
}
export async function findRegistration(target: LeaderTarget,db:Executor=getDb(),lock=false) {
  const table=target.kind==="sam"?sql`prayer_app.sams`:sql`prayer_app.village_leaders`;
  const entries=await rows<Registration>(db,sql`select id,name,leader_name as "leaderName",is_active as "isActive",${bindingColumns} from ${table} ${lock?sql`for update`:sql``}`);
  return entries.find(r=>target.kind==="sam"?samKey(r.name)===samKey(target.name):r.name===target.name)??null;
}
export async function resolveLeaderForAdmin(target:LeaderTarget):Promise<IdentityResolution>{
  const db=getDb(); const [roster,existing]=await Promise.all([rosterIdentities(db),findRegistration(target,db)]);
  const matches=leaderCandidates(target,roster);
  let chosen: string|null=null;let state:LeaderState="unmatched";
  try{const result=selectLeaderIdentity(target,roster,existing);chosen=result.rosterId;state=bindingState(target,{leaderRosterId:chosen,leaderBindingLocked:result.locked},roster);}
  catch{state="ambiguous";}
  // Do not expose the stored encrypted phone, lookup hash, or full phone in the response.
  const phones=matches.length>1?await rows<{id:string;ciphertext:string|null}>(db,sql`select id,phone_ciphertext as ciphertext from prayer_app.member_roster where id in (${sql.join(matches.map(r=>sql`${r.id}`),sql`,`)})`):[];
  const suffix=(id:string)=>{const value=phones.find(r=>r.id===id)?.ciphertext;if(!value)return null;try{return decryptRosterPhone(value).replace(/\D/gu,"").slice(-4);}catch{return null;}};
  const display=matches.map(r=>({id:r.id,name:r.sourceName,village:r.village??"소속 없음",sam:r.samLabel??"소속 없음",phoneSuffix:suffix(r.id),eligible:leaderInScope(target,r)}));
  // A pinned person may be renamed after assignment; show the current name without re-matching it.
  if(chosen&&!display.some(r=>r.id===chosen)){const r=roster.find(r=>r.id===chosen);if(r)display.unshift({id:r.id,name:r.sourceName,village:r.village??"소속 없음",sam:r.samLabel??"소속 없음",phoneSuffix:null,eligible:leaderInScope(target,r)});}
  return {state,rosterId:chosen,candidates:display,candidateCount:matches.length};
}
/** Only registrations that have NEVER been bound may be automatically resolved. */
export async function reconcileUnboundLeaders(db:Executor){
  const roster=await rosterIdentities(db);
  for(const kind of ["sam","village"] as const){
    const table=kind==="sam"?sql`prayer_app.sams`:sql`prayer_app.village_leaders`;
    const list=await rows<Registration>(db,sql`select id,name,leader_name as "leaderName",is_active as "isActive",${bindingColumns} from ${table} where leader_binding_locked=false and leader_roster_id is null and leader_name<>'' for update`);
    for(const entry of list){
      const target=registrationTarget(kind,entry);const matches=leaderCandidates(target,roster);
      if(matches.length===1&&leaderInScope(target,matches[0]))await db.execute(sql`update ${table} set leader_roster_id=${matches[0].id},leader_binding_locked=true where id=${entry.id} and leader_binding_locked=false and leader_roster_id is null`);
    }
  }
}
