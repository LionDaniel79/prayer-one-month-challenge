import { redirect } from "next/navigation";
import { AdminDashboardNoSsr } from "../../components/admin/AdminDashboardNoSsr";
import { listRosterForAdmin } from "../../src/features/admin/roster-service";
import { getAdminDashboard, requireAdmin } from "../../src/features/admin/service";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";

export default async function AdminPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  try {
    requireAdmin(user);
  } catch {
    redirect("/");
  }

  const dashboard = await getAdminDashboard();
  const roster = await listRosterForAdmin();

  return (
    <main className="admin-shell">
      <AdminDashboardNoSsr initial={dashboard} initialRoster={roster} />
    </main>
  );
}
