import { getDb, rows, sql } from "./db";
import { requireReportAdmin } from "./access";
import { rosterIdentities, bindingColumns, registrationTarget, bindingState } from "../sams/identity-service";
import { selectLeaderIdentity, object, parseVillageLeader, reportId, type Actor, type VillageLeader } from "./policy";
export async function listVillageLeaders(actor: Actor) {
  requireReportAdmin(actor);
  const roster=await rosterIdentities();
  const list=await rows<VillageLeader>(getDb(), sql`select id,name,village,leader_name as "leaderName",${bindingColumns},is_active as "isActive" from prayer_app.village_leaders order by village::int`);
  return list.map(row=>({...row,bindingState:bindingState(registrationTarget("village",row),row,roster)}));
}
export async function saveVillageLeader(actor: Actor, input: unknown) {
  requireReportAdmin(actor);
  const value = parseVillageLeader(input);
  const supplied=object(input).leaderRosterId;
  const chosen=supplied===undefined?undefined:reportId(supplied);
  await getDb().transaction(async tx=>{
    const [existing]=await rows<VillageLeader>(tx,sql`select id,name,village,leader_name as "leaderName",is_active as "isActive",${bindingColumns} from prayer_app.village_leaders where village=${value.village} for update`);
    const binding=selectLeaderIdentity(registrationTarget("village",value),await rosterIdentities(tx),existing??null,chosen);
    await tx.execute(sql`insert into prayer_app.village_leaders(name,village,leader_name,is_active,leader_roster_id,leader_binding_locked) values(${value.name},${value.village},${value.leaderName},${value.isActive},${binding.rosterId},${binding.locked}) on conflict(village) do update set leader_name=excluded.leader_name,is_active=excluded.is_active,leader_roster_id=excluded.leader_roster_id,leader_binding_locked=excluded.leader_binding_locked,updated_at=now()`);
  });
}
export async function deleteVillageLeader(actor: Actor, id: string) {
  requireReportAdmin(actor); reportId(id);
  await getDb().execute(sql`delete from prayer_app.village_leaders where id=${id}`);
}
