import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { CommunityClient } from "../../../components/community/CommunityClient";
export default async function CommunityPage(){
  const user=await getCurrentSessionUser();if(!user)redirect("/login");
  return <Suspense fallback={<p role="status">불러오는 중입니다…</p>}><CommunityClient user={{id:user.id,role:user.role}}/></Suspense>;
}
