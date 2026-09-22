import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { sams, sessions, users } from "../../db/schema";
import {
  hashPhonePassword,
  newSessionToken,
  normalizeName,
  phoneLookupHash,
  sessionTokenHash,
  verifyPhonePassword,
} from "./crypto";
import { sessionExpiry } from "./session";

export type AuthUserRecord = {
  id: string;
  displayName: string;
  normalizedName: string;
  phoneLookupHash: string;
  phonePasswordHash: string;
  samId: string | null;
  role: "member" | "admin";
  isActive: boolean;
};

export type AuthRepository = {
  findCredential(normalizedName: string, lookupHash: string): Promise<AuthUserRecord | null>;
};

export const dbAuthRepository: AuthRepository = {
  async findCredential(normalizedName, lookupHash) {
    const [row] = await getDb()
      .select({
        id: users.id,
        displayName: users.displayName,
        normalizedName: users.normalizedName,
        phoneLookupHash: users.phoneLookupHash,
        phonePasswordHash: users.phonePasswordHash,
        samId: users.samId,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.normalizedName, normalizedName),
          eq(users.phoneLookupHash, lookupHash),
        ),
      )
      .limit(1);
    return row ?? null;
  },
};

export async function authenticateCredentials(
  repository: AuthRepository,
  name: string,
  phone: string,
): Promise<AuthUserRecord | null> {
  const record = await repository.findCredential(normalizeName(name), phoneLookupHash(phone));
  if (!record?.isActive) return null;
  if (!(await verifyPhonePassword(record.phonePasswordHash, phone))) return null;
  return record;
}

export async function credentialExists(name: string, phone: string): Promise<boolean> {
  return Boolean(
    await dbAuthRepository.findCredential(normalizeName(name), phoneLookupHash(phone)),
  );
}

export async function registerMember({
  name,
  phone,
  samId,
  now = new Date(),
}: {
  name: string;
  phone: string;
  samId: string;
  now?: Date;
}): Promise<{ userId: string; token: string }> {
  const normalizedName = normalizeName(name);
  const lookupHash = phoneLookupHash(phone);
  const phonePasswordHash = await hashPhonePassword(phone);
  const token = newSessionToken();
  const tokenHash = sessionTokenHash(token);

  return getDb().transaction(async (tx) => {
    const [sam] = await tx
      .select({ id: sams.id })
      .from(sams)
      .where(and(eq(sams.id, samId), eq(sams.isActive, true)))
      .limit(1);
    if (!sam) throw new Error("INVALID_SAM");

    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.normalizedName, normalizedName), eq(users.phoneLookupHash, lookupHash)))
      .limit(1);
    if (existing) throw new Error("ACCOUNT_EXISTS");

    const [user] = await tx
      .insert(users)
      .values({
        displayName: name.trim().normalize("NFC"),
        normalizedName,
        phoneLookupHash: lookupHash,
        phonePasswordHash,
        samId,
      })
      .returning({ id: users.id });

    await tx.insert(sessions).values({
      userId: user.id,
      tokenHash,
      expiresAt: sessionExpiry(now),
      lastSeenAt: now,
    });

    return { userId: user.id, token };
  });
}
