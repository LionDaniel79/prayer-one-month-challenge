import { addDays, todayInSeoul } from "../challenge/date";
import type {
  CalendarEventLike,
  VisitDateAvailability,
} from "./types";

function weekdayOfDateKey(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("INVALID_DATE_KEY");
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  ).getUTCDay();
}

export function googleEventBlockedDates(
  event: CalendarEventLike,
): Set<string> {
  const blocked = new Set<string>();
  if (event.status === "cancelled") return blocked;

  const startDate = event.start?.date ?? null;
  const endDate = event.end?.date ?? null;
  if (startDate && endDate) {
    for (let cursor = startDate; cursor < endDate; cursor = addDays(cursor, 1)) {
      blocked.add(cursor);
    }
    return blocked;
  }

  const startDateTime = event.start?.dateTime ?? null;
  const endDateTime = event.end?.dateTime ?? null;
  if (!startDateTime || !endDateTime) return blocked;

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    return blocked;
  }

  const firstDate = todayInSeoul(start);
  const lastDate = todayInSeoul(new Date(end.getTime() - 1));

  for (
    let cursor = firstDate;
    cursor <= lastDate;
    cursor = addDays(cursor, 1)
  ) {
    blocked.add(cursor);
  }
  return blocked;
}

export function evaluateVisitDate({
  date,
  calendarHealthy,
  googleBlockedDates,
  blockedDates,
  blockedWeekdays,
  activeVisitDates,
}: {
  date: string;
  calendarHealthy: boolean;
  googleBlockedDates: Set<string>;
  blockedDates: Set<string>;
  blockedWeekdays: Set<number>;
  activeVisitDates: Set<string>;
}): VisitDateAvailability {
  if (!calendarHealthy) {
    return { date, available: false, reason: "calendar_unavailable" };
  }
  if (googleBlockedDates.has(date)) {
    return { date, available: false, reason: "google_event" };
  }
  if (blockedDates.has(date)) {
    return { date, available: false, reason: "blocked_date" };
  }
  if (blockedWeekdays.has(weekdayOfDateKey(date))) {
    return { date, available: false, reason: "blocked_weekday" };
  }
  if (activeVisitDates.has(date)) {
    return { date, available: false, reason: "existing_visit" };
  }
  return { date, available: true };
}
