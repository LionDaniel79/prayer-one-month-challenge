import { getDb, lockedPost, rows, sql } from "./db";
import { CommunityError, type Actor } from "./policy";
/** Explicit desired-state writes are safe to retry after response loss. */
export async function setPostLike(user: Actor, id: string, liked: boolean) {
  return getDb().transaction(async tx => {
    const post = await lockedPost(tx, id);
    if (!post.publishedAt) throw new CommunityError("POST_NOT_FOUND", 404);
    if (liked) {
      await tx.execute(sql`insert into prayer_app.community_post_likes(post_id,user_id) values(${id},${user.id}) on conflict(post_id,user_id) do nothing`);
    } else {
      await tx.execute(sql`delete from prayer_app.community_post_likes where post_id=${id} and user_id=${user.id}`);
    }
    const [{ likeCount }] = await rows<{ likeCount: number }>(tx, sql`select count(*)::int as "likeCount" from prayer_app.community_post_likes where post_id=${id}`);
    return { liked, likeCount };
  });
}
