import { redirect } from "next/navigation";
import { AdminDashboardLoader } from "../../components/admin/AdminDashboardLoader";
import { requireAdmin } from "../../src/features/admin/service";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";

export default async function AdminPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  try {
    requireAdmin(user);
  } catch {
    redirect("/");
  }

  return (
    <main className="admin-shell">
      <AdminDashboardLoader />
    </main>
  );
}
