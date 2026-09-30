import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db/client";
export { sql, getDb };
export type Executor = Pick<ReturnType<typeof getDb>, "execute">;
export async function rows<T>(db: Executor, query: SQL): Promise<T[]> {
  return (await db.execute(query)).rows as T[];
}
