import { getDb, lockedPost, rows, sql } from "./db";
import { assertEditor, CommunityError, type Actor } from "./policy";
export async function listComments(id:string,page:number) {
  const db=getDb();
  const post=await rows(db,sql`select id from prayer_app.community_posts where id=${id} and published_at is not null`);
  if(!post.length) throw new CommunityError("POST_NOT_FOUND",404);
  const [[{total}],items]=await Promise.all([
    rows<{total:number}>(db,sql`select count(*)::int as total from prayer_app.community_comments where post_id=${id}`),
    rows(db,sql`select c.id,c.body,c.author_user_id as "authorId",coalesce(u.display_name,'탈퇴한 성도') as "authorName",c.created_at as "createdAt",c.updated_at as "updatedAt" from prayer_app.community_comments c left join prayer_app.users u on u.id=c.author_user_id where c.post_id=${id} order by c.created_at,c.id limit 50 offset ${(page-1)*50}`)
  ]);
  return {items,total,page,pageSize:50};
}
export async function addComment(user:Actor,postId:string,id:string,body:string) {
  await getDb().transaction(async tx=>{
    const post=await lockedPost(tx,postId);
    if(!post.publishedAt) throw new CommunityError("POST_NOT_FOUND",404);
    await tx.execute(sql`insert into prayer_app.community_comments(id,post_id,author_user_id,body) values(${id},${postId},${user.id},${body}) on conflict(id) do nothing`);
    const [comment]=await rows<{authorId:string|null;postId:string;body:string}>(tx,sql`select author_user_id as "authorId",post_id as "postId",body from prayer_app.community_comments where id=${id}`);
    if(!comment || comment.authorId!==user.id || comment.postId!==postId || comment.body!==body) throw new CommunityError("COMMENT_CONFLICT",409);
  });
  return {id};
}
export async function changeComment(user:Actor,id:string,body:string|null) {
  await getDb().transaction(async tx=>{
    const [comment]=await rows<{authorId:string|null}>(tx,sql`select author_user_id as "authorId" from prayer_app.community_comments where id=${id} for update`);
    if(!comment) throw new CommunityError("COMMENT_NOT_FOUND",404);
    assertEditor(user,comment.authorId);
    if(body===null) await tx.execute(sql`delete from prayer_app.community_comments where id=${id}`);
    else await tx.execute(sql`update prayer_app.community_comments set body=${body},updated_at=now() where id=${id}`);
  });
}
