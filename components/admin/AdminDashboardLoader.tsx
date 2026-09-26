"use client";

import { useEffect, useState } from "react";
import type { AdminRosterPage } from "../../src/features/admin/roster-service";
import type { AdminDashboardData } from "../../src/features/admin/service";
import { AdminDashboard } from "./AdminDashboard";

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code =
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      typeof body.code === "string"
        ? body.code
        : `HTTP_${response.status}`;
    throw new Error(code);
  }
  return body as T;
}

export function AdminDashboardLoader() {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [roster, setRoster] = useState<AdminRosterPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nextDashboard = await readJson<AdminDashboardData>(
          "/api/admin/dashboard",
        );
        const nextRoster = await readJson<AdminRosterPage>("/api/admin/roster");
        if (!cancelled) {
          setDashboard(nextDashboard);
          setRoster(nextRoster);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "ADMIN_DATA_LOAD_FAILED");
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
        <strong>관리자 데이터를 불러오지 못했습니다.</strong>
        <p className="helper-text">오류 코드: {error}</p>
      </section>
    );
  }

  if (!dashboard || !roster) {
    return (
      <section className="card empty-state" aria-live="polite">
        <strong>관리자 데이터를 불러오는 중입니다.</strong>
      </section>
    );
  }

  return <AdminDashboard initial={dashboard} initialRoster={roster} />;
}
