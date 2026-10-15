import { redirect } from "next/navigation";
import { AdminShell } from "../../components/admin/AdminShell";
import { requireAdmin } from "../../src/features/admin/service";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";
import { getPrayerMenuSettings } from "../../src/features/prayer-menu/service";

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

  const setting = await getPrayerMenuSettings();
  return <AdminShell displayName={user.displayName} initialPrayerMenuSettings={setting}>{children}</AdminShell>;
}
