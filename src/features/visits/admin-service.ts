import {
  and,
  asc,
  eq,
  gte,
  lt,
  ne,
} from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  users,
  visitBlockedDates,
  visitBlockedWeekdays,
  visitRequests,
} from "../../db/schema";
import { DomainError } from "../../lib/http";
import type {
  CalendarProvider,
  VisitCalendarEventInput,
} from "./calendar-provider";
import type {
  CalendarSyncStatus,
  VisitStatus,
} from "./types";

export type AdminVisitRecord = {
  id: string;
  requesterName: string;
  visitDate: string;
  visitType: "personal" | "sam";
  attendees: string;
  location: string;
  preferredTime: string;
  reason: string;
  status: VisitStatus;
  calendarSyncStatus: CalendarSyncStatus;
  googleEventId: string | null;
};

export type VisitDetailPatch = Partial<Pick<
  AdminVisitRecord,
  "visitType" | "attendees" | "location" | "preferredTime" | "reason"
>>;

export type VisitAdminRepository = {
  getById(id: string): Promise<AdminVisitRecord | null>;
  updateDetails(id: string, patch: VisitDetailPatch): Promise<void>;
  setSyncStatus(id: string, status: CalendarSyncStatus): Promise<void>;
  transition(
    id: string,
    input: {
      status: VisitStatus;
      confirmedAt?: Date | null;
      confirmedByUserId?: string | null;
    },
  ): Promise<void>;
};

export function canTransitionVisit(
  from: VisitStatus,
  to: VisitStatus,
): boolean {
  if (from === "requested") {
    return to === "confirmed" || to === "cancelled";
  }
  if (from === "confirmed") {
    return to === "completed" || to === "cancelled";
  }
  return false;
}

function calendarInput(
  visit: AdminVisitRecord,
  patch: VisitDetailPatch = {},
  status: "requested" | "confirmed" | "completed" =
    visit.status === "confirmed"
      ? "confirmed"
      : visit.status === "completed"
        ? "completed"
        : "requested",
): VisitCalendarEventInput {
  return {
    requesterName: visit.requesterName,
    visitDate: visit.visitDate,
    visitType: patch.visitType ?? visit.visitType,
    attendees: patch.attendees ?? visit.attendees,
    location: patch.location ?? visit.location,
    preferredTime: patch.preferredTime ?? visit.preferredTime,
    status,
  };
}

