import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/db/client";
import {
  challenges,
  prayerCheckins,
  sams,
  sessions,
  users,
} from "../src/db/schema";

const sentinel = "SMOKE_ROLLBACK";

async function main() {
  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const [sam] = await tx
        .insert(sams)
        .values({ name: "__smoke_sam__", leaderName: "__smoke_leader__" })
        .returning();

      const [challenge] = await tx
        .insert(challenges)
        .values({
          title: "__smoke_challenge__",
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          isActive: false,
        })
        .returning();

      const [user] = await tx
        .insert(users)
        .values({
          displayName: "__smoke_user__",
          normalizedName: "__smoke_user__",
          phoneLookupHash: "a".repeat(64),
          phonePasswordHash: "$argon2id$smoke",
          samId: sam.id,
        })
        .returning();

      await tx.insert(sessions).values({
        userId: user.id,
        tokenHash: "b".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await tx.insert(prayerCheckins).values({
        challengeId: challenge.id,
        userId: user.id,
        prayerDate: "2026-09-01",
      });

      const rows = await tx
        .select({ userId: prayerCheckins.userId })
        .from(prayerCheckins)
        .where(eq(prayerCheckins.userId, user.id));

      if (rows.length !== 1) throw new Error("SMOKE_JOIN_FAILED");
      throw new Error(sentinel);
    });
  } catch (error) {
    if (error instanceof Error && error.message === sentinel) {
      console.log("Database smoke test passed; transaction rolled back.");
      return;
    }

    throw error;
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
