"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminVisitRecord, VisitDetailPatch } from "../../../src/features/visits/admin-service";
import type { VisitStatus } from "../../../src/features/visits/types";
import { AdminVisitDetail } from "./AdminVisitDetail";
import { AdminVisitList } from "./AdminVisitList";

async function readJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code ?? "VISIT_ADMIN_REQUEST_FAILED");
  return body;
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
    void load();
    // Initial load is intentionally one-shot. Filters apply via 조회.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function action(actionName: "confirm" | "complete" | "cancel") {
    if (!selected || busy) return;
    if (actionName === "cancel" && !window.confirm("이 심방 신청을 취소할까요?")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await readJson(
        "/api/admin/visits/" + selected.id + "/" + actionName,
        { method: "POST" },
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "상태를 변경하지 못했습니다.");
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
            onSelect={(visit) => setSelectedId(visit.id)}
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
