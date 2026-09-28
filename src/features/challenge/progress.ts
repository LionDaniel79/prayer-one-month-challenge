import { eligiblePrayerDates, type DateKey } from "./date";

export type Progress = {
  completed: number;
  eligible: number;
  rate: number;
};

export function calculateProgress({
  startDate,
  endDate,
  today,
  completedDates,
}: {
  startDate: DateKey;
  endDate: DateKey;
  today: DateKey;
  completedDates: DateKey[];
}): Progress {
  const eligibleDates = eligiblePrayerDates({ startDate, endDate, today });
  if (eligibleDates.length === 0) {
    return { completed: 0, eligible: 0, rate: 0 };
  }

  const completedSet = new Set(completedDates);
  const completed = eligibleDates.reduce(
    (count, date) => count + (completedSet.has(date) ? 1 : 0),
    0,
  );

  return {
    completed,
    eligible: eligibleDates.length,
    rate: completed / eligibleDates.length,
  };
}
