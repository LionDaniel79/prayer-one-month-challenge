"use client";

import { FormEvent, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";

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
      await fetchJson("/api/prayer-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });

      setContent("");
      setMessage("기도요청이 전달되었습니다.");
    } catch (error) {
      setError(error instanceof Error && error.name === "TimeoutError"
        ? "응답이 지연되어 전송 결과를 확인하지 못했습니다. 입력 내용은 보존했습니다. 다시 보내기 전에 관리자에게 접수 여부를 확인해 주세요."
        : "기도요청을 전달하지 못했습니다. 잠시 후 다시 시도해 주세요.");
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
