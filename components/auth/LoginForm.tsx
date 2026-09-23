"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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
        body: JSON.stringify({ name, phone }),
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
            : "등록된 명단과 일치하지 않습니다. 이름과 전화번호를 확인해 주세요."),
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
        <span>전화번호 (비밀번호)</span>
        <input
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="01012345678"
        />
      </label>
      {message && <p className="error-text" role="alert">{message}</p>}
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "확인 중…" : "로그인"}
      </button>
      <p className="helper-text">
        등록된 공동체 명단의 이름과 전화번호가 일치해야 로그인할 수 있습니다.
      </p>
    </form>
  );
}
