import { PastoralAdmin } from "../../../components/pastoral/PastoralAdmin";
export const dynamic = "force-dynamic";
export default async function PastoralAdminPage({ searchParams }: { searchParams: Promise<{ id?: string; unreviewed?: string }> }) {
  const query = await searchParams;
  const id = typeof query.id === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(query.id) ? query.id : "";
  return <PastoralAdmin initialId={id} initialUnreviewed={query.unreviewed === "1"}/>;
}
