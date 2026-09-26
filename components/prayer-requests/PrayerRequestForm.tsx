"use client";

import { FormEvent, useState } from "react";

export function PrayerRequestForm() {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !content.trim()) return;

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/prayer-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.code ?? "PRAYER_REQUEST_FAILED");
      }

      setContent("");
      setMessage("기도요청이 전달되었습니다.");
    } catch {
      setError("기도요청을 전달하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card prayer-request-form" onSubmit={submit}>
      <p className="prayer-request-guidance">
        중보 기도가 필요한 내용을 자유롭게 적어주세요.
      </p>
      <label>
        <span className="sr-only">기도 요청 내용</span>
        <textarea
          required
          maxLength={10000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="기도가 필요한 내용을 입력해 주세요."
          aria-label="기도 요청 내용"
        />
      </label>
      <div className="prayer-request-actions">
        <span className="helper-text">{content.length.toLocaleString()} / 10,000</span>
        <button
          className="primary-button"
          type="submit"
          disabled={busy || !content.trim()}
        >
          {busy ? "전송 중…" : "전송"}
        </button>
      </div>
      {message && <p className="success-text" role="status">{message}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
    </form>
  );
}
