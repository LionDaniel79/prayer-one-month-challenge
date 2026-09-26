import type { PrayerRequestStatus } from "../../../src/features/prayer-requests/types";
import { AdminPrayerRequestManagement } from "../../../components/admin/prayer-requests/AdminPrayerRequestManagement";

function parseStatus(value: unknown): "all" | PrayerRequestStatus {
  return value === "received" || value === "praying" || value === "completed"
    ? value
    : "all";
}

export default async function AdminPrayerRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <main className="admin-shell">
      <AdminPrayerRequestManagement
        initialStatus={parseStatus(rawStatus)}
        initialId={typeof rawId === "string" ? rawId : null}
      />
    </main>
  );
}
