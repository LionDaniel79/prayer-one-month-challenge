import { and, eq, gte, lt, ne } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  users,
  visitBlockedDates,
  visitBlockedWeekdays,
  visitRequests,
} from "../../db/schema";
import { DomainError } from "../../lib/http";
import { addDays, todayInSeoul } from "../challenge/date";
import type {
  CalendarProvider,
  VisitCalendarEventInput,
} from "./calendar-provider";
import {
  evaluateVisitDate,
  googleEventBlockedDates,
} from "./date-policy";
import type {
  VisitDateAvailability,
  VisitStatus,
} from "./types";

export type SubmitVisitInput = {
  requesterUserId: string;
  visitDate: string;
  visitType: "personal" | "sam";
  attendees: string;
  location: string;
  preferredTime: string;
  reason: string;
};

export type NewVisit = SubmitVisitInput & {
  status: "requested";
  calendarSyncStatus: "pending";
};

export type VisitRepository = {
  listBlockedDates(startDate: string, endDateExclusive: string): Promise<string[]>;
  listBlockedWeekdays(): Promise<number[]>;
  listActiveVisitDates(startDate: string, endDateExclusive: string): Promise<string[]>;
  isDateBlocked(date: string): Promise<boolean>;
  isWeekdayBlocked(weekday: number): Promise<boolean>;
  hasActiveVisit(date: string): Promise<boolean>;
  getRequester(userId: string): Promise<{ id: string; displayName: string } | null>;
  createPending(input: NewVisit): Promise<{ id: string; status: VisitStatus }>;
  markSynced(id: string, eventId: string): Promise<void>;
  cancelAfterSyncFailure(id: string): Promise<void>;
};

function weekdayOfDateKey(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new DomainError("INVALID_VISIT_DATE", 400);
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  ).getUTCDay();
}

function monthRange(month: string): {
  startDate: string;
  endDateExclusive: string;
  dates: string[];
} {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new DomainError("INVALID_VISIT_MONTH", 400);

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new DomainError("INVALID_VISIT_MONTH", 400);
  }

  const monthIndex = monthNumber - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const next = new Date(Date.UTC(year, monthIndex + 1, 1));
  const startDate = start.toISOString().slice(0, 10);
  const endDateExclusive = next.toISOString().slice(0, 10);
  const dates: string[] = [];

  for (let cursor = startDate; cursor < endDateExclusive; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }

  return { startDate, endDateExclusive, dates };
}

function seoulDayBounds(date: string) {
  return {
    timeMin: date + "T00:00:00+09:00",
    timeMax: addDays(date, 1) + "T00:00:00+09:00",
  };
}

