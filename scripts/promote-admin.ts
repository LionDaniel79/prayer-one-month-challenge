import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/db/client";
import { users } from "../src/db/schema";
import { normalizeName, phoneLookupHash, verifyPhonePassword } from "../src/features/auth/crypto";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const name = argument("--name");
  const phone = argument("--phone");
  if (!name || !phone) throw new Error("USAGE: --name and --phone are required");

  const db = getDb();
  try {
    const [user] = await db
      .select({
        id: users.id,
        phonePasswordHash: users.phonePasswordHash,
      })
      .from(users)
      .where(
        and(
          eq(users.normalizedName, normalizeName(name)),
          eq(users.phoneLookupHash, phoneLookupHash(phone)),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    if (!user || !(await verifyPhonePassword(user.phonePasswordHash, phone))) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }

    await db.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, user.id));
    console.log("Administrator role granted.");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PROMOTION_FAILED");
  process.exitCode = 1;
});
