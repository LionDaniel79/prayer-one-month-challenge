"use client";

import { useEffect, useState } from "react";
import type {
  AdminPrayerRequestDetail,
  AdminPrayerRequestSummary,
  PrayerRequestStatus,
} from "../../../src/features/prayer-requests/types";
import { AdminPrayerRequestDetail as DetailPanel } from "./AdminPrayerRequestDetail";
import { AdminPrayerRequestList } from "./AdminPrayerRequestList";

async function fetchRequests(
  filter: "all" | PrayerRequestStatus,
): Promise<AdminPrayerRequestSummary[]> {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  const suffix = params.toString() ? "?" + params.toString() : "";
  const response = await fetch("/api/admin/prayer-requests" + suffix, {
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code ?? "PRAYER_REQUEST_LOAD_FAILED");
  return body.requests ?? [];
}

async function fetchDetail(id: string): Promise<AdminPrayerRequestDetail> {
  const response = await fetch("/api/admin/prayer-requests/" + id, {
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code ?? "PRAYER_REQUEST_LOAD_FAILED");
  return body.request;
}

export function AdminPrayerRequestManagement({
  initialStatus = "all",
  initialId = null,
}: {
  initialStatus?: "all" | PrayerRequestStatus;
  initialId?: string | null;
}) {
  const [filter, setFilter] = useState<"all" | PrayerRequestStatus>(initialStatus);
  const [requests, setRequests] = useState<AdminPrayerRequestSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [detail, setDetail] = useState<AdminPrayerRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchRequests(filter)
      .then((rows) => {
        if (!cancelled) {
          setRequests(rows);
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "PRAYER_REQUEST_LOAD_FAILED");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [filter]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void fetchDetail(selectedId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "PRAYER_REQUEST_LOAD_FAILED");
        }
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  function select(id: string) {
    setDetail(null);
    setSelectedId(id);
  }

  async function changeStatus(status: PrayerRequestStatus) {
    if (!selectedId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/prayer-requests/" + selectedId, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.code ?? "PRAYER_REQUEST_UPDATE_FAILED");

      const [nextRequests, nextDetail] = await Promise.all([
        fetchRequests(filter),
        fetchDetail(selectedId),
      ]);
      setRequests(nextRequests);
      setDetail(nextDetail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PRAYER_REQUEST_UPDATE_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-feature-page">
      <section className="admin-page-heading">
        <p className="eyebrow">중보기도</p>
        <h1>기도요청 관리</h1>
        <p>전달된 기도요청을 확인하고 처리 상태를 관리합니다.</p>
      </section>

      {error && <p className="error-text" role="alert">{error}</p>}

      {loading ? (
        <section className="card empty-state">기도요청을 불러오는 중입니다.</section>
      ) : (
        <div className="admin-prayer-request-layout">
          <AdminPrayerRequestList
            requests={requests}
            filter={filter}
            selectedId={selectedId}
            onFilterChange={(value) => {
              setFilter(value);
              setDetail(null);
              setSelectedId(null);
            }}
            onSelect={select}
          />
          <DetailPanel
            request={detail}
            busy={busy}
            onStatusChange={(status) => void changeStatus(status)}
          />
        </div>
      )}
    </div>
  );
}
