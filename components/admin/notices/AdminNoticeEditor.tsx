"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminNoticeRow, NoticeStatus } from "../../../src/features/notices/types";

async function saveNotice(
  notice: AdminNoticeRow | null,
  payload: { title: string; body: string; status: NoticeStatus },
  image: File | null,
  removeImage: boolean,
) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => form.set(key, value));
  if (image) form.set("image", image);
  else if (removeImage) form.set("removeImage", "true");
  const response = await fetch(
    notice ? "/api/admin/notices/" + notice.id : "/api/admin/notices",
    {
      method: notice ? "PATCH" : "POST",
      body: form,
      signal: AbortSignal.timeout(25_000),
    },
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 413) throw new Error("이미지 용량이 큽니다. 3MB 이하의 이미지를 선택해 주세요.");
    if (body.code === "INVALID_NOTICE_IMAGE") throw new Error("이미지를 읽을 수 없습니다. JPG·PNG·WebP 이미지로 다시 선택해 주세요.");
    throw new Error("공지 저장에 실패했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
  }
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
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [preview, setPreview] = useState(notice?.image?.url ?? "");
  const objectUrl = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  function changeImage(file: File | null) {
    if (file && (file.size > 3 * 1024 * 1024 || !file.size)) {
      setError("3MB 이하의 이미지를 선택해 주세요.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (file?.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("JPG·PNG·WebP 이미지를 선택해 주세요.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = file ? URL.createObjectURL(file) : "";
    setImage(file);
    setRemoveImage(!file);
    setPreview(objectUrl.current);
    setError("");
    if (!file && fileInput.current) fileInput.current.value = "";
  }

  async function submit(status: NoticeStatus) {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await saveNotice(notice, { title, body, status }, image, removeImage);
      if (!notice) { setTitle(""); setBody(""); changeImage(null); setBusy(false); }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "TimeoutError"
        ? "저장 결과를 확인하지 못했습니다. 공지 목록을 확인한 후 다시 시도해 주세요."
        : cause instanceof Error ? cause.message : "공지 저장에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <section className="card admin-notice-editor">
      <div className="section-heading">
        <div>
          <h2>{notice ? "공지 수정" : "새 공지"}</h2>
          <p className="helper-text">발행한 새 공지는 앱 안의 공지 알림으로 표시됩니다.</p>
        </div>
        {notice && (
          <button className="text-button" type="button" disabled={busy} onClick={onCancel}>새 글 작성</button>
        )}
      </div>

      <div className="admin-form">
        <label>
          제목
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            disabled={busy}
            placeholder="공지 제목"
          />
        </label>
        <div className="notice-image-editor">
          <label>
            이미지 첨부 (선택)
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
              onChange={event => { const file = event.target.files?.[0]; if (file) changeImage(file); }} />
          </label>
          <p className="helper-text">JPG·PNG·WebP 한 장, 최대 3MB. 이미지 아래 두 줄을 띄우고 내용이 표시됩니다.</p>
          {preview && <div className="notice-image-preview">
            {/* Authenticated and local blob URLs must bypass the public image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="첨부 이미지 미리보기" />
            <button type="button" className="text-button" disabled={busy} onClick={() => changeImage(null)}>이미지 삭제</button>
          </div>}
        </div>
        <label>
          내용
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={12}
            maxLength={50_000}
            disabled={busy}
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
          {busy ? "저장 중…" : "임시저장"}
        </button>
        <button
          className="primary-button compact-button"
          type="button"
          disabled={busy || !title.trim() || !body.trim()}
          onClick={() => void submit("published")}
        >
          {busy ? "저장 중…" : "발행"}
        </button>
      </div>
    </section>
  );
}