export const dbVisitRepository: VisitRepository = {
  async listBlockedDates(startDate, endDateExclusive) {
    const rows = await getDb()
      .select({ date: visitBlockedDates.visitDate })
      .from(visitBlockedDates)
      .where(
        and(
          gte(visitBlockedDates.visitDate, startDate),
          lt(visitBlockedDates.visitDate, endDateExclusive),
        ),
      );
    return rows.map((row) => row.date);
  },

  async listBlockedWeekdays() {
    const rows = await getDb()
      .select({ weekday: visitBlockedWeekdays.weekday })
      .from(visitBlockedWeekdays);
    return rows.map((row) => row.weekday);
  },

  async listActiveVisitDates(startDate, endDateExclusive) {
    const rows = await getDb()
      .select({ date: visitRequests.visitDate })
      .from(visitRequests)
      .where(
        and(
          gte(visitRequests.visitDate, startDate),
          lt(visitRequests.visitDate, endDateExclusive),
          ne(visitRequests.status, "cancelled"),
        ),
      );
    return rows.map((row) => row.date);
  },

  async isDateBlocked(date) {
    const [row] = await getDb()
      .select({ date: visitBlockedDates.visitDate })
      .from(visitBlockedDates)
      .where(eq(visitBlockedDates.visitDate, date))
      .limit(1);
    return Boolean(row);
  },

  async isWeekdayBlocked(weekday) {
    const [row] = await getDb()
      .select({ weekday: visitBlockedWeekdays.weekday })
      .from(visitBlockedWeekdays)
      .where(eq(visitBlockedWeekdays.weekday, weekday))
      .limit(1);
    return Boolean(row);
  },

  async hasActiveVisit(date) {
    const [row] = await getDb()
      .select({ id: visitRequests.id })
      .from(visitRequests)
      .where(
        and(
          eq(visitRequests.visitDate, date),
          ne(visitRequests.status, "cancelled"),
        ),
      )
      .limit(1);
    return Boolean(row);
  },

  async getRequester(userId) {
    const [row] = await getDb()
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  },

  async createPending(input) {
    const [created] = await getDb()
      .insert(visitRequests)
      .values({
        requesterUserId: input.requesterUserId,
        visitDate: input.visitDate,
        visitType: input.visitType,
        attendees: input.attendees,
        location: input.location,
        preferredTime: input.preferredTime,
        reason: input.reason,
        status: "requested",
        calendarSyncStatus: "pending",
      })
      .returning({ id: visitRequests.id, status: visitRequests.status });

    return {
      id: created.id,
      status: created.status as VisitStatus,
    };
  },

  async markSynced(id, eventId) {
    await getDb()
      .update(visitRequests)
      .set({
        googleEventId: eventId,
        calendarSyncStatus: "synced",
        updatedAt: new Date(),
      })
      .where(eq(visitRequests.id, id));
  },

  async cancelAfterSyncFailure(id) {
    await getDb()
      .update(visitRequests)
      .set({
        status: "cancelled",
        calendarSyncStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(visitRequests.id, id));
  },
};

export async function getMonthAvailability(
  month: string,
  provider: CalendarProvider,
  repository: VisitRepository = dbVisitRepository,
): Promise<VisitDateAvailability[]> {
  const { startDate, endDateExclusive, dates } = monthRange(month);

  let events;
  try {
    events = await provider.listEvents({
      timeMin: startDate + "T00:00:00+09:00",
      timeMax: endDateExclusive + "T00:00:00+09:00",
    });
  } catch {
    return dates.map((date) => ({
      date,
      available: false as const,
      reason: "calendar_unavailable" as const,
    }));
  }

  const blockedDates = new Set(
    await repository.listBlockedDates(startDate, endDateExclusive),
  );
  const blockedWeekdays = new Set(await repository.listBlockedWeekdays());
  const activeVisitDates = new Set(
    await repository.listActiveVisitDates(startDate, endDateExclusive),
  );
  const googleBlockedDates = new Set<string>();

  for (const event of events) {
    for (const date of googleEventBlockedDates(event)) {
      googleBlockedDates.add(date);
    }
  }

  return dates.map((date) =>
    evaluateVisitDate({
      date,
      calendarHealthy: true,
      googleBlockedDates,
      blockedDates,
      blockedWeekdays,
      activeVisitDates,
    }),
  );
}

export async function submitVisitRequest(
  input: SubmitVisitInput,
  provider: CalendarProvider,
  repository: VisitRepository = dbVisitRepository,
  today = todayInSeoul(),
): Promise<{ id: string }> {
  if (input.visitDate < today) {
    throw new DomainError("VISIT_DATE_UNAVAILABLE", 409);
  }
  if (await repository.isDateBlocked(input.visitDate)) {
    throw new DomainError("VISIT_DATE_UNAVAILABLE", 409);
  }
  if (await repository.isWeekdayBlocked(weekdayOfDateKey(input.visitDate))) {
    throw new DomainError("VISIT_DATE_UNAVAILABLE", 409);
  }
  if (await repository.hasActiveVisit(input.visitDate)) {
    throw new DomainError("VISIT_ALREADY_EXISTS", 409);
  }

  let events;
  try {
    events = await provider.listEvents(seoulDayBounds(input.visitDate));
  } catch {
    throw new DomainError("CALENDAR_AVAILABILITY_UNAVAILABLE", 503);
  }

  const googleBusy = events.some((event) =>
    googleEventBlockedDates(event).has(input.visitDate),
  );
  if (googleBusy) {
    throw new DomainError("VISIT_DATE_UNAVAILABLE", 409);
  }

  const requester = await repository.getRequester(input.requesterUserId);
  if (!requester) throw new DomainError("USER_NOT_FOUND", 404);

  let pending;
  try {
    pending = await repository.createPending({
      ...input,
      status: "requested",
      calendarSyncStatus: "pending",
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new DomainError("VISIT_ALREADY_EXISTS", 409);
    }
    throw error;
  }

  const calendarInput: VisitCalendarEventInput = {
    requesterName: requester.displayName,
    visitDate: input.visitDate,
    visitType: input.visitType,
    attendees: input.attendees,
    location: input.location,
    preferredTime: input.preferredTime,
    status: "requested",
  };

  let eventId: string;
  try {
    const created = await provider.createVisitEvent(calendarInput);
    eventId = created.eventId;
  } catch {
    try {
      await repository.cancelAfterSyncFailure(pending.id);
    } catch {
      // Best-effort compensation; the request must never be reported as success.
    }
    throw new DomainError("CALENDAR_EVENT_CREATE_FAILED", 502);
  }

  try {
    await repository.markSynced(pending.id, eventId);
  } catch {
    try {
      await provider.deleteVisitEvent(eventId);
    } catch {
      // Google cleanup is best-effort; DB compensation still runs below.
    }
    try {
      await repository.cancelAfterSyncFailure(pending.id);
    } catch {
      // Never mask the original sync failure with a compensation error.
    }
    throw new DomainError("CALENDAR_EVENT_SYNC_FAILED", 502);
  }

  return { id: pending.id };
}
