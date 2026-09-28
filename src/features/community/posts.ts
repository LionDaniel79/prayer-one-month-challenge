import { createHash } from "node:crypto";
import { getDb, rows, sql, lockedPost, requireFolder, type PostRow } from "./db";
import { assertManager, CommunityError, expectedChunkSize, PAGE_SIZE, type Actor, type parsePostInput } from "./policy";
import { assertAuthor } from "./refinement-policy";
export type FileRow = {slot:number;name:string;size:number;sha256:string};
export async function saveDraft(user: Actor, input: ReturnType<typeof parsePostInput>) {
  return getDb().transaction(async tx => {
    await tx.execute(sql`select id from prayer_app.users where id=${user.id} for update`);
    await tx.execute(sql`delete from prayer_app.community_posts where published_at is null and created_at < now() - interval '24 hours'`);
    await requireFolder(tx,input.folderId);
    const [existing] = await rows<{authorId:string|null;publishedAt:string|null}>(tx,sql`select author_user_id as "authorId",published_at as "publishedAt" from prayer_app.community_posts where id=${input.id} for update`);
    if (existing && existing.authorId!==user.id) throw new CommunityError("FORBIDDEN",403);
    if (existing?.publishedAt) return {id:input.id,published:true};
    if (!existing) {
      const [{count}] = await rows<{count:number}>(tx,sql`select count(*)::int as count from prayer_app.community_posts where author_user_id=${user.id} and published_at is null`);
      if(count>=3) throw new CommunityError("TOO_MANY_DRAFTS",429);
      await tx.execute(sql`insert into prayer_app.community_posts(id,folder_id,author_user_id,title,body) values(${input.id},${input.folderId},${user.id},${input.title},${input.body})`);
    } else {
      await tx.execute(sql`update prayer_app.community_posts set folder_id=${input.folderId},title=${input.title},body=${input.body},updated_at=now(),version=version+1 where id=${input.id}`);
    }
    const old = await rows<FileRow>(tx,sql`select slot,name,size,sha256 from prayer_app.community_files where post_id=${input.id}`);
    for (const file of old) {
      const next=input.files[file.slot];
      if(!next || next.sha256!==file.sha256 || next.size!==file.size || next.name!==file.name) await tx.execute(sql`delete from prayer_app.community_files where post_id=${input.id} and slot=${file.slot}`);
    }
    for(let slot=0;slot<input.files.length;slot++) {
      const file=input.files[slot];
      await tx.execute(sql`insert into prayer_app.community_files(post_id,slot,name,size,sha256) values(${input.id},${slot},${file.name},${file.size},${file.sha256}) on conflict(post_id,slot) do nothing`);
    }
    return {id:input.id,published:false};
  });
}
export async function publishPost(user: Actor,id:string) {
  await getDb().transaction(async tx=>{
    const post=await lockedPost(tx,id); assertAuthor(user,post.authorId);
    if(post.publishedAt) return;
    const files=await rows<FileRow>(tx,sql`select slot,name,size,sha256 from prayer_app.community_files where post_id=${id} order by slot`);
    for(const file of files) {
      const chunks=await rows<{index:number;data:Buffer}>(tx,sql`select chunk_index as index,data from prayer_app.community_file_chunks where post_id=${id} and slot=${file.slot} order by chunk_index`);
      const hash=createHash("sha256"); let length=0;
      for(let i=0;i<chunks.length;i++) {
        const part=chunks[i];
        if(part.index!==i || part.data.length!==expectedChunkSize(file.size,i)) throw new CommunityError("UPLOAD_INCOMPLETE",409);
        length+=part.data.length; hash.update(part.data);
      }
      if(length!==file.size) throw new CommunityError("UPLOAD_INCOMPLETE",409);
      if(hash.digest("hex")!==file.sha256) throw new CommunityError("FILE_INTEGRITY_FAILED",409);
    }
    await tx.execute(sql`update prayer_app.community_posts set published_at=now(),updated_at=now(),version=version+1 where id=${id}`);
  });
}
export async function listPosts(folderId:string,page:number,query:string) {
  const db=getDb(); const pattern='%'+query.replace(/[\\%_]/g,'\\$&')+'%';
  const where=sql`p.folder_id=${folderId} and p.published_at is not null and (p.title ilike ${pattern} or p.body ilike ${pattern})`;
  const [[{total}],items]=await Promise.all([
    rows<{total:number}>(db,sql`select count(*)::int as total from prayer_app.community_posts p where ${where}`),
    rows(db,sql`select p.id,p.title,p.author_user_id as "authorId",coalesce(u.display_name,'탈퇴한 성도') as "authorName",p.published_at as "createdAt",(select count(*)::int from prayer_app.community_files f where f.post_id=p.id) as "fileCount",(select count(*)::int from prayer_app.community_comments c where c.post_id=p.id) as "commentCount",(select count(*)::int from prayer_app.community_post_likes l where l.post_id=p.id) as "likeCount" from prayer_app.community_posts p left join prayer_app.users u on u.id=p.author_user_id where ${where} order by p.published_at desc,p.id desc limit ${PAGE_SIZE} offset ${(page-1)*PAGE_SIZE}`)
  ]);
  return {items,total,page,pageSize:PAGE_SIZE};
}
export async function listDrafts(user:Actor) {
  return rows(getDb(),sql`select id,title,created_at as "createdAt" from prayer_app.community_posts where author_user_id=${user.id} and published_at is null order by created_at desc limit 3`);
}
export async function getPost(user:Actor,id:string) {
  // One transaction snapshot prevents pairing stale content with a newer version/files.
  return getDb().transaction(async tx => {
    const [post]=await rows<PostRow & {authorName:string;folderName:string}>(tx,sql`select p.id,p.folder_id as "folderId",p.title,p.body,p.author_user_id as "authorId",coalesce(u.display_name,'탈퇴한 성도') as "authorName",p.published_at as "publishedAt",p.created_at as "createdAt",p.updated_at as "updatedAt",p.version,f.name as "folderName" from prayer_app.community_posts p join prayer_app.community_folders f on f.id=p.folder_id left join prayer_app.users u on u.id=p.author_user_id where p.id=${id} and (p.published_at is not null or p.author_user_id=${user.id}) for share of p`);
    if(!post) throw new CommunityError("POST_NOT_FOUND",404);
    const files=await rows<FileRow>(tx,sql`select slot,name,size,sha256 from prayer_app.community_files where post_id=${id} order by slot`);
    const [{likeCount,liked}]=await rows<{likeCount:number;liked:boolean}>(tx,sql`select count(*)::int as "likeCount",coalesce(bool_or(user_id=${user.id}),false) as liked from prayer_app.community_post_likes where post_id=${id}`);
    return {...post,files,likeCount,liked};
  });
}
export async function updatePost(user:Actor,id:string,title:string,body:string) {
  await getDb().transaction(async tx=>{
    const post=await lockedPost(tx,id); assertAuthor(user,post.authorId);
    await tx.execute(sql`update prayer_app.community_posts set title=${title},body=${body},updated_at=now(),version=version+1 where id=${id}`);
  });
}
export async function movePost(user:Actor,id:string,folderId:string) {
  assertManager(user);
  await getDb().transaction(async tx=>{
    await requireFolder(tx,folderId); await lockedPost(tx,id);
    await tx.execute(sql`update prayer_app.community_posts set folder_id=${folderId},updated_at=now(),version=version+1 where id=${id}`);
  });
}
export async function deletePost(user:Actor,id:string,management=false) {
  if(management) assertManager(user);
  await getDb().transaction(async tx=>{
    const post=await lockedPost(tx,id); if(!management) assertAuthor(user,post.authorId);
    await tx.execute(sql`delete from prayer_app.community_posts where id=${id}`);
  });
}
