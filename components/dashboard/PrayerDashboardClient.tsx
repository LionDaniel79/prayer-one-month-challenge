"use client";

import Link from "next/link";
import { useState } from "react";
import type { MemberDashboard } from "../../src/lib/types";
import { PrayerCalendar } from "../calendar/PrayerCalendar";
import { ProgressCard } from "./ProgressCard";

export function PrayerDashboardClient({ initial }: { initial: MemberDashboard }) {
  const [dashboard, setDashboard] = useState(initial);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function toggle(prayerDate: string) {
    setBusyDate(prayerDate);
    setMessage("");
    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prayerDate }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.dashboard) {
        setMessage("체크할 수 없는 날짜입니다. 화면을 새로고침해 주세요.");
        return;
      }
      setDashboard(body.dashboard);
    } finally {
      setBusyDate(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <>
      <header className="member-header">
        <div>
          <p className="eyebrow">{dashboard.user.samLabel ?? "샘 미지정"}</p>
          <h1>{dashboard.challenge.title}</h1>
          <p><strong>{dashboard.user.displayName}</strong>{dashboard.user.position ? ` · ${dashboard.user.position}` : ""} 님의 기도 기록</p>
        </div>
        <div className="header-actions">
          <Link href="/profile">내 정보</Link>
          <button type="button" className="text-button" onClick={logout}>로그아웃</button>
        </div>
      </header>
      <ProgressCard dashboard={dashboard} />
      {message && <p className="error-text" role="alert">{message}</p>}
      <PrayerCalendar dashboard={dashboard} onToggle={toggle} busyDate={busyDate} />
    </>
  );
}
