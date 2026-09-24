"use client";

import { useEffect, useState } from "react";
import type { AdminRosterPage } from "../../src/features/admin/roster-service";
import type { AdminDashboardData } from "../../src/features/admin/service";
import { AdminDashboard } from "./AdminDashboard";

export function AdminDashboardLoader() {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [roster, setRoster] = useState<AdminRosterPage | null>(null);

  useEffect(() => {
    void fetch("/api/admin/dashboard")
      .then((response) => response.json())
      .then(setDashboard);
    void fetch("/api/admin/roster")
      .then((response) => response.json())
      .then(setRoster);
  }, []);

  if (!dashboard || !roster) {
    return <section className="card empty-state">관리자 데이터를 불러오는 중입니다.</section>;
  }

  return <AdminDashboard initial={dashboard} initialRoster={roster} />;
}
