import { getDb, rows, sql } from "./db";
import { CommunityError, type Actor } from "./policy";

/** Cancel only an unpublished draft, atomically with publication and uploads. */
export async function discardDraft(user: Actor, id: string) {
  return getDb().transaction(async tx => {
    const [post] = await rows<{ authorId: string | null; publishedAt: string | null }>(
      tx,
      sql`select author_user_id as "authorId", published_at as "publishedAt" from prayer_app.community_posts where id=${id} for update`,
    );
    // A failed create or repeated cancellation has nothing left to discard.
    if (!post) return { id, published: false };
    if (post.authorId !== user.id) throw new CommunityError("FORBIDDEN", 403);
    // Never turn a draft-cleanup intent into a destructive published-post delete.
    if (post.publishedAt) return { id, published: true };
    await tx.execute(sql`delete from prayer_app.community_posts where id=${id}`);
    return { id, published: false };
  });
}
