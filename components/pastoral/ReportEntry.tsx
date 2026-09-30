"use client";
import { useRef, useState } from "react";
import { ReportFormFields } from "./ReportFormFields";
import { CHUNK_LIMIT, FILE_LIMIT, parseSubmission, periodLabel, type Method, type ReportForm, type ReportRequest, type SamTarget, type Submission } from "../../src/features/pastoral/policy";
import { api, emptyForm, jsonBody, message, metadata } from "./client";
export function ReportEntry({ request, sam, today, displayName, onSubmitted }: { request: ReportRequest; sam: SamTarget; today: string; displayName: string; onSubmitted: (id: string) => void }) {
  const [method, setMethod] = useState<Method>("photo"); const [writtenDate, setWrittenDate] = useState(today);
  const [form, setForm] = useState<ReportForm>(emptyForm); const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const [locked, setLocked] = useState(false); const [error, setError] = useState(""); const [progress, setProgress] = useState("");
  const pending = useRef<{ input: Submission; files: File[]; stage: "upload" | "publish" } | null>(null);
  function addFiles(selected: FileList | null) {
    const next = [...files, ...Array.from(selected ?? [])];
    if (next.length > 2 || next.some(f => !f.size || f.size > FILE_LIMIT)) { setError("첨부는 최대 2개이며 파일당 6MB 이하만 가능합니다."); return; }
    setError(""); setFiles(next);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      if (!pending.current) {
        setProgress("입력 내용과 파일을 확인하고 있습니다.");
        const input = parseSubmission({ id: crypto.randomUUID(), requestId: request.id, samId: sam.id, method, writtenDate, form: method === "form" ? form : null, files: await metadata(method === "form" ? [] : files) });
        pending.current = { input, files: method === "form" ? [] : [...files], stage: "upload" }; setLocked(true);
      }
      const draft = pending.current;
      const result = await api<{ id: string; submitted: boolean }>("/api/pastoral/reports", jsonBody("POST", draft.input));
      if (!result.submitted) {
        if (draft.stage === "upload") {
          const total = draft.files.reduce((n, file) => n + Math.ceil(file.size / CHUNK_LIMIT), 0); let sent = 0;
          for (let slot = 0; slot < draft.files.length; slot++) {
            const file = draft.files[slot];
            for (let start = 0, index = 0; start < file.size; start += CHUNK_LIMIT, index++) {
              setProgress(`파일 전송 ${Math.round(sent / total * 100)}%`);
              await api(`/api/pastoral/reports/${draft.input.id}/files/${slot}/chunks/${index}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: await file.slice(start, start + CHUNK_LIMIT).arrayBuffer() });
              sent++;
            }
          }
          draft.stage = "publish";
        }
        setProgress("목양지를 최종 제출하고 있습니다.");
        await api(`/api/pastoral/reports/${draft.input.id}/publish`, jsonBody("POST"));
      }
      pending.current = null; setLocked(false); window.dispatchEvent(new Event("pastoral:changed")); onSubmitted(result.id);
    } catch (err) { setError(message(err)); } finally { setBusy(false); setProgress(""); }
  }
  async function unlockDraft() {
    if (!pending.current || busy) return; setBusy(true); setError("");
    try {
      await api(`/api/pastoral/reports/${pending.current.input.id}`, jsonBody("DELETE")); pending.current = null; setLocked(false);
    } catch (err) {
      if (err instanceof Error && err.message === "REPORT_NOT_FOUND") { pending.current = null; setLocked(false); }
      else if (err instanceof Error && err.message === "REPORT_FINALIZED") { const id = pending.current?.input.id; pending.current = null; setLocked(false); window.dispatchEvent(new Event("pastoral:changed")); if (id) onSubmitted(id); }
      else setError(message(err));
    } finally { setBusy(false); }
  }
  return <form className="pastoral-entry card" onSubmit={submit}><h2>목양지 작성</h2><p>{periodLabel(request)} · {sam.name}샘 · 제출자 {displayName}</p><p className="helper-text">사진·파일·직접 입력 중 한 가지만 제출하면 완료됩니다. 입력 항목은 비워 두어도 됩니다. 작성 중인 내용은 다른 회원에게 공개되지 않습니다.</p>
    <fieldset disabled={busy || locked}><legend>기본 정보와 제출 방법</legend><div className="pastoral-grid"><label>작성일<input type="date" value={writtenDate} onChange={e => setWrittenDate(e.target.value)} /></label><label>제출자<input value={displayName} readOnly /></label></div>
      <div className="pastoral-methods">{([["photo", "사진으로 제출"], ["file", "파일로 제출"], ["form", "칸에 입력"]] as const).map(([value, label]) => <label key={value}><input type="radio" name="pastoral-method" checked={method === value} onChange={() => { setMethod(value); setFiles([]); setError(""); }} />{label}</label>)}</div>
      {method !== "form" ? <div className="pastoral-files"><label>{method === "photo" ? "목양지 사진 선택" : "목양지 파일 선택"}<input type="file" multiple accept={method === "photo" ? "image/*" : ".pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,image/*"} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} /></label>{method === "photo" && <label>카메라로 촬영<input type="file" accept="image/*" capture="environment" onChange={e => { addFiles(e.target.files); e.target.value = ""; }} /></label>}<p className="helper-text">최대 2개 · 파일당 6MB. PDF·한글·Word·Excel·텍스트와 일반 사진 형식을 지원합니다.</p>{files.map((file, index) => <div className="pastoral-file-row" key={`${file.name}-${index}`}><span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span><button type="button" aria-label={`${file.name} 선택 해제`} onClick={() => setFiles(files.filter((_, i) => i !== index))}>제거</button></div>)}</div> : <ReportFormFields form={form} onChange={setForm} />}
    </fieldset>
    {error && <p className="error-text" role="alert">{error}</p>}{progress && <p role="status" aria-live="polite">{progress}</p>}
    {locked && !busy && <p className="helper-text">전송 결과를 다시 확인하거나 같은 내용으로 재시도할 수 있습니다. 내용을 바꾸려면 먼저 ‘입력 내용 다시 수정’을 누르세요.</p>}
    <div className="pastoral-toolbar"><button type="submit" className="primary-button" disabled={busy}>{busy ? "제출 중…" : locked ? "같은 내용으로 다시 시도" : "목양지 제출"}</button>{locked && <button type="button" onClick={unlockDraft} disabled={busy}>입력 내용 다시 수정</button>}</div>
    <p className="helper-text">제출 후에는 ‘내가 제출한 목양지’에서 열어 수정·삭제할 수 있습니다. 같은 달에 추가 제출도 가능합니다.</p>
  </form>;
}
