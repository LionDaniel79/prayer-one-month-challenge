import { AdminHubDashboardLoader } from "../../components/admin/AdminHubDashboardLoader";
import { EmailNotifications } from "../../components/admin/EmailNotifications";

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <AdminHubDashboardLoader />
      <EmailNotifications />
    </main>
  );
}
