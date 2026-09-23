import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { memberRoster, users } from "../../db/schema";
import type { ProfileData } from "../../lib/types";

export async function getProfile(userId: string): Promise<ProfileData | null> {
  const [row] = await getDb()
    .select({
      userDisplayName: users.displayName,
      rosterName: memberRoster.canonicalName,
      position: memberRoster.position,
      samLabel: memberRoster.samLabel,
    })
    .from(users)
    .leftJoin(memberRoster, eq(memberRoster.id, users.rosterId))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;
  return {
    displayName: row.rosterName ?? row.userDisplayName,
    position: row.position,
    samLabel: row.samLabel,
  };
}
