import { redirect } from "next/navigation";
import { ProfileForm } from "../../../components/profile/ProfileForm";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { getProfile } from "../../../src/features/profile/service";

export default async function ProfilePage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  if (!profile) redirect("/login");

  return (
    <main className="shell">
      <h1>내 정보</h1>
      <ProfileForm initial={profile} />
    </main>
  );
}
