"use client";

import { useEffect, useState } from "react";
import type { ProfileData, SamOption } from "../../src/lib/types";

export function ProfileForm({ initial }: { initial: ProfileData }) {
  const [profile, setProfile] = useState(initial);
  const [query, setQuery] = useState("");
  const [sams, setSams] = useState<SamOption[]>([]);
  const [message, setMessage] = useState("");

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

  async function changeSam(sam: SamOption) {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ samId: sam.id }),
    });
    if (!response.ok) {
      setMessage("샘을 변경하지 못했습니다.");
      return;
    }
    setProfile({ ...profile, samId: sam.id, samName: sam.name, samLeaderName: sam.leaderName });
    setMessage("샘 정보가 변경되었습니다.");
  }

  return (
    <section className="card">
      <dl className="profile-summary">
        <div><dt>이름</dt><dd>{profile.displayName}</dd></div>
        <div><dt>현재 샘</dt><dd>{profile.samName ?? "미지정"}</dd></div>
        {profile.samLeaderName && <div><dt>샘리더</dt><dd>{profile.samLeaderName}</dd></div>}
      </dl>
      <h2>샘 변경</h2>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="샘 이름 또는 샘리더 이름" aria-label="샘 검색" />
      {message && <p className="helper-text" role="status">{message}</p>}
      <div className="sam-list">
        {sams.map((sam) => (
          <button key={sam.id} type="button" className="sam-option" onClick={() => changeSam(sam)}>
            <strong>{sam.name}</strong><span>샘리더 {sam.leaderName}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
