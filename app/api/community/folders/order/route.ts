import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/src/features/auth/http-session";
import { reorderFolders } from "@/src/features/community/folders";
import { assertSameOrigin, readJson } from "@/src/features/community/http";
import { CommunityError } from "@/src/features/community/policy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store"};
export async function PATCH(request:Request) {
  try {
    const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
    assertSameOrigin(request);await reorderFolders(user,await readJson(request));
    return NextResponse.json({ok:true},{headers});
  }catch(error){
    if(error instanceof CommunityError)return NextResponse.json({code:error.code},{status:error.status,headers});
    console.error("COMMUNITY_ORDER_FAILED",error instanceof Error?error.name:"UnknownError");
    return NextResponse.json({code:"COMMUNITY_UNAVAILABLE"},{status:500,headers});
  }
}
