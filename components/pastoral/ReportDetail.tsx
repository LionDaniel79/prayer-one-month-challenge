"use client";
import { useEffect, useState } from "react";
import { CHUNK_LIMIT, photoName, type Attachment } from "../../src/features/pastoral/policy";
import { api, localDateTime, message, methodLabel, type ReportView } from "./client";
function DownloadFile({ reportId, file, slot }: { reportId: string; file: Attachment; slot: number }) {
  const [progress, setProgress] = useState<number | null>(null); const [error, setError] = useState("");
  async function download() {
    setError(""); setProgress(0);
    try {
      const chunks: ArrayBuffer[] = []; const count = Math.ceil(file.size / CHUNK_LIMIT);
      for (let i = 0; i < count; i++) {
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000);
        try {
          const response = await fetch(`/api/pastoral/reports/${reportId}/files/${slot}/chunks/${i}`, { cache: "no-store", signal: controller.signal });
          if (!response.ok) throw new Error((await response.json().catch(() => ({}))).code ?? "FILE_INTEGRITY_FAILED");
          const bytes = await response.arrayBuffer(); if (bytes.byteLength !== Math.min(CHUNK_LIMIT, file.size - i * CHUNK_LIMIT)) throw new Error("FILE_INTEGRITY_FAILED");
          chunks.push(bytes); setProgress(Math.round((i + 1) / count * 100));
        } finally { clearTimeout(timer); }
      }
      const blob = new Blob(chunks, { type: "application/octet-stream" });
      const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      const hash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, "0")).join("");
      if (blob.size !== file.size || hash !== file.sha256) throw new Error("FILE_INTEGRITY_FAILED");
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { setError(message(err)); } finally { setProgress(null); }
  }
  return <div className="pastoral-download"><button type="button" onClick={download} disabled={progress !== null}>{progress === null ? `${file.name} 내려받기` : `내려받는 중 ${progress}%`}</button><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>{error && <p role="alert" className="error-text">{error}</p>}</div>;
}
function Photo({ id, slot, name }: { id: string; slot: number; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <p className="helper-text">{name}: 이 사진은 미리보기를 지원하지 않습니다. 아래에서 원본을 내려받아 확인해 주세요.</p> : <img src={`/api/pastoral/reports/${id}/files/${slot}/image`} alt={`목양지 사진 ${slot + 1}`} loading="lazy" onError={() => setFailed(true)} className="pastoral-photo" />;
}
function Rows({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <section className="pastoral-section"><h3>{title}</h3>{!rows.length ? <p className="helper-text">기록 없음</p> : <div className="pastoral-table-wrap"><table className="pastoral-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell || "—"}</td>)}</tr>)}</tbody></table></div>}</section>;
}
export function ReportDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [report, setReport] = useState<ReportView | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void api<{ report: ReportView }>(`/api/pastoral/reports/${id}`, { cache: "no-store", signal: controller.signal }).then(r => { if (!controller.signal.aborted) setReport(r.report); }).catch(e => { if (!controller.signal.aborted) setError(message(e)); });
    return () => controller.abort();
  }, [id]);
  const f = report?.form;
  return <article className="pastoral-detail card" aria-label="제출 목양지 상세"><div className="pastoral-toolbar"><h2>샘목양지</h2><button type="button" onClick={onClose}>목록으로</button></div>{error && <p className="error-text" role="alert">{error}</p>}{!report && !error && <p role="status">목양지를 불러오는 중입니다.</p>}{report && <>
    <dl className="pastoral-meta"><div><dt>제출 대상</dt><dd>{report.periodLabel}</dd></div><div><dt>작성일</dt><dd>{report.writtenDate}</dd></div><div><dt>샘</dt><dd>{report.samName}</dd></div><div><dt>샘리더</dt><dd>{report.leaderName}</dd></div><div><dt>제출자</dt><dd>{report.submittedBy}</dd></div><div><dt>제출 방법</dt><dd>{methodLabel(report.method)}</dd></div><div><dt>제출일시</dt><dd>{report.submittedAt ? localDateTime(report.submittedAt) : "작성 중"}</dd></div></dl>
    {report.files.map((file, slot) => <div key={slot}>{photoName(file.name) && <Photo id={id} slot={slot} name={file.name} />}<DownloadFile reportId={id} file={file} slot={slot} /></div>)}
    {f && <div className="pastoral-written"><a className="pastoral-txt" href={`/api/pastoral/reports/${id}/txt`} download>입력 내용 TXT 내려받기</a>{f.noMeeting && <div className="pastoral-prewrap"><strong>이번 기간 샘모임 없음</strong><p>사유: {f.noMeetingReason}</p></div>}
      <Rows title="샘모임" headers={["일시", "장소", "참석자(가정)"]} rows={f.meetings.map(r => [r.when, r.place, r.attendees])} />
      <Rows title="나눔/기도제목 (예배·성경통독은혜·기도제목)" headers={["샘원", "나눔 / 기도제목"]} rows={f.sharing.map(r => [r.member, r.content])} />
      <Rows title="상담/심방 요청" headers={["샘원", "일시", "장소", "사유"]} rows={f.visits.map(r => [r.member, r.when, r.place, r.reason])} />
      <Rows title="샘소식 (결혼, 장례, 이사, 입원 등)" headers={["샘원", "소식"]} rows={f.news.map(r => [r.member, r.content])} />
      <section className="pastoral-section"><h3>샘리더 기도제목</h3><p className="pastoral-prewrap">{f.leaderPrayer || "기록 없음"}</p></section>
    </div>}
  </>}</article>;
}
