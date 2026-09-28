import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db/client";
import { CommunityError } from "./policy";
export { sql, getDb };
export type Executor = Pick<ReturnType<typeof getDb>, "execute">;
export async function rows<T>(db: Executor, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}
export type PostRow = { id:string;folderId:string;title:string;body:string;authorId:string|null;publishedAt:string|null;createdAt:string;updatedAt:string;version:number };
export async function lockedPost(db: Executor, id: string): Promise<PostRow> {
  const [post] = await rows<PostRow>(db, sql`select id,folder_id as "folderId",title,body,author_user_id as "authorId",published_at as "publishedAt",created_at as "createdAt",updated_at as "updatedAt",version from prayer_app.community_posts where id=${id} for update`);
  if (!post) throw new CommunityError("POST_NOT_FOUND",404);
  return post;
}
export async function requireFolder(db: Executor, id: string): Promise<void> {
  const found = await rows(db, sql`select id from prayer_app.community_folders where id=${id} for key share`);
  if (!found.length) throw new CommunityError("FOLDER_NOT_FOUND",404);
}
