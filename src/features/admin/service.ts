import { and, asc, eq, gt, lt, or } from "drizzle-orm";
import { getDb } from "../../db/client";
import { challenges, memberRoster, prayerCheckins, users } from "../../db/schema";
import { DomainError } from "../../lib/http";
import type { SessionUser } from "../auth/session";
import { defaultEndDate, todayInSeoul } from "../challenge/date";
import { calculateProgress } from "../challenge/progress";
import { decryptRosterPhone } from "../roster/crypto";
import { formatPhoneForDisplay } from "../roster/normalize";

export type AdminMemberSource = {
  userId: string;
  name: string;
  position: string | null;
  phone: string | null;
  samLabel: string | null;
  completed: number;
  eligible: number;
  completedToday: boolean;
  role?: "member" | "admin";
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
    position: string | null;
    phone: string | null;
    samLabel: string | null;
    completed: number;
    eligible: number;
    rate: number;
    rank: number;
    completedToday: boolean;
    role: "member" | "admin";
    isActive: boolean;
  }>;
  sams: Array<{
    samLabel: string;
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
  challenge: AdminDashboardData["challenge"] = null,
): AdminDashboardData {
  const ranked = rows
    .map((row) => ({ ...row, rate: ratio(row.completed, row.eligible) }))
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name, "ko"));

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

  const grouped = new Map<string, typeof members>();
  for (const member of members) {
    const label = member.samLabel ?? "미지정";
    const group = grouped.get(label) ?? [];
    group.push(member);
    grouped.set(label, group);
  }

  const sams = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ko", { numeric: true }))
    .map(([samLabel, samMembers]) => {
      const samTodayCompleted = samMembers.filter((member) => member.completedToday).length;
      return {
        samLabel,
        members: samMembers.length,
        averageRate:
          samMembers.reduce((sum, member) => sum + member.rate, 0) / samMembers.length,
        todayCompleted: samTodayCompleted,
        todayRate: samTodayCompleted / samMembers.length,
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
    sams,
  };
}

export function requireAdmin(sessionUser: SessionUser | null): asserts sessionUser is SessionUser {
  if (!sessionUser || sessionUser.role !== "admin") {
    throw new DomainError("FORBIDDEN", 403);
  }
}

function phoneForAdmin(ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  try {
    return formatPhoneForDisplay(decryptRosterPhone(ciphertext));
  } catch {
    throw new DomainError("ROSTER_PHONE_DECRYPT_FAILED", 500);
  }
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

  const userRows = await db
    .select({
      userId: users.id,
      userName: users.displayName,
      rosterName: memberRoster.canonicalName,
      position: memberRoster.position,
      phoneCiphertext: memberRoster.phoneCiphertext,
      samLabel: memberRoster.samLabel,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .leftJoin(memberRoster, eq(memberRoster.id, users.rosterId))
    .where(eq(users.isActive, true))
    .orderBy(asc(users.displayName));

  const identities = userRows.map((row) => ({
    userId: row.userId,
    name: row.rosterName ?? row.userName,
    position: row.position,
    phone: phoneForAdmin(row.phoneCiphertext),
    samLabel: row.samLabel,
    role: row.role,
    isActive: row.isActive,
  }));

  if (!activeChallenge) {
    return aggregateAdminDashboard(
      identities.map((row) => ({
        ...row,
        completed: 0,
        eligible: 0,
        completedToday: false,
      })),
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
  const rows = identities.map((user) => {
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

  return aggregateAdminDashboard(rows, activeChallenge);
}

export function resolveChallengeEndDate(startDate: string, explicitEndDate?: string): string {
  return explicitEndDate?.trim() || defaultEndDate(startDate);
}

export function assertChallengeRange(startDate: string, endDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new DomainError("INVALID_DATE_RANGE", 400);
  }
  if (endDate < startDate) throw new DomainError("INVALID_DATE_RANGE", 400);
}

export async function getAdminChallenge() {
  return getDb()
    .select({
      id: challenges.id,
      title: challenges.title,
      startDate: challenges.startDate,
      endDate: challenges.endDate,
      isActive: challenges.isActive,
    })
    .from(challenges)
    .orderBy(asc(challenges.createdAt));
}

export async function updateChallenge(input: {
  id?: string;
  title: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
}) {
  const endDate = resolveChallengeEndDate(input.startDate, input.endDate);
  assertChallengeRange(input.startDate, endDate);
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
              gt(prayerCheckins.prayerDate, endDate),
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
          endDate,
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
        endDate,
        isActive: input.isActive,
      })
      .returning({ id: challenges.id });
    return created.id;
  });
}
