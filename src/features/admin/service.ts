import { and, asc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb } from "../../db/client";
import { challenges, prayerCheckins, sams, sessions, users } from "../../db/schema";
import { DomainError } from "../../lib/http";
import type { SessionUser } from "../auth/session";
import { todayInSeoul } from "../challenge/date";
import { calculateProgress } from "../challenge/progress";

export type AdminMemberSource = {
  userId: string;
  name: string;
  samId: string | null;
  samName: string | null;
  completed: number;
  eligible: number;
  completedToday: boolean;
  role?: "member" | "admin";
  isActive?: boolean;
};

export type AdminSamSource = {
  samId: string;
  name: string;
  leaderName: string;
  isActive?: boolean;
};

export type AdminDashboardData = {
  challenge: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  } | null;
  totals: {
    members: number;
    todayCompleted: number;
    todayRate: number;
    averageRate: number;
  };
  buckets: {
    perfect: number;
    high: number;
    medium: number;
    low: number;
  };
  members: Array<{
    userId: string;
    name: string;
    samId: string | null;
    samName: string | null;
    completed: number;
    eligible: number;
    rate: number;
    rank: number;
    completedToday: boolean;
    role: "member" | "admin";
    isActive: boolean;
  }>;
  sams: Array<{
    samId: string;
    name: string;
    leaderName: string;
    isActive: boolean;
    members: number;
    averageRate: number;
    todayCompleted: number;
    todayRate: number;
  }>;
};

function ratio(completed: number, eligible: number): number {
  return eligible > 0 ? completed / eligible : 0;
}

export function aggregateAdminDashboard(
  rows: AdminMemberSource[],
  samRows: AdminSamSource[],
  challenge: AdminDashboardData["challenge"] = null,
): AdminDashboardData {
  const ranked = rows
    .map((row) => ({ ...row, rate: ratio(row.completed, row.eligible) }))
    .sort((a, b) => b.rate - a.rate);

  let lastRate: number | null = null;
  let denseRank = 0;
  const members = ranked.map((row) => {
    if (lastRate === null || row.rate !== lastRate) {
      denseRank += 1;
      lastRate = row.rate;
    }
    return {
      ...row,
      role: row.role ?? "member",
      isActive: row.isActive ?? true,
      rank: denseRank,
    };
  });

  const todayCompleted = members.filter((member) => member.completedToday).length;
  const averageRate =
    members.length > 0
      ? members.reduce((sum, member) => sum + member.rate, 0) / members.length
      : 0;

  const buckets = { perfect: 0, high: 0, medium: 0, low: 0 };
  for (const member of members) {
    if (member.rate === 1) buckets.perfect += 1;
    else if (member.rate >= 0.8) buckets.high += 1;
    else if (member.rate >= 0.6) buckets.medium += 1;
    else buckets.low += 1;
  }

  const samStats = samRows.map((sam) => {
    const samMembers = members.filter((member) => member.samId === sam.samId);
    const samTodayCompleted = samMembers.filter((member) => member.completedToday).length;
    return {
      samId: sam.samId,
      name: sam.name,
      leaderName: sam.leaderName,
      isActive: sam.isActive ?? true,
      members: samMembers.length,
      averageRate:
        samMembers.length > 0
          ? samMembers.reduce((sum, member) => sum + member.rate, 0) / samMembers.length
          : 0,
      todayCompleted: samTodayCompleted,
      todayRate: samMembers.length > 0 ? samTodayCompleted / samMembers.length : 0,
    };
  });

  return {
    challenge,
    totals: {
      members: members.length,
      todayCompleted,
      todayRate: members.length > 0 ? todayCompleted / members.length : 0,
      averageRate,
    },
    buckets,
    members,
    sams: samStats,
  };
}

export function requireAdmin(sessionUser: SessionUser | null): asserts sessionUser is SessionUser {
  if (!sessionUser || sessionUser.role !== "admin") {
    throw new DomainError("FORBIDDEN", 403);
  }
}

export function assertChallengeRange(startDate: string, endDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new DomainError("INVALID_DATE_RANGE", 400);
  }
  if (endDate < startDate) throw new DomainError("INVALID_DATE_RANGE", 400);
}

