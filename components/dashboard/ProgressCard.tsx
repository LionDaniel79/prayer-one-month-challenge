import type { MemberDashboard } from "../../src/lib/types";

export function ProgressCard({ dashboard }: { dashboard: MemberDashboard }) {
  const percent = Math.round(dashboard.progress.rate * 100);
  return (
    <section className="progress-card card" aria-label="기도 진행률">
      <div>
        <p className="eyebrow">현재 달성률</p>
        <strong className="progress-percent">{percent}%</strong>
      </div>
      <div className="progress-copy">
        <strong>{dashboard.progress.completed} / {dashboard.progress.eligible}일 완료</strong>
        <span>{dashboard.challenge.startDate} ~ {dashboard.challenge.endDate}</span>
      </div>
    </section>
  );
}
