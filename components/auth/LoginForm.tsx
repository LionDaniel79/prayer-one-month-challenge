"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        router.replace("/");
        router.refresh();
        return;
      }

      setMessage(
        body.message ??
          (response.status === 429
            ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "등록된 이름과 비밀번호를 확인해 주세요."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={submit}>
      <label>
        <span>이름 (아이디)</span>
        <input
          required
          maxLength={80}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="이름을 입력하세요"
        />
      </label>
      <label>
        <span>비밀번호</span>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호를 입력하세요"
        />
      </label>
      {message && <p className="error-text" role="alert">{message}</p>}
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "확인 중…" : "로그인"}
      </button>
      <p className="helper-text">
        비밀번호를 변경하지 않은 경우 초기 비밀번호는 등록된 전화번호입니다.
      </p>
    </form>
  );
}
