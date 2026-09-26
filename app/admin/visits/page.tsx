import type { VisitStatus } from "../../../src/features/visits/types";
import { AdminVisitManagement } from "../../../components/admin/visits/AdminVisitManagement";

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
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;

  return (
    <main className="admin-shell">
      <AdminVisitManagement initialStatus={parseStatus(rawStatus)} />
    </main>
  );
}
