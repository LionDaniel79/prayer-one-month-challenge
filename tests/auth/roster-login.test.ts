import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword, phoneLookupHash } from "../../src/features/auth/crypto";
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
    passwordHash: null,
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
    async findRosterCredentials(name) {
      return rows.filter((row) => row.canonicalName === name && row.isActive);
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

  return { repository, createCount: () => creates };
}

describe("roster allowlist authentication", () => {
  it("uses the phone as the initial password when no custom password exists", async () => {
    const fake = fakeRepository([roster("r1", "01011112222")]);
    const result = await authenticateRosterIdentity(
      fake.repository,
      "김은희B",
      "010-1111-2222",
    );
    expect(result?.roster.id).toBe("r1");
  });

  it("accepts an arbitrary custom password with no character-count maximum", async () => {
    const password = "한글!x".repeat(100);
    const fake = fakeRepository([
      roster("r1", "01011112222", {
        passwordHash: await hashPassword(password),
      }),
    ]);

    const result = await authenticateRosterIdentity(
      fake.repository,
      "김은희",
      password,
    );
    expect(result?.roster.id).toBe("r1");
  });

  it("stops accepting the phone after a custom password is set", async () => {
    const fake = fakeRepository([
      roster("r1", "01011112222", {
        passwordHash: await hashPassword("새비밀번호"),
      }),
    ]);

    await expect(
      authenticateRosterIdentity(fake.repository, "김은희", "01011112222"),
    ).resolves.toBeNull();
  });

  it("distinguishes same Korean names by their initial phone passwords", async () => {
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

  it("rejects a wrong password and does not create a participant", async () => {
    const fake = fakeRepository([roster("r1", "01011112222")]);
    await expect(
      authenticateRosterIdentity(fake.repository, "김은희", "wrong"),
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

  it("fails closed for inactive or credential-less roster rows", async () => {
    const inactive = roster("r1", "01011112222", { isActive: false });
    const credentialLess = roster("r2", "01022223333", {
      phoneLookupHash: null,
      passwordHash: null,
    });
    const fake = fakeRepository([inactive, credentialLess]);

    await expect(
      authenticateRosterIdentity(fake.repository, "김은희", "01011112222"),
    ).resolves.toBeNull();
    await expect(
      authenticateRosterIdentity(fake.repository, "김은희", "01022223333"),
    ).resolves.toBeNull();
  });
});
