"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
import type { PrayerCommentPage } from "../../src/features/prayer-requests/types";

export function PrayerComments({ requestId, isOwner = false, onRead }: {
  requestId: string; isOwner?: boolean; onRead?: () => void;
}) {
  const [data, setData] = useState<PrayerCommentPage | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const pending = useRef<{ content: string; clientId: string } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const latest = useRef<HTMLLIElement>(null);
  const followLatest = useRef(true);
  const endpoint = "/api/prayer-requests/" + requestId + "/comments";

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    async function refresh() {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const next = await fetchJson<PrayerCommentPage>(endpoint, { cache: "no-store" });
        if (!cancelled) {
          setData(previous => {
            if (!previous) return next;
            // If the whole newest window changed, restart from it so older-page
            // navigation can recover every intervening comment.
            if (next.hasMore && !next.comments.some(comment => previous.comments.some(existing => existing.id === comment.id))) return next;
            const merged = new Map(previous.comments.map(comment => [comment.id, comment]));
            for (const comment of next.comments) merged.set(comment.id, comment);
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
      await fetchJson(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pending.current) });
      pending.current = null;
      setContent(""); setMessage("댓글을 등록했습니다."); setRevision(value => value + 1);
    } catch {
      setError("댓글 등록 결과를 확인하지 못했습니다. 내용을 유지했습니다. 다시 등록해도 같은 댓글이 중복되지 않습니다.");
    } finally { setBusy(false); }
  }

  return <section className="prayer-comments" aria-label="기도요청 댓글">
    <div className="section-heading"><h3>댓글</h3><button type="button" className="text-button" onClick={() => { setError(""); setRevision(value => value + 1); }}>댓글 새로고침</button></div>
    <p className="helper-text">신청자와 관리자만 볼 수 있습니다.</p>
    {data?.hasMore && <button type="button" className="text-button" disabled={olderBusy} onClick={() => void older()}>이전 댓글 보기</button>}
    {!data ? <p className="helper-text">댓글을 불러오는 중입니다.</p> : data.comments.length === 0 ? <p className="helper-text">아직 댓글이 없습니다.</p> :
      <ol className="prayer-comment-list" ref={list} onScroll={() => {
        if (list.current) followLatest.current = list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 80;
      }}>{data.comments.map(comment => <li key={comment.id} ref={comment.id === lastCommentId ? latest : undefined} className={comment.isOwn ? "is-own" : ""}>
        <div><strong>{comment.authorRole === "admin" ? "관리자" : comment.authorName}{comment.isOwn ? " (나)" : ""}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</time></div>
        <p>{comment.content}</p>
      </li>)}</ol>}
    <form onSubmit={submit}>
      <label>댓글 내용<textarea aria-label="댓글 내용" maxLength={2000} required value={content} disabled={busy} onChange={event => setContent(event.target.value)} placeholder="함께 나눌 말씀을 적어주세요." /></label>
      <div className="prayer-request-actions"><span className="helper-text">{content.length.toLocaleString()} / 2,000</span><button className="primary-button compact-button" disabled={busy || !content.trim()}>{busy ? "등록 중…" : "댓글 등록"}</button></div>
    </form>
    {message && <p className="success-text" role="status">{message}</p>}
    {error && <p className="error-text" role="alert">{error}</p>}
  </section>;
}
