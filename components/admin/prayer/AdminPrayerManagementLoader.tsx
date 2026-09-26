"use client";

import { useEffect, useState } from "react";
import type { AdminDashboardData } from "../../../src/features/admin/service";
import { AdminPrayerManagement } from "./AdminPrayerManagement";

export function AdminPrayerManagementLoader() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/prayer", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.code ?? "ADMIN_PRAYER_LOAD_FAILED");
        if (!cancelled) setData(body as AdminDashboardData);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "ADMIN_PRAYER_LOAD_FAILED");
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <section className="card empty-state" role="alert">
        <strong>기도운동 관리 데이터를 불러오지 못했습니다.</strong>
        <p className="helper-text">오류 코드: {error}</p>
      </section>
    );
  }
  if (!data) {
    return <section className="card empty-state">기도운동 관리 데이터를 불러오는 중입니다.</section>;
  }
  return <AdminPrayerManagement initial={data} />;
}
