import { beforeAll, describe, expect, it } from "vitest";
import { phoneLookupHash } from "../../src/features/auth/crypto";
import {
  authenticateRosterIdentity,
  type RosterAuthRepository,
} from "../../src/features/auth/service";
import type { RosterCredential } from "../../src/features/roster/repository";

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://example";
  process.env.SESSION_SECRET = "s".repeat(32);
  process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
});

function roster(
  id: string,
  phone: string,
  options: Partial<RosterCredential> = {},
): RosterCredential {
  return {
    id,
    canonicalName: "김은희",
    position: "집사",
    phoneLookupHash: phoneLookupHash(phone),
    village: "1마을",
    sam: "6샘",
    samLabel: "1-6",
    isActive: true,
    isAdmin: false,
    ...options,
  };
}

function fakeRepository(rows: RosterCredential[]) {
  const participants = new Map<string, {
    id: string;
    role: "member" | "admin";
    isActive: boolean;
  }>();
  let creates = 0;

  const repository: RosterAuthRepository = {
    async findRosterCredential(name, lookupHash) {
      return rows.find((row) =>
        row.canonicalName === name &&
        row.phoneLookupHash === lookupHash &&
        row.isActive
      ) ?? null;
    },
    async findParticipantByRosterId(rosterId) {
      return participants.get(rosterId) ?? null;
    },
    async createParticipant(input) {
      creates += 1;
      const participant = {
        id: `u-${input.roster.id}`,
        role: input.roster.isAdmin ? "admin" as const : "member" as const,
        isActive: input.roster.isActive,
      };
      participants.set(input.roster.id, participant);
      return participant;
    },
    async syncParticipant(input) {
      const participant = {
        id: input.participantId,
        role: input.roster.isAdmin ? "admin" as const : "member" as const,
        isActive: input.roster.isActive,
      };
      participants.set(input.roster.id, participant);
      return participant;
    },
  };

  return { repository, participants, createCount: () => creates };
}

describe("roster allowlist authentication", () => {
  it("accepts a trailing-letter name when canonical name and phone match", async () => {
    const row = roster("r1", "01011112222");
    const fake = fakeRepository([row]);
    const result = await authenticateRosterIdentity(
      fake.repository,
      "김은희B",
      "010-1111-2222",
    );
    expect(result?.roster.id).toBe("r1");
  });

  it("distinguishes same Korean names by phone", async () => {
    const first = roster("r1", "01011112222");
    const second = roster("r2", "01033334444", { position: "권사" });
    const fake = fakeRepository([first, second]);

    const result = await authenticateRosterIdentity(
      fake.repository,
      "김은희",
      "01033334444",
    );
    expect(result?.roster.id).toBe("r2");
  });

  it("rejects a matching name with a wrong phone", async () => {
    const fake = fakeRepository([roster("r1", "01011112222")]);
    await expect(
      authenticateRosterIdentity(fake.repository, "김은희", "01099998888"),
    ).resolves.toBeNull();
    expect(fake.createCount()).toBe(0);
  });

  it("creates a participant once on first successful login and reuses it later", async () => {
    const fake = fakeRepository([roster("r1", "01011112222")]);

    const first = await authenticateRosterIdentity(
      fake.repository,
      "김은희",
      "01011112222",
    );
    const second = await authenticateRosterIdentity(
      fake.repository,
      "김은희",
      "01011112222",
    );

    expect(first?.participant.id).toBe(second?.participant.id);
    expect(fake.createCount()).toBe(1);
  });

  it("creates an admin participant when the roster marks the person as admin", async () => {
    const fake = fakeRepository([
      roster("r1", "01011112222", { isAdmin: true }),
    ]);
    const result = await authenticateRosterIdentity(
      fake.repository,
      "김은희",
      "01011112222",
    );
    expect(result?.participant.role).toBe("admin");
  });

  it("fails closed for inactive or phone-less roster rows", async () => {
    const inactive = roster("r1", "01011112222", { isActive: false });
    const phoneLess = roster("r2", "01022223333", { phoneLookupHash: null });
    const fake = fakeRepository([inactive, phoneLess]);

    await expect(
      authenticateRosterIdentity(fake.repository, "김은희", "01011112222"),
    ).resolves.toBeNull();
    await expect(
      authenticateRosterIdentity(fake.repository, "김은희", "01022223333"),
    ).resolves.toBeNull();
  });
});
