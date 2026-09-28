"use client";

import { fetchJson } from "../../../src/lib/fetch-json";
import { useEffect, useMemo, useState } from "react";
import type { AdminVisitRecord, VisitDetailPatch } from "../../../src/features/visits/admin-service";
import type { VisitStatus } from "../../../src/features/visits/types";
import { AdminVisitDetail } from "./AdminVisitDetail";
import { AdminVisitList } from "./AdminVisitList";

async function readJson(url: string, init?: RequestInit) {
  return fetchJson<{ visits?: AdminVisitRecord[] }>(url, {
    cache: "no-store", ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
  });
}

function errorCopy(cause: unknown): string {
  const code = cause instanceof Error ? cause.message : "";
  if (code === "VISIT_SYNC_PENDING") return "Google 일정 생성 중입니다. 잠시 후 다시 조회해 주세요.";
  if (code === "CALENDAR_EVENT_DELETE_FAILED") return "Google 일정 삭제를 확인하지 못해 신청을 남겨 두었습니다. 다시 시도해 주세요.";
  if (code === "CALENDAR_NOT_CONNECTED" || code === "CALENDAR_NOT_SELECTED") return "관리자 설정에서 Google Calendar 연결과 캘린더 선택을 확인해 주세요.";
  return "처리 결과를 확인하지 못했습니다. 다시 조회한 뒤 시도해 주세요.";
}

export function AdminVisitManagement({
  initialStatus = "all",
}: {
  initialStatus?: "all" | VisitStatus;
}) {
  const [visits, setVisits] = useState<AdminVisitRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | VisitStatus>(initialStatus);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => visits.find((visit) => visit.id === selectedId) ?? null,
    [visits, selectedId],
  );

  async function load() {
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const body = await readJson(
        "/api/admin/visits" + (params.size ? "?" + params.toString() : ""),
      );
      const next = (body.visits ?? []) as AdminVisitRecord[];
      setVisits(next);
      setSelectedId((current) =>
        current && next.some((visit) => visit.id === current)
          ? current
          : next[0]?.id ?? null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "심방 신청을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (initialStatus !== "all") params.set("status", initialStatus);

    void readJson(
      "/api/admin/visits" + (params.size ? "?" + params.toString() : ""),
    )
      .then((body) => {
        if (cancelled) return;
        const next = (body.visits ?? []) as AdminVisitRecord[];
        setVisits(next);
        setSelectedId(next[0]?.id ?? null);
        setLoading(false);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "심방 신청을 불러오지 못했습니다.",
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialStatus]);

  async function save(patch: VisitDetailPatch) {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await readJson("/api/admin/visits/" + selected.id, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "수정하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function action(actionName: "confirm" | "complete" | "cancel" | "delete") {
    if (!selected || busy) return;
    if (actionName === "delete" && !window.confirm(`${selected.requesterName}님의 ${selected.visitDate} 심방 신청과 연결된 Google 일정을 삭제할까요? 삭제한 신청 내용은 복구할 수 없습니다.`)) return;
    if (actionName === "cancel" && !window.confirm("이 심방 신청을 취소할까요?")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await readJson(
        "/api/admin/visits/" + selected.id + (actionName === "delete" ? "" : "/" + actionName),
        { method: actionName === "delete" ? "DELETE" : "POST" },
      );
      await load();
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-visit-management">
      <section className="admin-page-heading">
        <p className="eyebrow">상담 & 심방</p>
        <h1>심방 신청 관리</h1>
        <p>신청 내용을 확인하고 Google Calendar 동기화 상태와 확정 과정을 관리합니다.</p>
      </section>

      {error && <p className="error-text" role="alert">{error}</p>}
      {loading ? (
        <section className="card empty-state">
          <strong>심방 신청을 불러오는 중입니다.</strong>
        </section>
      ) : (
        <div className="admin-visit-layout">
          <AdminVisitList
            visits={visits}
            selectedId={selectedId}
            status={status}
            from={from}
            to={to}
            onStatusChange={setStatus}
            onFromChange={setFrom}
            onToChange={setTo}
            onSearch={() => void load()}
            onSelect={(visit) => { if (!busy) setSelectedId(visit.id); }}
          />
          <AdminVisitDetail
            key={selected?.id ?? "none"}
            visit={selected}
            busy={busy}
            onSave={save}
            onAction={action}
          />
        </div>
      )}
    </div>
  );
}
