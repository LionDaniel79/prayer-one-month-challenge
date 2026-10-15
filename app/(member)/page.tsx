import { getPrayerMenuSettings } from "../../src/features/prayer-menu/service";
import { redirect } from "next/navigation";
import { PrayerDashboardNoSsr } from "../../components/dashboard/PrayerDashboardNoSsr";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";
import { getMemberDashboard } from "../../src/features/checkins/service";
import { InactiveActivity } from "../../components/dashboard/InactiveActivity";

export default async function Home() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  if (!(await getPrayerMenuSettings()).enabled) redirect("/notices");

  const dashboard = await getMemberDashboard(user.id);
  if (!dashboard) {
    return (
      <main className="shell">
        <InactiveActivity displayName={user.displayName} />
      </main>
    );
  }

  return (
    <main className="shell">
      <PrayerDashboardNoSsr initial={dashboard} />
    </main>
  );
}
