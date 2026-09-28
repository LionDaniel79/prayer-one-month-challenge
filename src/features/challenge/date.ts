export type DateKey = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateKey(value: DateKey): Date {
  const match = DATE_RE.exec(value);
  if (!match) throw new Error("INVALID_DATE_KEY");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("INVALID_DATE_KEY");
  }

  return date;
}

function formatDate(date: Date): DateKey {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: DateKey, amount: number): DateKey {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDate(date);
}

export function defaultEndDate(start: DateKey): DateKey {
  const date = parseDateKey(start);
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const day = date.getUTCDate();

  const nextMonthIndex = monthIndex + 1;
  const nextMonthYear = year + Math.floor(nextMonthIndex / 12);
  const normalizedNextMonth = nextMonthIndex % 12;
  const lastDayOfNextMonth = new Date(
    Date.UTC(nextMonthYear, normalizedNextMonth + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfNextMonth);
  const matching = new Date(
    Date.UTC(nextMonthYear, normalizedNextMonth, clampedDay),
  );
  matching.setUTCDate(matching.getUTCDate() - 1);
  return formatDate(matching);
}

export function todayInSeoul(now = new Date()): DateKey {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isPrayerDay(dateKey: DateKey): boolean {
  return parseDateKey(dateKey).getUTCDay() !== 0;
}

export function isMutablePrayerDate({
  prayerDate,
  today,
  startDate,
  endDate,
}: {
  prayerDate: DateKey;
  today: DateKey;
  startDate: DateKey;
  endDate: DateKey;
}): boolean {
  if (prayerDate < startDate || prayerDate > endDate) return false;
  if (!isPrayerDay(prayerDate)) return false;

  const yesterday = addDays(today, -1);
  return prayerDate === today || prayerDate === yesterday;
}

export function eligiblePrayerDates({
  startDate,
  endDate,
  today,
}: {
  startDate: DateKey;
  endDate: DateKey;
  today: DateKey;
}): DateKey[] {
  if (today < startDate) return [];

  const effectiveEnd = today < endDate ? today : endDate;
  const dates: DateKey[] = [];

  for (let cursor = startDate; cursor <= effectiveEnd; cursor = addDays(cursor, 1)) {
    if (isPrayerDay(cursor)) dates.push(cursor);
  }

  return dates;
}
