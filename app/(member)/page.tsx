import { redirect } from "next/navigation";
import { PrayerDashboardNoSsr } from "../../components/dashboard/PrayerDashboardNoSsr";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";
import { getMemberDashboard } from "../../src/features/checkins/service";

export default async function Home() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const dashboard = await getMemberDashboard(user.id);
  if (!dashboard) {
    return (
      <main className="shell">
        <section className="card empty-state">
          <strong>아직 활성화된 기도 도전이 없습니다.</strong>
          <p className="helper-text">
            {user.displayName} 님, 관리자가 시작일을 설정하면 달력이 열립니다.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <PrayerDashboardNoSsr initial={dashboard} />
    </main>
  );
}
