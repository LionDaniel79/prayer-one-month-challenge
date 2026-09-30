import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { reportAccess } from "../../../src/features/pastoral/access";
import { PastoralPortal } from "../../../components/pastoral/PastoralPortal";
export const dynamic = "force-dynamic";
export default async function PastoralReportsPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  if (!(await reportAccess(user)).visible) redirect("/");
  return <PastoralPortal displayName={user.displayName} />;
}
