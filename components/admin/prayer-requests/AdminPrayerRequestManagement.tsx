"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../../src/lib/fetch-json";
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
  const body = await fetchJson<{ requests: AdminPrayerRequestSummary[] }>("/api/admin/prayer-requests" + suffix, {
    cache: "no-store",
  });
  return body.requests ?? [];
}

async function fetchDetail(id: string): Promise<AdminPrayerRequestDetail> {
  const body = await fetchJson<{ request: AdminPrayerRequestDetail }>("/api/admin/prayer-requests/" + id, {
    cache: "no-store",
  });
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
  const [message, setMessage] = useState("");

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
    if (busy || selectedId === id) return;
    setError("");
    setMessage("");
    setDetail(null);
    setSelectedId(id);
  }

  async function changeStatus(status: PrayerRequestStatus) {
    if (!selectedId || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fetchJson("/api/admin/prayer-requests/" + selectedId, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
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

  async function deleteSelectedRequest() {
    if (!detail || selectedId !== detail.id || busy) return;
    const target = detail;
    const receivedAt = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
    }).format(new Date(target.createdAt));
    if (!window.confirm(`${target.requesterName}님의 기도요청(접수: ${receivedAt})을 삭제하시겠습니까?\n\n${target.preview}\n\n삭제 후에는 복구할 수 없습니다.`)) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fetchJson<{ status: string }>("/api/admin/prayer-requests/" + target.id, { method: "DELETE" });
      if (result.status !== "ok") throw new Error("PRAYER_REQUEST_DELETE_FAILED");
      setRequests((current) => current.filter((request) => request.id !== target.id));
      setDetail(null);
      setSelectedId(null);
      setMessage("기도요청을 삭제했습니다.");
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "TimeoutError"
        ? "응답이 지연되어 삭제 결과를 확인하지 못했습니다. 다시 삭제를 눌러 결과를 확인해 주세요."
        : "기도요청을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
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
      {message && <p className="success-text" role="status">{message}</p>}

      {loading ? (
        <section className="card empty-state">기도요청을 불러오는 중입니다.</section>
      ) : (
        <div className="admin-prayer-request-layout">
          <AdminPrayerRequestList
            requests={requests}
            filter={filter}
            selectedId={selectedId}
            busy={busy}
            onFilterChange={(value) => {
              if (busy) return;
              setError("");
              setMessage("");
              setLoading(true);
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
            onDelete={() => void deleteSelectedRequest()}
          />
        </div>
      )}
    </div>
  );
}
