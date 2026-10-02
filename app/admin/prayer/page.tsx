import { AdminPrayerManagementLoader } from "../../../components/admin/prayer/AdminPrayerManagementLoader";

import { PrayerMenuSettings } from "../../../components/admin/prayer/PrayerMenuSettings";

export default function AdminPrayerPage() {
  return (
    <main className="admin-shell">
      <AdminPrayerManagementLoader />
      <PrayerMenuSettings />
    </main>
  );
}
