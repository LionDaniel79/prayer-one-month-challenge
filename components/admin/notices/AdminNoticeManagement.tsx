"use client";

import { useEffect, useState } from "react";
import type { AdminNoticeRow, NoticeStatus } from "../../../src/features/notices/types";
import { AdminNoticeEditor } from "./AdminNoticeEditor";
import { AdminNoticeList } from "./AdminNoticeList";

async function fetchNotices(): Promise<AdminNoticeRow[]> {
  const response = await fetch("/api/admin/notices", { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code ?? "NOTICE_LOAD_FAILED");
  return body.notices ?? [];
}

export function AdminNoticeManagement() {
  const [notices, setNotices] = useState<AdminNoticeRow[]>([]);
  const [selected, setSelected] = useState<AdminNoticeRow | null>(null);
  const [filter, setFilter] = useState<"all" | NoticeStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      setNotices(await fetchNotices());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "NOTICE_LOAD_FAILED");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchNotices()
      .then((rows) => {
        if (!cancelled) {
          setNotices(rows);
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "NOTICE_LOAD_FAILED");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(notice: AdminNoticeRow) {
    if (!window.confirm("‘" + notice.title + "’ 공지를 삭제할까요?")) return;
    setError("");
    try {
      const response = await fetch("/api/admin/notices/" + notice.id, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.code ?? "NOTICE_DELETE_FAILED");
      if (selected?.id === notice.id) setSelected(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "NOTICE_DELETE_FAILED");
    }
  }

  return (
    <div className="admin-feature-page">
      <section className="admin-page-heading">
        <p className="eyebrow">공동체 소식</p>
        <h1>공지 관리</h1>
        <p>공지 작성, 발행, 읽음 현황을 관리합니다.</p>
      </section>

      {error && <p className="error-text" role="alert">{error}</p>}
      {loading ? (
        <section className="card empty-state">공지를 불러오는 중입니다.</section>
      ) : (
        <div className="admin-notice-layout">
          <AdminNoticeEditor
            key={selected?.id ?? "new"}
            notice={selected}
            onCancel={() => setSelected(null)}
            onSaved={() => {
              setSelected(null);
              void refresh();
            }}
          />
          <AdminNoticeList
            notices={notices}
            filter={filter}
            onFilterChange={setFilter}
            onEdit={setSelected}
            onDelete={(notice) => void remove(notice)}
          />
        </div>
      )}
    </div>
  );
}
