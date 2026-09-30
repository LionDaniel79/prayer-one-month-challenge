import { GoogleCalendarSettings } from "../../../components/admin/settings/GoogleCalendarSettings";
import { requireGoogleCalendarConfig } from "../../../src/lib/env";
import type { VisitStatus } from "../../../src/features/visits/types";
import { AdminVisitManagement } from "../../../components/admin/visits/AdminVisitManagement";
import { VisitAvailabilitySettings } from "../../../components/admin/settings/VisitAvailabilitySettings";

function parseStatus(value: unknown): "all" | VisitStatus {
  return value === "requested" ||
    value === "confirmed" ||
    value === "completed" ||
    value === "cancelled"
    ? value
    : "all";
}

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let googleConfigured = false;
  try { requireGoogleCalendarConfig(); googleConfigured = true; } catch { /* The warning contains no secret values. */ }
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;

  return (
    <main className="admin-shell">
      <AdminVisitManagement initialStatus={parseStatus(rawStatus)} />
      <VisitAvailabilitySettings />
      <div id="google-calendar" className="admin-settings-page"><GoogleCalendarSettings configured={googleConfigured} /></div>
    </main>
  );
}
