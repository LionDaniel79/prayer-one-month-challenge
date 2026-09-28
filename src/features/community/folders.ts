import { getDb, rows, sql } from "./db";
import { assertManager, CommunityError, parseFolderName, type Actor } from "./policy";
export async function listFolders() {
  return rows<{id:string;name:string;postCount:number}>(getDb(), sql`select f.id, f.name, (select count(*)::int from prayer_app.community_posts p where p.folder_id=f.id and p.published_at is not null) as "postCount" from prayer_app.community_folders f order by f.created_at,f.id`);
}
export async function createFolder(user: Actor, name: unknown) {
  assertManager(user);
  const [folder] = await rows<{id:string}>(getDb(), sql`insert into prayer_app.community_folders(name) values(${parseFolderName(name)}) returning id`);
  return folder;
}
export async function renameFolder(user: Actor, id: string, name: unknown) {
  assertManager(user);
  const result = await rows(getDb(), sql`update prayer_app.community_folders set name=${parseFolderName(name)} where id=${id} returning id`);
  if (!result.length) throw new CommunityError("FOLDER_NOT_FOUND",404);
}
export async function deleteFolder(user: Actor, id: string) {
  assertManager(user);
  await getDb().transaction(async tx => {
    // Serialize removal including the last-folder invariant. Referencing writes take KEY SHARE.
    const folders = await rows<{id:string}>(tx, sql`select id from prayer_app.community_folders order by id for update`);
    if (!folders.some(f=>f.id===id)) throw new CommunityError("FOLDER_NOT_FOUND",404);
    if (folders.length===1) throw new CommunityError("LAST_FOLDER",409);
    const children = await rows(tx, sql`select id from prayer_app.community_posts where folder_id=${id} limit 1`);
    if (children.length) throw new CommunityError("FOLDER_NOT_EMPTY",409);
    await tx.execute(sql`delete from prayer_app.community_folders where id=${id}`);
  });
}
