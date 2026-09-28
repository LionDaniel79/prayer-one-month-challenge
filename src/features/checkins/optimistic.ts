import type { MemberDashboard } from "../../lib/types";
import { calculateProgress } from "../challenge/progress";

export type CheckinState = "checked" | "unchecked";

function withCompletedDates(
  dashboard: MemberDashboard,
  completedDates: string[],
): MemberDashboard {
  const unique = [...new Set(completedDates)].sort();
  return {
    ...dashboard,
    completedDates: unique,
    progress: calculateProgress({
      startDate: dashboard.challenge.startDate,
      endDate: dashboard.challenge.endDate,
      today: dashboard.today,
      completedDates: unique,
    }),
  };
}

export function optimisticToggleDashboard(
  dashboard: MemberDashboard,
  prayerDate: string,
): MemberDashboard {
  const completed = new Set(dashboard.completedDates);
  if (completed.has(prayerDate)) completed.delete(prayerDate);
  else completed.add(prayerDate);
  return withCompletedDates(dashboard, [...completed]);
}

export function reconcileCheckinState(
  dashboard: MemberDashboard,
  prayerDate: string,
  state: CheckinState,
): MemberDashboard {
  const completed = new Set(dashboard.completedDates);
  if (state === "checked") completed.add(prayerDate);
  else completed.delete(prayerDate);
  return withCompletedDates(dashboard, [...completed]);
}
