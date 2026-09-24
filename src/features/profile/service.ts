import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../db/client";
import { memberRoster, users } from "../../db/schema";
import { DomainError } from "../../lib/http";
import type { ProfileData } from "../../lib/types";
import {
  hashPassword,
  phoneLookupHash,
  verifyPassword,
} from "../auth/crypto";

export async function getProfile(userId: string): Promise<ProfileData | null> {
  const [row] = await getDb()
    .select({
      userDisplayName: users.displayName,
      rosterName: memberRoster.canonicalName,
      position: memberRoster.position,
      samLabel: memberRoster.samLabel,
      passwordHash: memberRoster.passwordHash,
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
    passwordMode: row.passwordHash ? "custom" : "initial",
  };
}

async function sameNamePasswordConflict(
  rosterId: string,
  canonicalName: string,
  password: string,
): Promise<boolean> {
  const rows = await getDb()
    .select({
      phoneLookupHash: memberRoster.phoneLookupHash,
      passwordHash: memberRoster.passwordHash,
    })
    .from(memberRoster)
    .where(
      and(
        eq(memberRoster.canonicalName, canonicalName),
        eq(memberRoster.isActive, true),
        ne(memberRoster.id, rosterId),
      ),
    );

  for (const row of rows) {
    if (row.passwordHash && await verifyPassword(row.passwordHash, password)) {
      return true;
    }
    if (!row.passwordHash && row.phoneLookupHash) {
      try {
        if (phoneLookupHash(password) === row.phoneLookupHash) return true;
      } catch {
        // A non-phone custom password cannot match an initial phone password.
      }
    }
  }
  return false;
}

export async function changeProfilePassword(
  userId: string,
  password: string,
): Promise<void> {
  if (!password) throw new DomainError("INVALID_PASSWORD", 400);

  const db = getDb();
  const [target] = await db
    .select({
      rosterId: users.rosterId,
      canonicalName: memberRoster.canonicalName,
    })
    .from(users)
    .leftJoin(memberRoster, eq(memberRoster.id, users.rosterId))
    .where(eq(users.id, userId))
    .limit(1);

  if (!target?.rosterId || !target.canonicalName) {
    throw new DomainError("ROSTER_NOT_LINKED", 409);
  }

  if (await sameNamePasswordConflict(
    target.rosterId,
    target.canonicalName,
    password,
  )) {
    throw new DomainError("PASSWORD_CONFLICT_SAME_NAME", 409);
  }

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx
      .update(memberRoster)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(memberRoster.id, target.rosterId!));
    await tx
      .update(users)
      .set({ phonePasswordHash: passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  });
}
