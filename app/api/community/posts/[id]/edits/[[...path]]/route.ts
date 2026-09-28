import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/src/features/auth/http-session";
import { beginEdit, cancelEdit, commitEdit, uploadEditChunk } from "@/src/features/community/edits";
import { assertSameOrigin, readBytes, readJson } from "@/src/features/community/http";
import { CHUNK_BYTES, CommunityError, uuid } from "@/src/features/community/policy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"cache-control":"private, no-store","x-content-type-options":"nosniff"};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
type Context={params:Promise<{id:string;path?:string[]}>};
async function handle(request:Request,context:Context) {
  try {
    const user=await getCurrentSessionUser();if(!user)return json({code:"UNAUTHORIZED"},401);
    assertSameOrigin(request);
    const params=await context.params;const postId=uuid(params.id);const path=params.path??[];
    if(path.length===0 && request.method==="POST")return json(await beginEdit(user,postId,await readJson(request)),201);
    const id=uuid(path[0]);
    if(path.length===1 && request.method==="DELETE")return json(await cancelEdit(user,postId,id));
    if(path.length===2 && path[1]==="commit" && request.method==="POST")return json(await commitEdit(user,postId,id));
    if(path.length===5 && path[1]==="files" && path[3]==="chunks" && request.method==="PUT") {
      if(!/^[01]$/.test(path[2]) || !/^(?:[0-9]|1[01])$/.test(path[4]))throw new CommunityError("INVALID_CHUNK");
      await uploadEditChunk(user,postId,id,Number(path[2]),Number(path[4]),await readBytes(request,CHUNK_BYTES));return json({ok:true});
    }
    return json({code:"NOT_FOUND"},404);
  } catch(error) {
    if(error instanceof CommunityError)return json({code:error.code},error.status);
    console.error("COMMUNITY_EDIT_FAILED",error instanceof Error?error.name:"UnknownError");
    return json({code:"COMMUNITY_UNAVAILABLE"},500);
  }
}
export const POST=handle;
export const PUT=handle;
export const DELETE=handle;
