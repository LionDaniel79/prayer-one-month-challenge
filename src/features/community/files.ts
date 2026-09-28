import { getDb, lockedPost, rows, sql } from "./db";
import { CommunityError, expectedChunkSize, type Actor } from "./policy";
export async function uploadChunk(user:Actor,id:string,slot:number,index:number,data:Buffer) {
  await getDb().transaction(async tx=>{
    const post=await lockedPost(tx,id);
    if(post.authorId!==user.id) throw new CommunityError("FORBIDDEN",403);
    if(post.publishedAt) throw new CommunityError("POST_ALREADY_PUBLISHED",409);
    const [file]=await rows<{size:number}>(tx,sql`select size from prayer_app.community_files where post_id=${id} and slot=${slot}`);
    if(!file) throw new CommunityError("FILE_NOT_FOUND",404);
    if(data.length!==expectedChunkSize(file.size,index)) throw new CommunityError("INVALID_CHUNK");
    // Same post lock as publication. Repeated PUTs cannot mutate published files.
    await tx.execute(sql`insert into prayer_app.community_file_chunks(post_id,slot,chunk_index,data) values(${id},${slot},${index},${data}) on conflict(post_id,slot,chunk_index) do update set data=excluded.data`);
  });
}
export async function downloadChunk(user:Actor,id:string,slot:number,index:number) {
  const [chunk]=await rows<{data:Buffer;size:number}>(getDb(),sql`select c.data,f.size from prayer_app.community_file_chunks c join prayer_app.community_files f on f.post_id=c.post_id and f.slot=c.slot join prayer_app.community_posts p on p.id=c.post_id where c.post_id=${id} and c.slot=${slot} and c.chunk_index=${index} and (p.published_at is not null or p.author_user_id=${user.id})`);
  if(!chunk) throw new CommunityError("FILE_NOT_FOUND",404);
  if(chunk.data.length!==expectedChunkSize(chunk.size,index)) throw new CommunityError("FILE_INTEGRITY_FAILED",409);
  return chunk.data;
}
