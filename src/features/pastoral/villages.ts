import { getDb, rows, sql } from "./db";
import { requireReportAdmin } from "./access";
import { parseVillageLeader, reportId, type Actor, type VillageLeader } from "./policy";
export async function listVillageLeaders(actor: Actor) {
  requireReportAdmin(actor);
  return rows<VillageLeader>(getDb(), sql`select id,name,village,leader_name as "leaderName",is_active as "isActive" from prayer_app.village_leaders order by village::int`);
}
export async function saveVillageLeader(actor: Actor, input: unknown) {
  requireReportAdmin(actor);
  const value = parseVillageLeader(input);
  await getDb().execute(sql`insert into prayer_app.village_leaders(name,village,leader_name,is_active) values(${value.name},${value.village},${value.leaderName},${value.isActive}) on conflict(village) do update set leader_name=excluded.leader_name,is_active=excluded.is_active,updated_at=now()`);
}
export async function deleteVillageLeader(actor: Actor, id: string) {
  requireReportAdmin(actor); reportId(id);
  await getDb().execute(sql`delete from prayer_app.village_leaders where id=${id}`);
}
