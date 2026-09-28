import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/db/client";
import { sams, users } from "../src/db/schema";
import {
  hashPhonePassword,
  normalizeName,
  phoneLookupHash,
} from "../src/features/auth/crypto";

async function main() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const phone = process.env.BOOTSTRAP_ADMIN_PHONE;
  const samName = process.env.BOOTSTRAP_SAM_NAME?.trim();
  const samLeader = process.env.BOOTSTRAP_SAM_LEADER?.trim();

  if (!name || !phone || !samName || !samLeader) {
    throw new Error("BOOTSTRAP_ENV_REQUIRED");
  }

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const [existingAdmin] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);
      if (existingAdmin) throw new Error("ADMIN_ALREADY_EXISTS");

      let [sam] = await tx
        .select({ id: sams.id })
        .from(sams)
        .where(eq(sams.name, samName))
        .limit(1);

      if (!sam) {
        [sam] = await tx
          .insert(sams)
          .values({ name: samName, leaderName: samLeader, isActive: true })
          .returning({ id: sams.id });
      }

      const normalizedName = normalizeName(name);
      const lookupHash = phoneLookupHash(phone);
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.normalizedName, normalizedName), eq(users.phoneLookupHash, lookupHash)))
        .limit(1);
      if (existing) throw new Error("ACCOUNT_ALREADY_EXISTS");

      await tx.insert(users).values({
        displayName: name.normalize("NFC"),
        normalizedName,
        phoneLookupHash: lookupHash,
        phonePasswordHash: await hashPhonePassword(phone),
        samId: sam.id,
        role: "admin",
        isActive: true,
      });
    });

    console.log("Bootstrap administrator created.");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "BOOTSTRAP_FAILED");
  process.exitCode = 1;
});
