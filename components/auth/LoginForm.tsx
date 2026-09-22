"use client";

import { FormEvent, useState } from "react";
import { SamRegistration } from "./SamRegistration";

export function LoginForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [registering, setRegistering] = useState(false);
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
        window.location.assign("/");
        return;
      }
      if (response.status === 404 && body.code === "REGISTRATION_REQUIRED") {
        setRegistering(true);
        return;
      }
      setMessage(
        body.message ??
          (response.status === 429
            ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "입력한 정보를 확인해 주세요."),
      );
    } finally {
      setBusy(false);
    }
  }

  if (registering) {
    return <SamRegistration name={name} phone={phone} onBack={() => setRegistering(false)} />;
  }

  return (
    <form className="card auth-card" onSubmit={submit}>
      <label>
        <span>이름 (아이디)</span>
        <input required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 입력하세요" />
      </label>
      <label>
        <span>전화번호 (비밀번호)</span>
        <input required type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01012345678" />
      </label>
      {message && <p className="error-text" role="alert">{message}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "확인 중…" : "로그인 / 시작하기"}</button>
      <p className="helper-text">처음 접속하는 경우 로그인 후 본인의 샘을 선택합니다.</p>
    </form>
  );
}
