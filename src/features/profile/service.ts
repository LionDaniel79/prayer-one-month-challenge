import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { sams, users } from "../../db/schema";
import type { ProfileData } from "../../lib/types";

export async function getProfile(userId: string): Promise<ProfileData | null> {
  const [row] = await getDb()
    .select({
      displayName: users.displayName,
      samId: users.samId,
      samName: sams.name,
      samLeaderName: sams.leaderName,
    })
    .from(users)
    .leftJoin(sams, eq(sams.id, users.samId))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function updateMySam(userId: string, samId: string): Promise<void> {
  const [sam] = await getDb()
    .select({ id: sams.id })
    .from(sams)
    .where(and(eq(sams.id, samId), eq(sams.isActive, true)))
    .limit(1);
  if (!sam) throw new Error("INVALID_SAM");
  await getDb().update(users).set({ samId, updatedAt: new Date() }).where(eq(users.id, userId));
}
