"use client";

import { useEffect, useState } from "react";
import type { AdminRosterPage } from "../../../src/features/admin/roster-service";
import { AdminUserManagement } from "./AdminUserManagement";

export function AdminUserManagementLoader() {
  const [data, setData] = useState<AdminRosterPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/roster", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.code ?? "ADMIN_USERS_LOAD_FAILED");
        if (!cancelled) setData(body as AdminRosterPage);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "ADMIN_USERS_LOAD_FAILED");
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <section className="card empty-state" role="alert">
        <strong>사용자 명단을 불러오지 못했습니다.</strong>
        <p className="helper-text">오류 코드: {error}</p>
      </section>
    );
  }
  if (!data) {
    return <section className="card empty-state">사용자 명단을 불러오는 중입니다.</section>;
  }
  return <AdminUserManagement initial={data} />;
}