export async function getAdminDashboard(now = new Date()): Promise<AdminDashboardData> {
  const db = getDb();
  const [activeChallenge] = await db
    .select({
      id: challenges.id,
      title: challenges.title,
      startDate: challenges.startDate,
      endDate: challenges.endDate,
      isActive: challenges.isActive,
    })
    .from(challenges)
    .where(eq(challenges.isActive, true))
    .limit(1);

  const samRows = await db
    .select({
      samId: sams.id,
      name: sams.name,
      leaderName: sams.leaderName,
      isActive: sams.isActive,
    })
    .from(sams)
    .orderBy(asc(sams.name));

  const userRows = await db
    .select({
      userId: users.id,
      name: users.displayName,
      samId: users.samId,
      samName: sams.name,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .leftJoin(sams, eq(sams.id, users.samId))
    .where(eq(users.isActive, true))
    .orderBy(asc(users.displayName));

  if (!activeChallenge) {
    return aggregateAdminDashboard(
      userRows.map((row) => ({
        ...row,
        completed: 0,
        eligible: 0,
        completedToday: false,
      })),
      samRows,
      null,
    );
  }

  const checkinRows = await db
    .select({
      userId: prayerCheckins.userId,
      prayerDate: prayerCheckins.prayerDate,
    })
    .from(prayerCheckins)
    .where(eq(prayerCheckins.challengeId, activeChallenge.id));

  const completedByUser = new Map<string, string[]>();
  for (const row of checkinRows) {
    const values = completedByUser.get(row.userId) ?? [];
    values.push(row.prayerDate);
    completedByUser.set(row.userId, values);
  }

  const today = todayInSeoul(now);
  const rows = userRows.map((user) => {
    const completedDates = completedByUser.get(user.userId) ?? [];
    const progress = calculateProgress({
      startDate: activeChallenge.startDate,
      endDate: activeChallenge.endDate,
      today,
      completedDates,
    });
    return {
      ...user,
      completed: progress.completed,
      eligible: progress.eligible,
      completedToday: completedDates.includes(today),
    };
  });

  return aggregateAdminDashboard(rows, samRows, activeChallenge);
}

export async function getAdminChallenge() {
  const rows = await getDb()
    .select({
      id: challenges.id,
      title: challenges.title,
      startDate: challenges.startDate,
      endDate: challenges.endDate,
      isActive: challenges.isActive,
    })
    .from(challenges)
    .orderBy(asc(challenges.createdAt));
  return rows;
}

export async function updateChallenge(input: {
  id?: string;
  title: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}) {
  assertChallengeRange(input.startDate, input.endDate);
  const db = getDb();

  return db.transaction(async (tx) => {
    if (input.id) {
      const [outside] = await tx
        .select({ id: prayerCheckins.id })
        .from(prayerCheckins)
        .where(
          and(
            eq(prayerCheckins.challengeId, input.id),
            or(
              lt(prayerCheckins.prayerDate, input.startDate),
              gt(prayerCheckins.prayerDate, input.endDate),
            ),
          ),
        )
        .limit(1);
      if (outside) throw new DomainError("CHECKINS_OUTSIDE_RANGE", 409);
    }

    if (input.isActive) {
      await tx.update(challenges).set({ isActive: false }).where(eq(challenges.isActive, true));
    }

    if (input.id) {
      const [updated] = await tx
        .update(challenges)
        .set({
          title: input.title,
          startDate: input.startDate,
          endDate: input.endDate,
          isActive: input.isActive,
        })
        .where(eq(challenges.id, input.id))
        .returning({ id: challenges.id });
      if (!updated) throw new DomainError("CHALLENGE_NOT_FOUND", 404);
      return updated.id;
    }

    const [created] = await tx
      .insert(challenges)
      .values({
        title: input.title,
        startDate: input.startDate,
        endDate: input.endDate,
        isActive: input.isActive,
      })
      .returning({ id: challenges.id });
    return created.id;
  });
}

export async function getAdminSams() {
  return getDb()
    .select({
      id: sams.id,
      name: sams.name,
      leaderName: sams.leaderName,
      isActive: sams.isActive,
    })
    .from(sams)
    .orderBy(asc(sams.name));
}

export async function upsertSam(input: {
  id?: string;
  name: string;
  leaderName: string;
  isActive: boolean;
}) {
  const name = input.name.trim().normalize("NFC");
  const leaderName = input.leaderName.trim().normalize("NFC");
  if (!name || !leaderName) throw new DomainError("INVALID_INPUT", 400);

  if (input.id) {
    const [updated] = await getDb()
      .update(sams)
      .set({ name, leaderName, isActive: input.isActive })
      .where(eq(sams.id, input.id))
      .returning({ id: sams.id });
    if (!updated) throw new DomainError("SAM_NOT_FOUND", 404);
    return updated.id;
  }

  const [created] = await getDb()
    .insert(sams)
    .values({ name, leaderName, isActive: input.isActive })
    .returning({ id: sams.id });
  return created.id;
}

export async function getAdminUsers() {
  return getDb()
    .select({
      id: users.id,
      name: users.displayName,
      samId: users.samId,
      samName: sams.name,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .leftJoin(sams, eq(sams.id, users.samId))
    .orderBy(asc(users.displayName));
}

export async function updateUserAdmin(input: {
  userId: string;
  samId?: string | null;
  role?: "member" | "admin";
  isActive?: boolean;
}) {
  const db = getDb();
  return db.transaction(async (tx) => {
    if (input.samId) {
      const [sam] = await tx
        .select({ id: sams.id })
        .from(sams)
        .where(and(eq(sams.id, input.samId), eq(sams.isActive, true)))
        .limit(1);
      if (!sam) throw new DomainError("INVALID_SAM", 400);
    }

    const update: {
      samId?: string | null;
      role?: "member" | "admin";
      isActive?: boolean;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if ("samId" in input) update.samId = input.samId ?? null;
    if (input.role) update.role = input.role;
    if (typeof input.isActive === "boolean") update.isActive = input.isActive;

    const [updated] = await tx
      .update(users)
      .set(update)
      .where(eq(users.id, input.userId))
      .returning({ id: users.id });
    if (!updated) throw new DomainError("USER_NOT_FOUND", 404);

    if (input.isActive === false) {
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.userId, input.userId), isNull(sessions.revokedAt)));
    }
  });
}
