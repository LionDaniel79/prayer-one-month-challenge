"use client";

import { useState } from "react";
import type { AdminNoticeRow, NoticeStatus } from "../../../src/features/notices/types";

async function saveNotice(
  notice: AdminNoticeRow | null,
  payload: { title: string; body: string; status: NoticeStatus },
) {
  const response = await fetch(
    notice ? "/api/admin/notices/" + notice.id : "/api/admin/notices",
    {
      method: notice ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code ?? "NOTICE_SAVE_FAILED");
  return body;
}

export function AdminNoticeEditor({
  notice,
  onSaved,
  onCancel,
}: {
  notice: AdminNoticeRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [body, setBody] = useState(notice?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(status: NoticeStatus) {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveNotice(notice, { title, body, status });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "공지 저장에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <section className="card admin-notice-editor">
      <div className="section-heading">
        <div>
          <h2>{notice ? "공지 수정" : "새 공지"}</h2>
          <p className="helper-text">발행된 새 공지는 앱 안 알림과 허용된 기기의 Push로 전달됩니다.</p>
        </div>
        {notice && (
          <button className="text-button" type="button" onClick={onCancel}>새 글 작성</button>
        )}
      </div>

      <div className="admin-form">
        <label>
          제목
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            placeholder="공지 제목"
          />
        </label>
        <label>
          내용
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={12}
            placeholder="공지 내용을 입력하세요."
          />
        </label>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      <div className="admin-editor-actions">
        <button
          className="text-button"
          type="button"
          disabled={busy || !title.trim() || !body.trim()}
          onClick={() => void submit("draft")}
        >
          임시저장
        </button>
        <button
          className="primary-button compact-button"
          type="button"
          disabled={busy || !title.trim() || !body.trim()}
          onClick={() => void submit("published")}
        >
          발행
        </button>
      </div>
    </section>
  );
}
