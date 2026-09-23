import { redirect } from "next/navigation";
import { AdminDashboard } from "../../components/admin/AdminDashboard";
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

  const [dashboard, roster] = await Promise.all([
    getAdminDashboard(),
    listRosterForAdmin(),
  ]);

  return (
    <main className="admin-shell">
      <AdminDashboard initial={dashboard} initialRoster={roster} />
    </main>
  );
}
