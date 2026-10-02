import { redirect } from "next/navigation";
import { getPrayerMenuSettings } from "../../src/features/prayer-menu/service";
import { MemberShell } from "../../components/app/MemberShell";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";

export default async function MemberLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  const { enabled } = await getPrayerMenuSettings();
  return <MemberShell user={user} initialPrayerMenuEnabled={enabled}>{children}</MemberShell>;
}
