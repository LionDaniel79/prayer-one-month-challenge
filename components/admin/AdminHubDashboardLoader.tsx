"use client";

import { useEffect, useState } from "react";
import type { AdminHubDashboardData } from "../../src/features/admin/hub-service";
import { AdminHubDashboard } from "./AdminHubDashboard";

export function AdminHubDashboardLoader() {
  const [data, setData] = useState<AdminHubDashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/admin/dashboard", {
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.code ?? "ADMIN_HUB_LOAD_FAILED");
        }
        if (!cancelled) setData(body as AdminHubDashboardData);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "ADMIN_HUB_LOAD_FAILED",
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <section className="card empty-state" role="alert">
        <strong>관리자 대시보드를 불러오지 못했습니다.</strong>
        <p className="helper-text">오류 코드: {error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="card empty-state" aria-live="polite">
        <strong>관리자 대시보드를 불러오는 중입니다.</strong>
      </section>
    );
  }

  return <AdminHubDashboard data={data} />;
}
