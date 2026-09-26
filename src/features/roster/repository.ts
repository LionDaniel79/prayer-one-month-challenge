import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { memberRoster } from "../../db/schema";

export type RosterCredential = {
  id: string;
  canonicalName: string;
  position: string | null;
  phoneLookupHash: string | null;
  passwordHash: string | null;
  village: string | null;
  sam: string | null;
  samLabel: string | null;
  isActive: boolean;
  isAdmin: boolean;
};

export type RosterRecord = RosterCredential & {
  sourceName: string;
  phoneCiphertext: string | null;
  source: string;
  sourceRow: number | null;
};

export function isLoginEligibleRoster(
  row: RosterCredential,
  canonicalName: string,
  lookupHash: string,
): boolean {
  return (
    row.isActive &&
    row.phoneLookupHash !== null &&
    row.canonicalName === canonicalName &&
    row.phoneLookupHash === lookupHash
  );
}

const credentialSelect = {
  id: memberRoster.id,
  canonicalName: memberRoster.canonicalName,
  position: memberRoster.position,
  phoneLookupHash: memberRoster.phoneLookupHash,
  passwordHash: memberRoster.passwordHash,
  village: memberRoster.village,
  sam: memberRoster.sam,
  samLabel: memberRoster.samLabel,
  isActive: memberRoster.isActive,
  isAdmin: memberRoster.isAdmin,
};

export async function findActiveRosterCredentials(
  canonicalName: string,
): Promise<RosterCredential[]> {
  return getDb()
    .select(credentialSelect)
    .from(memberRoster)
    .where(
      and(
        eq(memberRoster.canonicalName, canonicalName),
        eq(memberRoster.isActive, true),
      ),
    );
}

export async function findActiveRosterCredential(
  canonicalName: string,
  lookupHash: string,
): Promise<RosterCredential | null> {
  const [row] = await getDb()
    .select(credentialSelect)
    .from(memberRoster)
    .where(
      and(
        eq(memberRoster.canonicalName, canonicalName),
        eq(memberRoster.phoneLookupHash, lookupHash),
        eq(memberRoster.isActive, true),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function findRosterById(id: string): Promise<RosterRecord | null> {
  const [row] = await getDb()
    .select({
      id: memberRoster.id,
      sourceName: memberRoster.sourceName,
      canonicalName: memberRoster.canonicalName,
      position: memberRoster.position,
      phoneLookupHash: memberRoster.phoneLookupHash,
      passwordHash: memberRoster.passwordHash,
      phoneCiphertext: memberRoster.phoneCiphertext,
      village: memberRoster.village,
      sam: memberRoster.sam,
      samLabel: memberRoster.samLabel,
      isActive: memberRoster.isActive,
      isAdmin: memberRoster.isAdmin,
      source: memberRoster.source,
      sourceRow: memberRoster.sourceRow,
    })
    .from(memberRoster)
    .where(eq(memberRoster.id, id))
    .limit(1);

  return row ?? null;
}
