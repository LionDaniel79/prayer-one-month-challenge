"use client";
import { useEffect, useState } from "react";
import { api, localDateTime, message, methodLabel, type Summary } from "./client";
export function ReportHistory({ admin = false, refresh, onView }: { admin?: boolean; refresh: number; onView: (id: string) => void }) {
  const [page, setPage] = useState(1); const [data, setData] = useState<{ reports: Summary[]; total: number } | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    void api<{ reports: Summary[]; total: number }>(`/api/${admin ? "admin/" : ""}pastoral/reports?page=${page}`, { cache: "no-store", signal: c.signal }).then(value => { if (!c.signal.aborted) { setData(value); setError(""); } }).catch(e => { if (!c.signal.aborted) setError(message(e)); });
    return () => c.abort();
  }, [admin, page, refresh]);
  return <section className="card pastoral-history"><h2>{admin ? "전체 제출 내역" : "내가 제출한 목양지"}</h2>{error && <p className="error-text" role="alert">{error}</p>}{!data && !error && <p role="status">불러오는 중입니다.</p>}{data && <>
    {!data.reports.length && <p className="helper-text">제출된 목양지가 없습니다.</p>}
    <div className="pastoral-report-list">{data.reports.map(report => <article key={report.id}><div><strong>{report.samName}샘 · {report.leaderName}</strong><p>{report.periodLabel}</p><small>{methodLabel(report.method)} · 제출자 {report.submittedBy} · {localDateTime(report.submittedAt)}</small></div><div className="pastoral-row-actions"><button type="button" onClick={() => onView(report.id)} aria-label={`${report.samName} ${report.periodLabel} 목양지 보기`}>목양지 보기</button>{report.method === "form" && <a href={`/api/pastoral/reports/${report.id}/txt`} download>TXT 내려받기</a>}</div></article>)}</div>
    <div className="pastoral-toolbar"><button disabled={page <= 1} type="button" onClick={() => setPage(p => p - 1)}>이전</button><span>{page} / {Math.max(1, Math.ceil(data.total / 20))} 페이지 · {data.total}건</span><button disabled={page * 20 >= data.total} type="button" onClick={() => setPage(p => p + 1)}>다음</button></div>
  </>}</section>;
}
