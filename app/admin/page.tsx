import { redirect } from "next/navigation";
import { AdminDashboard } from "../../components/admin/AdminDashboard";
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
  return (
    <main className="admin-shell">
      <AdminDashboard initial={dashboard} />
    </main>
  );
}
