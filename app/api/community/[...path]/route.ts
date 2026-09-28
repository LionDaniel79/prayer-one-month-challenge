import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { CHUNK_BYTES, CommunityError, pageNumber, parseLikeInput, parseCommentBody, parsePostInput, record, text, uuid } from "../../../../src/features/community/policy";
import { assertSameOrigin, readBytes, readJson } from "../../../../src/features/community/http";
import { createFolder, deleteFolder, listFolders, renameFolder } from "../../../../src/features/community/folders";
import { deletePost, getPost, listDrafts, listPosts, movePost, publishPost, saveDraft, updatePost } from "../../../../src/features/community/posts";
import { downloadChunk, uploadChunk } from "../../../../src/features/community/files";
import { addComment, changeComment, listComments } from "../../../../src/features/community/comments";
import { setPostLike } from "../../../../src/features/community/likes";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
type Context={params:Promise<{path:string[]}>};
const headers={"cache-control":"private, no-store","x-content-type-options":"nosniff"};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
async function handle(request:Request,context:Context):Promise<Response> {
  try {
    const user=await getCurrentSessionUser();
    if(!user) return json({code:"UNAUTHORIZED"},401);
    const method=request.method;
    if(method!=="GET") assertSameOrigin(request);
    const {path}=await context.params;
    const [resource,key,action,slotKey,chunks,indexKey]=path;
    const url=new URL(request.url);
    if(resource==="drafts" && path.length===1 && method==="GET") return json({items:await listDrafts(user)});
    if(resource==="folders") {
      if(path.length===1 && method==="GET") return json({folders:await listFolders()});
      if(path.length===1 && method==="POST") {const input=record(await readJson(request));return json(await createFolder(user,input.name),201);}
      if(path.length===2 && method==="PATCH") {const input=record(await readJson(request));await renameFolder(user,uuid(key),input.name);return json({ok:true});}
      if(path.length===2 && method==="DELETE") {await deleteFolder(user,uuid(key));return json({ok:true});}
    }
    if(resource==="posts") {
      if(path.length===1 && method==="GET") {
        const query=url.searchParams.get("q")?.trim()??"";
        if(query.length>100) throw new CommunityError("INVALID_INPUT");
        return json(await listPosts(uuid(url.searchParams.get("folder")),pageNumber(url.searchParams.get("page")),query));
      }
      if(path.length===1 && method==="POST") return json(await saveDraft(user,parsePostInput(await readJson(request))),201);
      const id=uuid(key);
      if(path.length===2 && method==="GET") return json({post:await getPost(user,id)});
      if(path.length===2 && method==="PUT") {const input=record(await readJson(request));await updatePost(user,id,text(input.title,150),text(input.body,20000));return json({ok:true});}
      if(path.length===2 && method==="DELETE") {await deletePost(user,id);return json({ok:true});}
      if(path.length===3 && action==="like" && method==="PUT") return json(await setPostLike(user,id,parseLikeInput(await readJson(request))));
      if(path.length===3 && action==="publish" && method==="POST") {await publishPost(user,id);return json({id});}
      if(path.length===3 && action==="move" && method==="PATCH") {const input=record(await readJson(request));await movePost(user,id,uuid(input.folderId));return json({ok:true});}
      if(path.length===3 && action==="comments" && method==="GET") return json(await listComments(id,pageNumber(url.searchParams.get("page"))));
      if(path.length===3 && action==="comments" && method==="POST") {const input=record(await readJson(request));return json(await addComment(user,id,uuid(input.id),parseCommentBody(input.body)),201);}
      if(path.length===6 && action==="files" && chunks==="chunks") {
        if(!/^[01]$/.test(slotKey) || !/^(?:[0-9]|1[01])$/.test(indexKey)) throw new CommunityError("INVALID_CHUNK");
        const slot=Number(slotKey),index=Number(indexKey);
        if(method==="PUT") {const data=await readBytes(request,CHUNK_BYTES);await uploadChunk(user,id,slot,index,data);return json({ok:true});}
        if(method==="GET") {const data=await downloadChunk(user,id,slot,index);return new Response(new Uint8Array(data),{headers:{...headers,"content-type":"application/octet-stream","content-length":String(data.length)}});}
      }
    }
    if(resource==="comments" && path.length===2) {
      if(method==="PATCH") {const input=record(await readJson(request));await changeComment(user,uuid(key),parseCommentBody(input.body));return json({ok:true});}
      if(method==="DELETE") {await changeComment(user,uuid(key),null);return json({ok:true});}
    }
    return json({code:"NOT_FOUND"},404);
  } catch(error) {
    if(error instanceof CommunityError) return json({code:error.code},error.status);
    const dbError=error as {code?:string;cause?:{code?:string}};
    const code=dbError?.cause?.code??dbError?.code;
    if(code==="23505") return json({code:"ALREADY_EXISTS"},409);
    if(code==="23503") return json({code:"DATA_CHANGED"},409);
    console.error("COMMUNITY_REQUEST_FAILED",error instanceof Error?error.name:"UnknownError");
    return json({code:"COMMUNITY_UNAVAILABLE"},500);
  }
}
export const GET=handle;
export const POST=handle;
export const PUT=handle;
export const PATCH=handle;
export const DELETE=handle;