export const dbVisitAdminRepository: VisitAdminRepository = {
  async getById(id) {
    const [row] = await getDb()
      .select({
        id: visitRequests.id,
        requesterName: users.displayName,
        visitDate: visitRequests.visitDate,
        visitType: visitRequests.visitType,
        attendees: visitRequests.attendees,
        location: visitRequests.location,
        preferredTime: visitRequests.preferredTime,
        reason: visitRequests.reason,
        status: visitRequests.status,
        calendarSyncStatus: visitRequests.calendarSyncStatus,
        googleEventId: visitRequests.googleEventId,
      })
      .from(visitRequests)
      .innerJoin(users, eq(users.id, visitRequests.requesterUserId))
      .where(eq(visitRequests.id, id))
      .limit(1);

    if (!row) return null;
    return {
      ...row,
      visitType: row.visitType as "personal" | "sam",
      status: row.status as VisitStatus,
      calendarSyncStatus: row.calendarSyncStatus as CalendarSyncStatus,
    };
  },

  async updateDetails(id, patch) {
    await getDb()
      .update(visitRequests)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(visitRequests.id, id));
  },

  async setSyncStatus(id, status) {
    await getDb()
      .update(visitRequests)
      .set({
        calendarSyncStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(visitRequests.id, id));
  },

  async transition(id, input) {
    await getDb()
      .update(visitRequests)
      .set({
        status: input.status,
        confirmedAt: input.confirmedAt,
        confirmedByUserId: input.confirmedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(visitRequests.id, id));
  },
};

function calendarVisibleChanged(patch: VisitDetailPatch): boolean {
  return (
    patch.visitType !== undefined ||
    patch.attendees !== undefined ||
    patch.location !== undefined ||
    patch.preferredTime !== undefined
  );
}

export async function updateVisitDetails(
  id: string,
  patch: VisitDetailPatch,
  provider: CalendarProvider,
  repository: VisitAdminRepository = dbVisitAdminRepository,
): Promise<void> {
  const visit = await repository.getById(id);
  if (!visit) throw new DomainError("VISIT_NOT_FOUND", 404);

  await repository.updateDetails(id, patch);

  if (
    visit.googleEventId &&
    visit.status !== "cancelled" &&
    calendarVisibleChanged(patch)
  ) {
    try {
      await provider.updateVisitEvent(
        visit.googleEventId,
        calendarInput(visit, patch),
      );
      await repository.setSyncStatus(id, "synced");
    } catch {
      await repository.setSyncStatus(id, "failed");
      throw new DomainError("CALENDAR_EVENT_UPDATE_FAILED", 502);
    }
  }
}

async function transitionVisit(
  id: string,
  to: VisitStatus,
  provider: CalendarProvider,
  repository: VisitAdminRepository,
  adminUserId?: string,
): Promise<void> {
  const visit = await repository.getById(id);
  if (!visit) throw new DomainError("VISIT_NOT_FOUND", 404);
  if (!canTransitionVisit(visit.status, to)) {
    throw new DomainError("INVALID_VISIT_STATUS_TRANSITION", 409);
  }

  if (to === "cancelled") {
    await repository.transition(id, { status: "cancelled" });
    if (visit.googleEventId) {
      try {
        await provider.deleteVisitEvent(visit.googleEventId);
        await repository.setSyncStatus(id, "synced");
      } catch {
        await repository.setSyncStatus(id, "failed");
        throw new DomainError("CALENDAR_EVENT_DELETE_FAILED", 502);
      }
    }
    return;
  }

  const confirmed = to === "confirmed";
  await repository.transition(id, {
    status: to,
    confirmedAt: confirmed ? new Date() : undefined,
    confirmedByUserId: confirmed ? adminUserId ?? null : undefined,
  });

  if (visit.googleEventId) {
    try {
      await provider.updateVisitEvent(
        visit.googleEventId,
        calendarInput(
          visit,
          {},
          to === "completed" ? "completed" : "confirmed",
        ),
      );
      await repository.setSyncStatus(id, "synced");
    } catch {
      await repository.setSyncStatus(id, "failed");
      throw new DomainError("CALENDAR_EVENT_UPDATE_FAILED", 502);
    }
  }
}

export async function confirmVisit(
  id: string,
  adminUserId: string,
  provider: CalendarProvider,
  repository: VisitAdminRepository = dbVisitAdminRepository,
): Promise<void> {
  return transitionVisit(id, "confirmed", provider, repository, adminUserId);
}

export async function completeVisit(
  id: string,
  provider: CalendarProvider,
  repository: VisitAdminRepository = dbVisitAdminRepository,
): Promise<void> {
  return transitionVisit(id, "completed", provider, repository);
}

export async function cancelVisit(
  id: string,
  provider: CalendarProvider,
  repository: VisitAdminRepository = dbVisitAdminRepository,
): Promise<void> {
  return transitionVisit(id, "cancelled", provider, repository);
}

export async function listVisitsForAdmin({
  status,
  from,
  to,
}: {
  status?: VisitStatus;
  from?: string;
  to?: string;
} = {}): Promise<AdminVisitRecord[]> {
  const conditions = [];
  if (status) conditions.push(eq(visitRequests.status, status));
  if (from) conditions.push(gte(visitRequests.visitDate, from));
  if (to) conditions.push(lt(visitRequests.visitDate, to));

  const rows = await getDb()
    .select({
      id: visitRequests.id,
      requesterName: users.displayName,
      visitDate: visitRequests.visitDate,
      visitType: visitRequests.visitType,
      attendees: visitRequests.attendees,
      location: visitRequests.location,
      preferredTime: visitRequests.preferredTime,
      reason: visitRequests.reason,
      status: visitRequests.status,
      calendarSyncStatus: visitRequests.calendarSyncStatus,
      googleEventId: visitRequests.googleEventId,
    })
    .from(visitRequests)
    .innerJoin(users, eq(users.id, visitRequests.requesterUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(visitRequests.visitDate));

  return rows.map((row) => ({
    ...row,
    visitType: row.visitType as "personal" | "sam",
    status: row.status as VisitStatus,
    calendarSyncStatus: row.calendarSyncStatus as CalendarSyncStatus,
  }));
}

function weekdayOfDateKey(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function findBlockedWeekdayConflicts(
  visitDates: string[],
  newlyBlocked: Set<number>,
): string[] {
  return visitDates.filter((date) => newlyBlocked.has(weekdayOfDateKey(date)));
}

export async function listVisitBlockedDates() {
  return getDb()
    .select({
      visitDate: visitBlockedDates.visitDate,
      reason: visitBlockedDates.reason,
    })
    .from(visitBlockedDates)
    .orderBy(asc(visitBlockedDates.visitDate));
}

export async function blockVisitDate(input: {
  visitDate: string;
  reason: string | null;
  adminUserId: string;
}): Promise<void> {
  const [conflict] = await getDb()
    .select({ id: visitRequests.id })
    .from(visitRequests)
    .where(
      and(
        eq(visitRequests.visitDate, input.visitDate),
        ne(visitRequests.status, "cancelled"),
      ),
    )
    .limit(1);

  if (conflict) {
    throw new DomainError("BLOCK_CONFLICTS_WITH_VISIT", 409);
  }

  await getDb()
    .insert(visitBlockedDates)
    .values({
      visitDate: input.visitDate,
      reason: input.reason,
      createdByUserId: input.adminUserId,
    })
    .onConflictDoUpdate({
      target: visitBlockedDates.visitDate,
      set: {
        reason: input.reason,
        createdByUserId: input.adminUserId,
      },
    });
}

export async function unblockVisitDate(visitDate: string): Promise<void> {
  await getDb()
    .delete(visitBlockedDates)
    .where(eq(visitBlockedDates.visitDate, visitDate));
}

export async function listVisitBlockedWeekdays(): Promise<number[]> {
  const rows = await getDb()
    .select({ weekday: visitBlockedWeekdays.weekday })
    .from(visitBlockedWeekdays)
    .orderBy(asc(visitBlockedWeekdays.weekday));
  return rows.map((row) => row.weekday);
}

export async function replaceVisitBlockedWeekdays(input: {
  weekdays: number[];
  adminUserId: string;
  today: string;
}): Promise<void> {
  const current = new Set(await listVisitBlockedWeekdays());
  const newlyBlocked = new Set(
    input.weekdays.filter((weekday) => !current.has(weekday)),
  );

  if (newlyBlocked.size > 0) {
    const futureVisits = await getDb()
      .select({ visitDate: visitRequests.visitDate })
      .from(visitRequests)
      .where(
        and(
          gte(visitRequests.visitDate, input.today),
          ne(visitRequests.status, "cancelled"),
        ),
      );

    const conflicts = findBlockedWeekdayConflicts(
      futureVisits.map((row) => row.visitDate),
      newlyBlocked,
    );

    if (conflicts.length > 0) {
      throw new DomainError(
        "BLOCKED_WEEKDAY_CONFLICTS_WITH_VISITS",
        409,
        String(conflicts.length),
      );
    }
  }

  await getDb().transaction(async (tx) => {
    await tx.delete(visitBlockedWeekdays);
    if (input.weekdays.length > 0) {
      await tx.insert(visitBlockedWeekdays).values(
        input.weekdays.map((weekday) => ({
          weekday,
          createdByUserId: input.adminUserId,
        })),
      );
    }
  });
}
