"use client";
import { useCallback, useEffect, useState } from "react";
import type { AdminHubDashboardData } from "../../src/features/admin/hub-service";
import { AdminHubDashboard } from "./AdminHubDashboard";
import { prayerCommentsReadEvent } from "../prayer-requests/useUnreadPrayerComments";

export function AdminHubDashboardLoader() {
  const [data, setData] = useState<AdminHubDashboardData | null>(null);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    setReload(n => n + 1);
  }, []);
  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState !== "hidden") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("pastoral:changed", refresh);
    window.addEventListener(prayerCommentsReadEvent, refresh);
    document.addEventListener("visibilitychange", refreshVisible);
    const timer = window.setInterval(refreshVisible, 15000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pastoral:changed", refresh);
      window.removeEventListener(prayerCommentsReadEvent, refresh);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [refresh]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/dashboard?page=${page}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("ADMIN_HUB_LOAD_FAILED");
        return response.json() as Promise<AdminHubDashboardData>;
      }).then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(() => { if (!controller.signal.aborted) setError("대시보드를 불러오지 못했습니다. 다시 시도해 주세요."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, reload]);
  if (!data) return <section className="card empty-state" aria-live="polite">
    {error ? <><p role="alert">{error}</p><button onClick={refresh}>다시 시도</button></> : <strong>관리자 대시보드를 불러오는 중입니다.</strong>}
  </section>;
  return <>{error && <div role="alert" className="card"><p>{error}</p><button onClick={refresh}>다시 시도</button></div>}
    <AdminHubDashboard data={data} loading={loading} onPageChange={next => {
      setLoading(true);
      setError("");
      setPage(next);
    }} />
  </>;
}
