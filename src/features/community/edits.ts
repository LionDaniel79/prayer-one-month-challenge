import { createHash } from "node:crypto";
import { getDb, lockedPost, rows, sql, type Executor } from "./db";
import { CommunityError, expectedChunkSize, type Actor, type FileInput } from "./policy";
import { assertAuthor, parseEditInput, type EditInput } from "./refinement-policy";
import type { FileRow } from "./posts";
type EditRow = {id:string;postId:string;authorId:string;baseVersion:number;title:string;body:string;keepSlots:number[];files:FileInput[];appliedAt:string|null};
type Chunk = {index:number;data:Buffer};
async function editRow(tx:Executor,id:string) {
  const [edit]=await rows<EditRow>(tx,sql`select id,post_id as "postId",author_user_id as "authorId",base_version as "baseVersion",title,body,keep_slots as "keepSlots",files,applied_at as "appliedAt" from prayer_app.community_post_edits where id=${id} for update`);
  return edit;
}
function sameInput(edit:EditRow,input:EditInput) {
  const manifest=(files:FileInput[])=>JSON.stringify(files.map(f=>[f.name,f.size,f.sha256]));
  return edit.baseVersion===input.baseVersion && edit.title===input.title && edit.body===input.body && edit.keepSlots.join()===input.keepSlots.join() && manifest(edit.files)===manifest(input.files);
}
function checkEdit(edit:EditRow|undefined,user:Actor,postId:string):asserts edit is EditRow {
  if(!edit)throw new CommunityError("EDIT_NOT_FOUND",404);
  if(edit.postId!==postId || edit.authorId!==user.id)throw new CommunityError("FORBIDDEN",403);
}
export async function beginEdit(user:Actor,postId:string,value:unknown) {
  return getDb().transaction(async tx=>{
    // Serialize the per-author staging quota. All edit paths lock post before edit.
    await tx.execute(sql`select id from prayer_app.users where id=${user.id} for update`);
    const post=await lockedPost(tx,postId);assertAuthor(user,post.authorId);
    const input=parseEditInput(value);
    // Bind an array literal made only from validated slots, not a SQL tuple.
    const keepSlots=`{${input.keepSlots.join(",")}}`;
    const existing=await editRow(tx,input.id);
    if(existing) {
      checkEdit(existing,user,postId);
      if(existing.appliedAt) {
        if(!sameInput(existing,input))throw new CommunityError("EDIT_ALREADY_APPLIED",409);
        return {id:input.id,applied:true};
      }
    }
    if(post.version!==input.baseVersion)throw new CommunityError("EDIT_CONFLICT",409);
    const current=await rows<FileRow>(tx,sql`select slot,name,size,sha256 from prayer_app.community_files where post_id=${postId}`);
    if(input.keepSlots.some(slot=>!current.some(file=>file.slot===slot)))throw new CommunityError("EDIT_CONFLICT",409);
    await tx.execute(sql`delete from prayer_app.community_post_edits where author_user_id=${user.id} and id<>${input.id} and ((applied_at is null and updated_at<now()-interval '24 hours') or applied_at<now()-interval '7 days')`);
    if(!existing) {
      const [{count}]=await rows<{count:number}>(tx,sql`select count(*)::int as count from prayer_app.community_post_edits where author_user_id=${user.id} and applied_at is null`);
      if(count>=3)throw new CommunityError("TOO_MANY_EDITS",429);
      await tx.execute(sql`insert into prayer_app.community_post_edits(id,post_id,author_user_id,base_version,title,body,keep_slots,files) values(${input.id},${postId},${user.id},${input.baseVersion},${input.title},${input.body},${keepSlots}::smallint[],${JSON.stringify(input.files)}::jsonb)`);
    } else {
      for(let slot=0;slot<existing.files.length;slot++) {
        const old=existing.files[slot],next=input.files[slot];
        if(!next || old.name!==next.name || old.size!==next.size || old.sha256!==next.sha256)await tx.execute(sql`delete from prayer_app.community_edit_chunks where edit_id=${input.id} and slot=${slot}`);
      }
      await tx.execute(sql`update prayer_app.community_post_edits set title=${input.title},body=${input.body},keep_slots=${keepSlots}::smallint[],files=${JSON.stringify(input.files)}::jsonb,updated_at=now() where id=${input.id}`);
    }
    return {id:input.id,applied:false};
  });
}
export async function uploadEditChunk(user:Actor,postId:string,id:string,slot:number,index:number,data:Buffer) {
  await getDb().transaction(async tx=>{
    const post=await lockedPost(tx,postId);assertAuthor(user,post.authorId);
    const edit=await editRow(tx,id);checkEdit(edit,user,postId);
    if(edit.appliedAt)throw new CommunityError("EDIT_ALREADY_APPLIED",409);
    if(post.version!==edit.baseVersion)throw new CommunityError("EDIT_CONFLICT",409);
    const file=edit.files[slot];
    if(!file || data.length!==expectedChunkSize(file.size,index))throw new CommunityError("INVALID_CHUNK");
    await tx.execute(sql`insert into prayer_app.community_edit_chunks(edit_id,slot,chunk_index,data) values(${id},${slot},${index},${data}) on conflict(edit_id,slot,chunk_index) do update set data=excluded.data`);
  });
}
function verify(file:FileInput,chunks:Chunk[]) {
  const hash=createHash("sha256");let size=0;
  for(let i=0;i<chunks.length;i++) {
    if(chunks[i].index!==i || chunks[i].data.length!==expectedChunkSize(file.size,i))throw new CommunityError("UPLOAD_INCOMPLETE",409);
    size+=chunks[i].data.length;hash.update(chunks[i].data);
  }
  if(size!==file.size)throw new CommunityError("UPLOAD_INCOMPLETE",409);
  if(hash.digest("hex")!==file.sha256)throw new CommunityError("FILE_INTEGRITY_FAILED",409);
}
export async function commitEdit(user:Actor,postId:string,id:string) {
  return getDb().transaction(async tx=>{
    const post=await lockedPost(tx,postId);assertAuthor(user,post.authorId);
    const edit=await editRow(tx,id);checkEdit(edit,user,postId);
    if(edit.appliedAt)return {id:postId};
    if(post.version!==edit.baseVersion)throw new CommunityError("EDIT_CONFLICT",409);
    const current=await rows<FileRow>(tx,sql`select slot,name,size,sha256 from prayer_app.community_files where post_id=${postId} order by slot`);
    const final:{file:FileInput;chunks:Chunk[]}[]=[];
    for(const slot of edit.keepSlots) {
      const file=current.find(file=>file.slot===slot);if(!file)throw new CommunityError("EDIT_CONFLICT",409);
      const chunks=await rows<Chunk>(tx,sql`select chunk_index as index,data from prayer_app.community_file_chunks where post_id=${postId} and slot=${slot} order by chunk_index`);
      verify(file,chunks);final.push({file,chunks});
    }
    for(let slot=0;slot<edit.files.length;slot++) {
      const file=edit.files[slot];
      const chunks=await rows<Chunk>(tx,sql`select chunk_index as index,data from prayer_app.community_edit_chunks where edit_id=${id} and slot=${slot} order by chunk_index`);
      verify(file,chunks);final.push({file,chunks});
    }
    if(final.length>2)throw new CommunityError("TOO_MANY_FILES");
    // Readers observe either complete old content or complete new content, never half an upload.
    await tx.execute(sql`delete from prayer_app.community_files where post_id=${postId}`);
    for(let slot=0;slot<final.length;slot++) {
      const {file,chunks}=final[slot];
      await tx.execute(sql`insert into prayer_app.community_files(post_id,slot,name,size,sha256) values(${postId},${slot},${file.name},${file.size},${file.sha256})`);
      for(const chunk of chunks)await tx.execute(sql`insert into prayer_app.community_file_chunks(post_id,slot,chunk_index,data) values(${postId},${slot},${chunk.index},${chunk.data})`);
    }
    await tx.execute(sql`update prayer_app.community_posts set title=${edit.title},body=${edit.body},updated_at=now(),version=version+1 where id=${postId}`);
    await tx.execute(sql`update prayer_app.community_post_edits set applied_at=now(),updated_at=now() where id=${id}`);
    await tx.execute(sql`delete from prayer_app.community_edit_chunks where edit_id=${id}`);
    return {id:postId};
  });
}
export async function cancelEdit(user:Actor,postId:string,id:string) {
  return getDb().transaction(async tx=>{
    const post=await lockedPost(tx,postId);assertAuthor(user,post.authorId);
    const edit=await editRow(tx,id);
    if(!edit)return {id:postId,applied:false};
    checkEdit(edit,user,postId);
    if(edit.appliedAt)return {id:postId,applied:true};
    await tx.execute(sql`delete from prayer_app.community_post_edits where id=${id}`);
    return {id:postId,applied:false};
  });
}
