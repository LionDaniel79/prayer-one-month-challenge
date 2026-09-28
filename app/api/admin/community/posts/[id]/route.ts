import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/features/admin/service";
import { getCurrentSessionUser } from "@/src/features/auth/http-session";
import { deletePost } from "@/src/features/community/posts";
import { assertSameOrigin } from "@/src/features/community/http";
import { CommunityError, uuid } from "@/src/features/community/policy";
import { DomainError } from "@/src/lib/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store"};
// Management permits deletion, never rewriting another author's post.
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const user=await getCurrentSessionUser();requireAdmin(user);
    assertSameOrigin(request);await deletePost(user,uuid((await context.params).id),true);
    return NextResponse.json({ok:true},{headers});
  }catch(error){
    if(error instanceof CommunityError || error instanceof DomainError)return NextResponse.json({code:error.code},{status:error.status,headers});
    console.error("COMMUNITY_ADMIN_DELETE_FAILED",error instanceof Error?error.name:"UnknownError");
    return NextResponse.json({code:"COMMUNITY_UNAVAILABLE"},{status:500,headers});
  }
}
