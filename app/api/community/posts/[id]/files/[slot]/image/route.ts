import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/src/features/auth/http-session";
import { photoPreview } from "@/src/features/community/images";
import { CommunityError, uuid } from "@/src/features/community/policy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"cache-control":"private, no-store","x-content-type-options":"nosniff"};
export async function GET(request:Request,context:{params:Promise<{id:string;slot:string}>}) {
  try {
    const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
    const {id,slot}=await context.params;if(!/^[01]$/.test(slot))throw new CommunityError("INVALID_INPUT");
    const data=await photoPreview(user,uuid(id),Number(slot),new URL(request.url).searchParams.get("sha"));
    return new Response(new Uint8Array(data),{headers:{...headers,"content-type":"image/webp","content-length":String(data.length),"content-security-policy":"default-src 'none'; sandbox"}});
  }catch(error){
    if(error instanceof CommunityError)return NextResponse.json({code:error.code},{status:error.status,headers});
    console.error("COMMUNITY_IMAGE_FAILED",error instanceof Error?error.name:"UnknownError");
    return NextResponse.json({code:"COMMUNITY_UNAVAILABLE"},{status:500,headers});
  }
}
