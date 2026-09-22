import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { challenges, prayerCheckins, sams, users } from "../../db/schema";
import { DomainError } from "../../lib/http";
import type { MemberDashboard } from "../../lib/types";
import { isMutablePrayerDate, todayInSeoul } from "../challenge/date";
import { calculateProgress } from "../challenge/progress";

type ActiveChallenge = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
};

export type CheckinRepository = {
  getActiveChallenge(): Promise<ActiveChallenge | null>;
  findCheckin(userId: string, challengeId: string, prayerDate: string): Promise<{ id: string } | null>;
  deleteCheckin(id: string): Promise<void>;
  insertCheckin(userId: string, challengeId: string, prayerDate: string): Promise<void>;
  getCompletedDates(userId: string, challengeId: string): Promise<string[]>;
  getMemberIdentity(userId: string): Promise<{ displayName: string; samName: string | null } | null>;
};

export const dbCheckinRepository: CheckinRepository = {
  async getActiveChallenge() {
    const [row] = await getDb()
      .select({
        id: challenges.id,
        title: challenges.title,
        startDate: challenges.startDate,
        endDate: challenges.endDate,
      })
      .from(challenges)
      .where(eq(challenges.isActive, true))
      .limit(1);
    return row ?? null;
  },
  async findCheckin(userId, challengeId, prayerDate) {
    const [row] = await getDb()
      .select({ id: prayerCheckins.id })
      .from(prayerCheckins)
      .where(
        and(
          eq(prayerCheckins.userId, userId),
          eq(prayerCheckins.challengeId, challengeId),
          eq(prayerCheckins.prayerDate, prayerDate),
        ),
      )
      .limit(1);
    return row ?? null;
  },
  async deleteCheckin(id) {
    await getDb().delete(prayerCheckins).where(eq(prayerCheckins.id, id));
  },
  async insertCheckin(userId, challengeId, prayerDate) {
    await getDb().insert(prayerCheckins).values({ userId, challengeId, prayerDate });
  },
  async getCompletedDates(userId, challengeId) {
    const rows = await getDb()
      .select({ prayerDate: prayerCheckins.prayerDate })
      .from(prayerCheckins)
      .where(and(eq(prayerCheckins.userId, userId), eq(prayerCheckins.challengeId, challengeId)))
      .orderBy(asc(prayerCheckins.prayerDate));
    return rows.map((row) => row.prayerDate);
  },
  async getMemberIdentity(userId) {
    const [row] = await getDb()
      .select({ displayName: users.displayName, samName: sams.name })
      .from(users)
      .leftJoin(sams, eq(sams.id, users.samId))
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  },
};

export async function toggleCheckin(
  {
    userId,
    prayerDate,
    now = new Date(),
  }: {
    userId: string;
    prayerDate: string;
    now?: Date;
  },
  repository: CheckinRepository = dbCheckinRepository,
): Promise<"checked" | "unchecked"> {
  const challenge = await repository.getActiveChallenge();
  if (!challenge) throw new DomainError("NO_ACTIVE_CHALLENGE", 409);

  const today = todayInSeoul(now);
  if (!isMutablePrayerDate({
    prayerDate,
    today,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
  })) {
    throw new DomainError("DATE_NOT_MUTABLE", 400);
  }

  const existing = await repository.findCheckin(userId, challenge.id, prayerDate);
  if (existing) {
    await repository.deleteCheckin(existing.id);
    return "unchecked";
  }

  try {
    await repository.insertCheckin(userId, challenge.id, prayerDate);
  } catch (error) {
    if ((error as { code?: string }).code !== "23505") throw error;
  }
  return "checked";
}

export async function getMemberDashboard(
  userId: string,
  now = new Date(),
  repository: CheckinRepository = dbCheckinRepository,
): Promise<MemberDashboard | null> {
  const challenge = await repository.getActiveChallenge();
  if (!challenge) return null;

  const identity = await repository.getMemberIdentity(userId);
  if (!identity) throw new DomainError("USER_NOT_FOUND", 404);

  const completedDates = await repository.getCompletedDates(userId, challenge.id);
  const today = todayInSeoul(now);
  const progress = calculateProgress({
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    today,
    completedDates,
  });

  return {
    today,
    user: identity,
    challenge,
    completedDates,
    progress,
  };
}
