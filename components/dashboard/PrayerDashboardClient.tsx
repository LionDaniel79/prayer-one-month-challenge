"use client";

import { useRef, useState } from "react";
import type { MemberDashboard } from "../../src/lib/types";
import {
  optimisticToggleDashboard,
  reconcileCheckinState,
  type CheckinState,
} from "../../src/features/checkins/optimistic";
import { PrayerCalendar } from "../calendar/PrayerCalendar";
import { ProgressCard } from "./ProgressCard";

export function PrayerDashboardClient({ initial }: { initial: MemberDashboard }) {
  const [dashboard, setDashboard] = useState(initial);
  const dashboardRef = useRef(initial);
  const [pendingDates, setPendingDates] = useState<Set<string>>(new Set());
  const pendingDatesRef = useRef<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  function updateDashboard(
    reducer: (current: MemberDashboard) => MemberDashboard,
  ) {
    setDashboard((current) => {
      const next = reducer(current);
      dashboardRef.current = next;
      return next;
    });
  }

  function addPending(prayerDate: string) {
    pendingDatesRef.current = new Set(pendingDatesRef.current).add(prayerDate);
    setPendingDates((current) => new Set(current).add(prayerDate));
  }

  function removePending(prayerDate: string) {
    const nextRef = new Set(pendingDatesRef.current);
    nextRef.delete(prayerDate);
    pendingDatesRef.current = nextRef;
    setPendingDates((current) => {
      const next = new Set(current);
      next.delete(prayerDate);
      return next;
    });
  }

  async function toggle(prayerDate: string) {
    if (pendingDatesRef.current.has(prayerDate)) return;

    const previouslyChecked =
      dashboardRef.current.completedDates.includes(prayerDate);

    addPending(prayerDate);
    setMessage("");
    updateDashboard((current) =>
      optimisticToggleDashboard(current, prayerDate),
    );

    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prayerDate }),
      });
      const body = await response.json().catch(() => ({}));
      const state = body.state as CheckinState | undefined;

      if (!response.ok || (state !== "checked" && state !== "unchecked")) {
        updateDashboard((current) =>
          reconcileCheckinState(
            current,
            prayerDate,
            previouslyChecked ? "checked" : "unchecked",
          ),
        );
        setMessage("저장하지 못했습니다. 해당 날짜를 다시 눌러 주세요.");
        return;
      }

      updateDashboard((current) =>
        reconcileCheckinState(current, prayerDate, state),
      );
    } catch {
      updateDashboard((current) =>
        reconcileCheckinState(
          current,
          prayerDate,
          previouslyChecked ? "checked" : "unchecked",
        ),
      );
      setMessage("저장하지 못했습니다. 해당 날짜를 다시 눌러 주세요.");
    } finally {
      removePending(prayerDate);
    }
  }

  return (
    <>
      <section className="feature-heading">
        <p className="eyebrow">{dashboard.user.samLabel ?? "샘 미지정"}</p>
        <h2>{dashboard.challenge.title}</h2>
        <p>
          <strong>{dashboard.user.displayName}</strong>
          {dashboard.user.position ? ` · ${dashboard.user.position}` : ""} 님의 기도 기록
        </p>
      </section>
      <ProgressCard dashboard={dashboard} />
      {message && <p className="error-text" role="alert">{message}</p>}
      <PrayerCalendar
        dashboard={dashboard}
        onToggle={toggle}
        pendingDates={pendingDates}
      />
    </>
  );
}
