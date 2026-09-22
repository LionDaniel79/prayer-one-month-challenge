import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "../components/auth/LogoutButton";
import { PrayerDashboardClient } from "../components/dashboard/PrayerDashboardClient";
import { getCurrentSessionUser } from "../src/features/auth/http-session";
import { getMemberDashboard } from "../src/features/checkins/service";

export default async function Home() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const dashboard = await getMemberDashboard(user.id);
  if (!dashboard) {
    return (
      <main className="shell">
        <header className="member-header">
          <div>
            <p className="eyebrow">기도운동 1달 도전</p>
            <h1>도전 준비 중입니다</h1>
            <p>{user.displayName} 님, 관리자가 시작일을 설정하면 달력이 열립니다.</p>
          </div>
          <div className="header-actions">
            <Link href="/profile">내 정보</Link>
            <LogoutButton />
          </div>
        </header>
        <section className="card empty-state">
          <strong>아직 활성화된 기도 도전이 없습니다.</strong>
          <p className="helper-text">잠시 후 다시 확인해 주세요.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <PrayerDashboardClient initial={dashboard} />
    </main>
  );
}
