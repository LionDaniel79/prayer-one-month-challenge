import { getDb, rows, sql, type Executor } from "./db";
import { assertManager, CommunityError, parseFolderName, type Actor } from "./policy";
import { parseFolderOrder } from "./refinement-policy";
// Shared by folder creation, deletion and reorder; transaction-level, pooler-safe.
const lockFolders = (db: Executor) => db.execute(sql`select pg_advisory_xact_lock(560029,1)`);
export async function listFolders() {
  return rows<{id:string;name:string;postCount:number}>(getDb(), sql`select f.id,f.name,(select count(*)::int from prayer_app.community_posts p where p.folder_id=f.id and p.published_at is not null) as "postCount" from prayer_app.community_folders f order by f.sort_order,f.created_at,f.id`);
}
export async function createFolder(user: Actor, name: unknown) {
  assertManager(user); const validName = parseFolderName(name);
  return getDb().transaction(async tx => {
    await lockFolders(tx);
    const [folder] = await rows<{id:string}>(tx, sql`insert into prayer_app.community_folders(name,sort_order) select ${validName},coalesce(max(sort_order),-1)+1 from prayer_app.community_folders returning id`);
    return folder;
  });
}
export async function renameFolder(user: Actor, id: string, name: unknown) {
  assertManager(user);
  const result = await rows(getDb(), sql`update prayer_app.community_folders set name=${parseFolderName(name)} where id=${id} returning id`);
  if (!result.length) throw new CommunityError("FOLDER_NOT_FOUND",404);
}
export async function reorderFolders(user: Actor, value: unknown) {
  assertManager(user); const input = parseFolderOrder(value);
  await getDb().transaction(async tx => {
    await lockFolders(tx);
    const current = await rows<{id:string}>(tx, sql`select id from prayer_app.community_folders order by sort_order,created_at,id for update`);
    if (current.length !== input.expectedIds.length || current.some((folder,index) => folder.id !== input.expectedIds[index])) throw new CommunityError("FOLDER_ORDER_CHANGED",409);
    for (let index=0;index<input.ids.length;index++) await tx.execute(sql`update prayer_app.community_folders set sort_order=${index} where id=${input.ids[index]}`);
  });
}
export async function deleteFolder(user: Actor, id: string) {
  assertManager(user);
  await getDb().transaction(async tx => {
    await lockFolders(tx);
    const folders = await rows<{id:string}>(tx, sql`select id from prayer_app.community_folders order by id for update`);
    if (!folders.some(f=>f.id===id)) throw new CommunityError("FOLDER_NOT_FOUND",404);
    if (folders.length===1) throw new CommunityError("LAST_FOLDER",409);
    const children = await rows(tx, sql`select id from prayer_app.community_posts where folder_id=${id} limit 1`);
    if (children.length) throw new CommunityError("FOLDER_NOT_EMPTY",409);
    await tx.execute(sql`delete from prayer_app.community_folders where id=${id}`);
  });
}
