import { Suspense } from "react";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { requireAdmin } from "../../../src/features/admin/service";
import { CommunityClient } from "../../../components/community/CommunityClient";
export default async function AdminCommunityPage(){
  const user=await getCurrentSessionUser();requireAdmin(user);
  return <Suspense fallback={<p role="status">불러오는 중입니다…</p>}><CommunityClient user={{id:user.id,role:user.role}} admin/></Suspense>;
}
