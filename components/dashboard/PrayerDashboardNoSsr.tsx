"use client";

import dynamic from "next/dynamic";
import type { MemberDashboard } from "../../src/lib/types";

const PrayerDashboardClient = dynamic(
  () =>
    import("./PrayerDashboardClient").then(
      (module) => module.PrayerDashboardClient,
    ),
  {
    ssr: false,
    loading: () => (
      <section className="card empty-state" aria-live="polite">
        <strong>기도 달력을 불러오는 중입니다.</strong>
      </section>
    ),
  },
);

export function PrayerDashboardNoSsr({
  initial,
}: {
  initial: MemberDashboard;
}) {
  return <PrayerDashboardClient initial={initial} />;
}
