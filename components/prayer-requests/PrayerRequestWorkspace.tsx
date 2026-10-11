"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
import type { OwnPrayerRequest } from "../../src/features/prayer-requests/types";
import { PrayerRequestForm } from "./PrayerRequestForm";
import { PrayerComments } from "./PrayerComments";

const labels = { received: "접수", praying: "기도중", completed: "완료" } as const;

function OwnRequestCard({ request, refresh }: { request: OwnPrayerRequest; refresh: () => void }) {
  const [editing, setEditing] = useState<{ content: string; version: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function update(input: { content: string; expectedVersion: number } | { complete: true }) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await fetchJson("/api/prayer-requests/" + request.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      setEditing(null);
      setMessage("complete" in input ? "기도 완료로 표시했습니다. 관리자도 확인할 수 있습니다." : "기도요청을 수정했습니다.");
      refresh();
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "PRAYER_REQUEST_CONFLICT"
        ? "요청 상태나 내용이 변경되었습니다. 작성 중인 내용을 복사한 뒤 취소하고 다시 수정해 주세요."
        : "변경 결과를 확인하지 못했습니다. 입력 내용을 보존했습니다. 목록을 새로고침해 확인해 주세요.");
    } finally { setBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing) void update({ content: editing.content, expectedVersion: editing.version });
  }
  return <article className="card own-prayer-request" aria-label="내 기도요청 항목">
    <button type="button" className="prayer-request-summary" aria-expanded={expanded} aria-controls={"prayer-detail-" + request.id}
      disabled={busy} onClick={() => setExpanded(value => !value)}>
      <time dateTime={request.createdAt}>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(request.createdAt))}</time>
      <span className="prayer-request-title"><span className="prayer-title-text">{request.content.trim().split(/\r?\n/)[0]}</span>
        {request.hasUnreadComments && <span className="prayer-unread-badge" role="img" aria-label="읽지 않은 관리자 댓글" title="새 관리자 댓글">!</span>}
      </span>
      <span className={"prayer-status is-" + request.status}>{labels[request.status]}</span>
    </button>
    {expanded && <div id={"prayer-detail-" + request.id} className="prayer-request-expanded">
    {editing ? <form className="prayer-request-edit" onSubmit={save}>
      <label>기도내용 수정<textarea aria-label="기도내용 수정" value={editing.content} required maxLength={10000} disabled={busy} onChange={event => setEditing({ ...editing, content: event.target.value })} /></label>
      <div className="prayer-request-actions">
        <button className="text-button" type="button" disabled={busy} onClick={() => setEditing(null)}>수정 취소</button>
        <button className="primary-button compact-button" disabled={busy || !editing.content.trim()}>수정 저장</button>
      </div>
    </form> : <p className="prayer-request-body">{request.content}</p>}
    <div className="prayer-follow-up-actions">
      {!editing && <button type="button" className="text-button" disabled={busy} onClick={() => { setEditing({ content: request.content, version: request.version }); setError(""); setMessage(""); }}>수정</button>}
      {request.status !== "completed" && <button type="button" className="text-button" disabled={busy || !!editing} onClick={() => {
        if (window.confirm("이 기도요청을 완료로 표시할까요? 관리자에게도 완료 상태가 표시됩니다.")) void update({ complete: true });
      }}>기도 완료</button>}
    </div>
    {message && <p role="status" className="success-text">{message}</p>}
    {error && <p role="alert" className="error-text">{error}</p>}
    <PrayerComments key={request.id} requestId={request.id} isOwner onRead={refresh} />
    </div>}
  </article>;
}

export function PrayerRequestWorkspace() {
  const [requests, setRequests] = useState<OwnPrayerRequest[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    async function load() {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const data = await fetchJson<{ requests: OwnPrayerRequest[]; hasMore: boolean }>("/api/prayer-requests?page=" + page, { cache: "no-store" });
        if (!cancelled) { setRequests(data.requests); setHasMore(data.hasMore); setError(""); }
      } catch { if (!cancelled) setError("내 기도요청을 불러오지 못했습니다. 목록 새로고침을 눌러주세요."); }
      finally { inFlight = false; if (!cancelled) setLoading(false); }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true; window.clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [page, revision]);

  return <>
    <PrayerRequestForm onSubmitted={() => { setPage(0); refresh(); }} />
    <section className="own-prayer-requests" aria-label="내 기도요청">
      <div className="section-heading"><h2>내 기도요청</h2><button type="button" className="text-button" onClick={refresh}>목록 새로고침</button></div>
      {error && <p className="error-text" role="alert">{error}</p>}
      {loading ? <p>기도요청을 불러오는 중입니다.</p> : requests.length === 0 ? <p className="card empty-state">접수한 기도요청이 없습니다.</p> :
        requests.map(request => <OwnRequestCard key={request.id} request={request} refresh={refresh} />)}
      {(page > 0 || hasMore) && <nav className="prayer-request-actions" aria-label="기도요청 목록 페이지">
        <button type="button" className="text-button" disabled={page === 0 || loading} onClick={() => { setLoading(true); setPage(value => value - 1); }}>이전</button>
        <span>{page + 1}페이지</span>
        <button type="button" className="text-button" disabled={!hasMore || loading} onClick={() => { setLoading(true); setPage(value => value + 1); }}>다음</button>
      </nav>}
    </section>
  </>;
}
