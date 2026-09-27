"use client";

import { useEffect, useState } from "react";
import type { AdminDashboardData } from "../../../src/features/admin/service";
import { AdminPrayerManagement } from "./AdminPrayerManagement";
import { fetchJson } from "../../../src/lib/fetch-json";

export function AdminPrayerManagementLoader() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void fetchJson<AdminDashboardData>("/api/admin/prayer", { cache: "no-store", signal: controller.signal })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "ADMIN_PRAYER_LOAD_FAILED");
        }
      });
    return () => { cancelled = true; controller.abort(); };
  }, [attempt]);

  if (error) {
    return (
      <section className="card empty-state" role="alert">
        <strong>기도운동 관리 데이터를 불러오지 못했습니다.</strong>
        <p className="helper-text">잠시 후 다시 시도해 주세요.</p>
        <button type="button" className="text-button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>다시 불러오기</button>
      </section>
    );
  }
  if (!data) {
    return <section className="card empty-state">기도운동 관리 데이터를 불러오는 중입니다.</section>;
  }
  return <AdminPrayerManagement initial={data} />;
}
