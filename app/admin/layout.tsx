import { redirect } from "next/navigation";
import { AdminShell } from "../../components/admin/AdminShell";
import { requireAdmin } from "../../src/features/admin/service";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  try {
    requireAdmin(user);
  } catch {
    redirect("/");
  }

  return <AdminShell displayName={user.displayName}>{children}</AdminShell>;
}
