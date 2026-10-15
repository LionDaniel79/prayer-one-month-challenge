"use client";

import { usePrayerMenuSettings } from "../app/PrayerMenuProvider";

export function InactiveActivity({ displayName }: { displayName: string }) {
  const { name, description } = usePrayerMenuSettings();
  return <section className="card empty-state">
    <h2 className="activity-name">{name}</h2>
    {description && <p className="activity-description">{description}</p>}
    <strong>아직 활성화된 도전이 없습니다.</strong>
    <p className="helper-text">{displayName} 님, 관리자가 시작일을 설정하면 달력이 열립니다.</p>
  </section>;
}
