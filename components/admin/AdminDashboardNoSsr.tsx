"use client";

import dynamic from "next/dynamic";
import type { AdminRosterPage } from "../../src/features/admin/roster-service";
import type { AdminDashboardData } from "../../src/features/admin/service";

const AdminDashboard = dynamic(
  () =>
    import("./AdminDashboard").then(
      (module) => module.AdminDashboard,
    ),
  {
    ssr: false,
    loading: () => (
      <section className="card empty-state" aria-live="polite">
        <strong>관리자 화면을 불러오는 중입니다.</strong>
      </section>
    ),
  },
);

export function AdminDashboardNoSsr({
  initial,
  initialRoster,
}: {
  initial: AdminDashboardData;
  initialRoster: AdminRosterPage;
}) {
  return (
    <AdminDashboard
      initial={initial}
      initialRoster={initialRoster}
    />
  );
}
