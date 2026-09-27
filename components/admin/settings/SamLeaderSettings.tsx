"use client";

import { fetchJson } from "../../../src/lib/fetch-json";
import { useEffect, useState, type FormEvent } from "react";
import type { AdminSamLeader } from "../../../src/features/sams/admin-service";

async function readJson(url: string, init?: RequestInit) {
  return fetchJson<{ rows?: AdminSamLeader[]; summary: { imported: number } }>(url, { cache: "no-store", ...init });
}

function errorCopy(code: string): string {
  const messages: Record<string, string> = {
    SAM_LEADER_FILE_TYPE: ".xls 또는 .xlsx 파일을 선택해 주세요.",
    SAM_LEADER_FILE_TOO_LARGE: "비어 있지 않은 2MB 이하의 파일을 선택해 주세요.",
    SAM_LEADER_FILE_REQUIRED: "샘 리더 파일을 선택해 주세요.",
    SAM_LEADER_FILE_INVALID: "엑셀 파일을 읽을 수 없습니다. 파일을 확인해 주세요.",
    SAM_LEADER_HEADERS_MISSING: "샘과 샘리더 열이 있는 파일을 선택해 주세요.",
    SAM_LEADER_ROW_INVALID: "모든 행의 샘 이름과 리더 이름을 확인해 주세요.",
    SAM_LEADER_FILE_EMPTY: "파일에 가져올 샘 리더 정보가 없습니다.",
    SAM_LEADER_DUPLICATE: "같은 샘이 중복되어 있습니다. 샘 이름을 확인해 주세요.",
    INVALID_INPUT: "샘과 리더 이름을 확인해 주세요.",
  };
  return messages[code] ?? "샘 리더 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export function SamLeaderSettings() {
  const [rows, setRows] = useState<AdminSamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<AdminSamLeader | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readJson("/api/admin/sams")
      .then((body) => { if (!cancelled) setRows(body.rows ?? []); })
      .catch((cause) => { if (!cancelled) setError(errorCopy(cause instanceof Error ? cause.message : "")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function refresh() {
    const body = await readJson("/api/admin/sams");
    setRows(body.rows ?? []);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = await readJson("/api/admin/sams/import", { method: "POST", body: new FormData(form) });
      await refresh();
      setEditing(null);
      setMessage(`${body.summary.imported}개 샘의 리더 정보를 가져왔습니다.`);
      form.reset();
    } catch (cause) {
      setError(errorCopy(cause instanceof Error ? cause.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await readJson("/api/admin/sams", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          leaderName: String(data.get("leaderName") ?? ""),
          isActive: data.get("isActive") === "on",
        }),
      });
      await refresh();
      setEditing(null);
      setMessage("샘 리더 정보를 저장했습니다.");
      form.reset();
    } catch (cause) {
      setError(errorCopy(cause instanceof Error ? cause.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card admin-section" aria-labelledby="sam-leader-heading">
      <h2 id="sam-leader-heading">샘 리더 관리</h2>
      <p className="helper-text">샘별 리더를 등록하면 심방 일정에 표시됩니다. 회원 명단과 별도로 관리합니다.</p>
      {error && <p className="error-text" role="alert">{error}</p>}
      {message && <p className="success-text" role="status">{message}</p>}
      <form className="roster-import-form" onSubmit={upload}>
        <div>
          <strong>샘 리더 파일 가져오기</strong>
          <p className="helper-text">마을 · 마을장 · 샘 · 샘리더 열의 엑셀 파일을 가져옵니다. 직분은 제외하고 이름을 저장합니다.</p>
        </div>
        <input name="file" type="file" accept=".xls,.xlsx" aria-label="샘 리더 엑셀 파일" required disabled={busy} />
        <button type="submit" className="text-button" disabled={busy || loading}>가져오기</button>
      </form>

      <details>
        <summary>등록된 샘 리더 {rows.length}개 확인</summary>
        {loading ? <p className="helper-text">불러오는 중...</p> : rows.length === 0 ? <p className="helper-text">등록된 샘 리더가 없습니다.</p> : (
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <strong>{row.name}샘</strong> · {row.leaderName}{row.isActive ? "" : " · 비활성"}{" "}
                <button type="button" className="text-button" disabled={busy} onClick={() => setEditing(row)} aria-label={`${row.name}샘 리더 수정`}>수정</button>
              </li>
            ))}
          </ul>
        )}
      </details>

      <form className="admin-form" key={editing?.id ?? "new"} onSubmit={save}>
        <h3>{editing ? `${editing.name}샘 리더 수정` : "샘 리더 추가"}</h3>
        <label>샘<input name="name" placeholder="예: 1-2" defaultValue={editing?.name ?? ""} readOnly={Boolean(editing)} maxLength={100} required disabled={busy} /></label>
        <label>리더 이름<input name="leaderName" defaultValue={editing?.leaderName ?? ""} maxLength={120} required disabled={busy} /></label>
        <label className="checkbox-row"><input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} disabled={busy} /> 리더 정보 사용</label>
        <div className="header-actions">
          <button type="submit" className="primary-button compact-button" disabled={busy || loading}>{busy ? "저장 중..." : "저장"}</button>
          {editing && <button type="button" className="text-button" disabled={busy} onClick={() => setEditing(null)}>취소</button>}
        </div>
      </form>
    </section>
  );
}
