import { redirect } from "next/navigation";
import { MemberShell } from "../../components/app/MemberShell";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";

export default async function MemberLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  return <MemberShell user={user}>{children}</MemberShell>;
}
