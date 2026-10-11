"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
import type { PrayerComment, PrayerCommentPage } from "../../src/features/prayer-requests/types";

export function PrayerComments({ requestId, isOwner = false, onRead }: {
  requestId: string; isOwner?: boolean; onRead?: () => void;
}) {
  const [data, setData] = useState<PrayerCommentPage | null>(null);
  const loaded = useRef<PrayerCommentPage | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<{ id: string; content: string; version: number } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const pending = useRef<{ content: string; clientId: string } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const latest = useRef<HTMLLIElement>(null);
  const followLatest = useRef(true);
  const endpoint = "/api/prayer-requests/" + requestId + "/comments";

  useEffect(() => { loaded.current = data; }, [data]);

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    async function refresh() {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        let next = await fetchJson<PrayerCommentPage>(endpoint, { cache: "no-store" });
        const snapshot = loaded.current;
        // Refresh the history already loaded too: comments there may have been
        // edited in another tab. A disjoint newest window still starts afresh.
        if (snapshot && next.comments.some(comment => snapshot.comments.some(existing => existing.id === comment.id))) {
          const oldest = snapshot.comments[0]?.sequence;
          while (!cancelled && next.hasMore && next.comments[0]?.sequence > oldest) {
            const previous = await fetchJson<PrayerCommentPage>(endpoint + "?before=" + next.comments[0].sequence, { cache: "no-store" });
            if (!previous.comments.length) break;
            next = { comments: [...previous.comments, ...next.comments], hasMore: previous.hasMore };
          }
        }
        if (!cancelled) {
          setData(previous => {
            if (!previous) return next;
            // If the whole newest window changed, restart from it so older-page
            // navigation can recover every intervening comment.
            if (next.hasMore && !next.comments.some(comment => previous.comments.some(existing => existing.id === comment.id))) return next;
            const merged = new Map(previous.comments.map(comment => [comment.id, comment]));
            for (const comment of next.comments) {
              const existing = merged.get(comment.id);
              if (!existing || comment.version >= existing.version) merged.set(comment.id, comment);
            }
            const hadOlder = previous.comments[0]?.sequence < next.comments[0]?.sequence;
            return { comments: [...merged.values()].sort((a, b) => a.sequence - b.sequence), hasMore: hadOlder ? previous.hasMore : next.hasMore };
          });
        }
      } catch {
        if (!cancelled) setError("댓글을 불러오지 못했습니다. 새로고침해 주세요.");
      } finally { loading = false; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [endpoint, revision]);

  const lastCommentId = data?.comments.at(-1)?.id;
  useEffect(() => {
    if (list.current && followLatest.current) list.current.scrollTop = list.current.scrollHeight;
  }, [lastCommentId]);
  useEffect(() => {
    if (!isOwner || !lastCommentId || !latest.current) return;
    let cancelled = false;
    let acknowledged = false;
    let inFlight = false;
    let visible = false;
    async function acknowledge() {
      if (cancelled || acknowledged || inFlight || !visible || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        await fetchJson(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ throughCommentId: lastCommentId }) });
        if (!cancelled) { acknowledged = true; onRead?.(); }
      } catch { /* Keep the unread badge when the read acknowledgement fails. */ }
      finally { inFlight = false; }
    }
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) void acknowledge();
    });
    observer.observe(latest.current);
    const timer = window.setInterval(() => void acknowledge(), 15000);
    document.addEventListener("visibilitychange", acknowledge);
    window.addEventListener("focus", acknowledge);
    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", acknowledge);
      window.removeEventListener("focus", acknowledge);
    };
  }, [endpoint, isOwner, lastCommentId, onRead, revision]);

  async function older() {
    if (!data?.comments.length || olderBusy) return;
    const before = data.comments[0].sequence;
    setOlderBusy(true);
    try {
      const previous = await fetchJson<PrayerCommentPage>(endpoint + "?before=" + before, { cache: "no-store" });
      // A newer window may have replaced this one while the old page was loading.
      setData(current => current?.comments[0]?.sequence === before
        ? { comments: [...previous.comments, ...current.comments], hasMore: previous.hasMore }
        : current);
    } catch { setError("이전 댓글을 불러오지 못했습니다."); }
    finally { setOlderBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !content.trim()) return;
    setBusy(true); setError(""); setMessage("");
    if (!pending.current || pending.current.content !== content) pending.current = { content, clientId: crypto.randomUUID() };
    try {
      await fetchJson(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...pending.current, asAdmin: !isOwner }) });
      pending.current = null;
      setContent(""); setMessage("댓글을 등록했습니다."); setRevision(value => value + 1);
    } catch {
      setError("댓글 등록 결과를 확인하지 못했습니다. 내용을 유지했습니다. 다시 등록해도 같은 댓글이 중복되지 않습니다.");
    } finally { setBusy(false); }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || editBusy || !editing.content.trim()) return;
    setEditBusy(true); setError(""); setMessage("");
    try {
      const { comment: saved } = await fetchJson<{ comment: Pick<PrayerComment, "id" | "content" | "version" | "editedAt"> }>(endpoint, { method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ commentId: editing.id, content: editing.content, expectedVersion: editing.version }) });
      // An edited older comment may be outside the latest page fetched by polling.
      setData(previous => previous ? { ...previous, comments: previous.comments.map(comment => comment.id === saved.id ? { ...comment, ...saved } : comment) } : previous);
      setEditing(null); setMessage("댓글을 수정했습니다."); setRevision(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "PRAYER_COMMENT_CONFLICT"
        ? "다른 화면에서 댓글이 수정되었습니다. 작성 중인 내용을 복사한 뒤 취소하고 다시 수정해 주세요."
        : "댓글 수정 결과를 확인하지 못했습니다. 입력 내용을 유지했습니다. 다시 저장해 주세요.");
    } finally { setEditBusy(false); }
  }

  return <section className="prayer-comments" aria-label="기도요청 댓글">
    <div className="section-heading"><h3>댓글</h3><button type="button" className="text-button" onClick={() => { setError(""); setRevision(value => value + 1); }}>댓글 새로고침</button></div>
    {data?.hasMore && <button type="button" className="text-button" disabled={olderBusy} onClick={() => void older()}>이전 댓글 보기</button>}
    {!data ? <p className="helper-text">댓글을 불러오는 중입니다.</p> : data.comments.length === 0 ? <p className="helper-text">아직 댓글이 없습니다.</p> :
      <ol className="prayer-comment-list" ref={list} onScroll={() => {
        if (list.current) followLatest.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 80;
      }}>{data.comments.map(comment => <li key={comment.id} ref={comment.id === lastCommentId ? latest : undefined} className={comment.isOwn ? "is-own" : ""}>
        <div className="prayer-comment-meta"><strong>{comment.authorRole === "admin" ? "관리자" : comment.authorName}{comment.isOwn ? " (나)" : ""}</strong>
          <span><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time>{comment.editedAt && <small> · 수정됨</small>}</span>
        </div>
        {editing?.id === comment.id ? <form onSubmit={saveEdit}>
          <label>댓글 수정<textarea aria-label="댓글 수정 내용" value={editing.content} maxLength={2000} required disabled={editBusy} onChange={event => setEditing({ ...editing, content: event.target.value })} /></label>
          <div className="prayer-comment-edit-actions">
            <button type="button" className="text-button" disabled={editBusy} onClick={() => { setEditing(null); setError(""); }}>수정 취소</button>
            <button className="primary-button compact-button" disabled={editBusy || !editing.content.trim()}>{editBusy ? "저장 중…" : "댓글 수정 저장"}</button>
          </div>
        </form> : <>
          <p>{comment.content}</p>
          {comment.isOwn && <button type="button" className="text-button prayer-comment-edit-button" disabled={editBusy} onClick={() => {
            setEditing({ id: comment.id, content: comment.content, version: comment.version }); setError(""); setMessage("");
          }}>댓글 수정</button>}
        </>}
      </li>)}</ol>}
    <form onSubmit={submit}>
      <label>댓글 내용<textarea aria-label="댓글 내용" maxLength={2000} required value={content} disabled={busy} onChange={event => setContent(event.target.value)} placeholder="함께 나눌 말씀을 적어주세요." /></label>
      <div className="prayer-request-actions"><span className="helper-text">{content.length.toLocaleString()} / 2,000</span><button className="primary-button compact-button" disabled={busy || !content.trim()}>{busy ? "등록 중…" : "댓글 등록"}</button></div>
    </form>
    {message && <p className="success-text" role="status">{message}</p>}
    {error && <p className="error-text" role="alert">{error}</p>}
  </section>;
}
