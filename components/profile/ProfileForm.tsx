"use client";

import { FormEvent, useState } from "react";
import type { ProfileData } from "../../src/lib/types";

export function ProfileForm({ initial }: { initial: ProfileData }) {
  const [passwordMode, setPasswordMode] = useState(initial.passwordMode);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!password) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.code ?? "PASSWORD_UPDATE_FAILED");
      }
      setPassword("");
      setPasswordMode("custom");
      setMessage("비밀번호를 변경했습니다.");
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "PASSWORD_UPDATE_FAILED";
      setMessage(
        code === "PASSWORD_CONFLICT_SAME_NAME"
          ? "같은 이름의 다른 교인과 비밀번호가 겹칩니다. 다른 비밀번호를 사용해 주세요."
          : "비밀번호를 변경하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <dl className="profile-summary">
        <div><dt>이름</dt><dd>{initial.displayName}</dd></div>
        <div><dt>직분</dt><dd>{initial.position ?? "미지정"}</dd></div>
        <div><dt>샘</dt><dd>{initial.samLabel ?? "미지정"}</dd></div>
        <div>
          <dt>비밀번호</dt>
          <dd>
            {passwordMode === "initial"
              ? "초기 비밀번호(전화번호) 사용 중"
              : "변경한 비밀번호 사용 중"}
          </dd>
        </div>
      </dl>

      <form className="profile-password-form" onSubmit={changePassword}>
        <label>
          <span>새 비밀번호</span>
          <input
            required
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="새 비밀번호를 입력하세요"
          />
        </label>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "변경 중…" : "비밀번호 변경"}
        </button>
      </form>

      {message && <p className="helper-text" role="status">{message}</p>}
      <p className="helper-text">
        이름·직분·샘 정보 수정은 관리자에게 요청해 주세요.
      </p>
    </section>
  );
}
