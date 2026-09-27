import { AdminUserManagementLoader } from "../../../components/admin/users/AdminUserManagementLoader";
import { SamLeaderSettings } from "../../../components/admin/settings/SamLeaderSettings";

export default function AdminUsersPage() {
  return (
    <main className="admin-shell">
      <AdminUserManagementLoader />
      <SamLeaderSettings />
    </main>
  );
}
