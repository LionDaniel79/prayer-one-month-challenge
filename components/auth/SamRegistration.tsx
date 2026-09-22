"use client";

import { useEffect, useState } from "react";
import type { SamOption } from "../../src/lib/types";

export function SamRegistration({ name, phone, onBack }: { name: string; phone: string; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [sams, setSams] = useState<SamOption[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/sams?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = await response.json();
        setSams(body.sams ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setMessage("샘 목록을 불러오지 못했습니다.");
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  async function choose(sam: SamOption) {
    setBusy(sam.id);
    setMessage("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, samId: sam.id }),
      });
      if (response.ok) {
        window.location.assign("/");
        return;
      }
      const body = await response.json().catch(() => ({}));
      setMessage(body.code === "ACCOUNT_EXISTS" ? "이미 등록된 계정입니다. 다시 로그인해 주세요." : "등록할 수 없습니다. 관리자에게 문의해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card auth-card">
      <button className="text-button" type="button" onClick={onBack}>← 로그인으로</button>
      <h2>내 샘 선택</h2>
      <p className="helper-text">샘 이름 또는 샘리더 이름으로 검색하세요.</p>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예: 사랑샘 또는 홍길동" aria-label="샘 검색" />
      {message && <p className="error-text" role="alert">{message}</p>}
      <div className="sam-list">
        {sams.map((sam) => (
          <button key={sam.id} type="button" className="sam-option" disabled={busy !== null} onClick={() => choose(sam)}>
            <strong>{sam.name}</strong><span>샘리더 {sam.leaderName}</span>
          </button>
        ))}
        {!message && sams.length === 0 && <p className="helper-text">등록 가능한 샘이 없습니다. 관리자에게 문의해 주세요.</p>}
      </div>
    </section>
  );
}
