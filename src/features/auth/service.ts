import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { users } from "../../db/schema";
import type { SessionUser } from "./session";
import { createSession } from "./session";
import {
  hashPhonePassword,
  normalizeName,
  phoneLookupHash,
} from "./crypto";
import {
  findActiveRosterCredential,
  type RosterCredential,
} from "../roster/repository";
import { canonicalizeRosterName } from "../roster/normalize";

export type ParticipantRecord = {
  id: string;
  role: "member" | "admin";
  isActive: boolean;
};

export type RosterAuthRepository = {
  findRosterCredential(
    canonicalName: string,
    lookupHash: string,
  ): Promise<RosterCredential | null>;
  findParticipantByRosterId(rosterId: string): Promise<ParticipantRecord | null>;
  createParticipant(input: {
    roster: RosterCredential;
    phonePasswordHash: string;
    now: Date;
  }): Promise<ParticipantRecord>;
  syncParticipant(input: {
    participantId: string;
    roster: RosterCredential;
    now: Date;
  }): Promise<ParticipantRecord>;
};

function participantValues(roster: RosterCredential, now: Date) {
  return {
    rosterId: roster.id,
    displayName: roster.canonicalName,
    normalizedName: normalizeName(roster.canonicalName),
    phoneLookupHash: roster.phoneLookupHash!,
    role: roster.isAdmin ? "admin" as const : "member" as const,
    isActive: roster.isActive,
    updatedAt: now,
  };
}

export const dbRosterAuthRepository: RosterAuthRepository = {
  findRosterCredential: findActiveRosterCredential,

  async findParticipantByRosterId(rosterId) {
    const [row] = await getDb()
      .select({ id: users.id, role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.rosterId, rosterId))
      .limit(1);
    return row ?? null;
  },

  async createParticipant({ roster, phonePasswordHash, now }) {
    const values = {
      ...participantValues(roster, now),
      phonePasswordHash,
    };

    try {
      const [created] = await getDb()
        .insert(users)
        .values(values)
        .returning({ id: users.id, role: users.role, isActive: users.isActive });
      return created;
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;

      const [legacy] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.normalizedName, values.normalizedName),
            eq(users.phoneLookupHash, values.phoneLookupHash),
          ),
        )
        .limit(1);
      if (!legacy) throw error;

      const [linked] = await getDb()
        .update(users)
        .set({ ...participantValues(roster, now), phonePasswordHash })
        .where(eq(users.id, legacy.id))
        .returning({ id: users.id, role: users.role, isActive: users.isActive });
      return linked;
    }
  },

  async syncParticipant({ participantId, roster, now }) {
    const [updated] = await getDb()
      .update(users)
      .set(participantValues(roster, now))
      .where(eq(users.id, participantId))
      .returning({ id: users.id, role: users.role, isActive: users.isActive });
    return updated;
  },
};

export async function authenticateRosterIdentity(
  repository: RosterAuthRepository,
  name: string,
  phone: string,
  now = new Date(),
): Promise<{ roster: RosterCredential; participant: ParticipantRecord } | null> {
  const canonicalName = canonicalizeRosterName(name);
  const lookupHash = phoneLookupHash(phone);
  const roster = await repository.findRosterCredential(canonicalName, lookupHash);

  if (!roster?.isActive || !roster.phoneLookupHash) return null;

  const existing = await repository.findParticipantByRosterId(roster.id);
  if (existing) {
    return {
      roster,
      participant: await repository.syncParticipant({
        participantId: existing.id,
        roster,
        now,
      }),
    };
  }

  const participant = await repository.createParticipant({
    roster,
    phonePasswordHash: await hashPhonePassword(phone),
    now,
  });
  return { roster, participant };
}

export async function authenticateRosterLogin(
  name: string,
  phone: string,
  now = new Date(),
): Promise<{ user: SessionUser; token: string } | null> {
  const result = await authenticateRosterIdentity(
    dbRosterAuthRepository,
    name,
    phone,
    now,
  );
  if (!result) return null;

  const session = await createSession(result.participant.id, now);
  return {
    user: {
      id: result.participant.id,
      displayName: result.roster.canonicalName,
      samId: null,
      role: result.participant.role,
    },
    token: session.token,
  };
}
