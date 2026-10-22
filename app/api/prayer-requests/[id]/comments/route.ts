import { z } from "zod";
import { boundedJson, json, prayerActor, prayerError, prayerId, sameOrigin } from "../../../../../src/features/prayer-requests/http";
import { addPrayerComment, editPrayerComment, listPrayerComments, markPrayerCommentsRead } from "../../../../../src/features/prayer-requests/service";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await prayerActor();
    const id = await prayerId(context);
    const raw = new URL(request.url).searchParams.get("before");
    const before = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional().safeParse(raw ?? undefined);
    if (!before.success) return json({ code: "INVALID_INPUT" }, 400);
    return json(await listPrayerComments(id, actor, before.data));
  } catch (error) { return prayerError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await prayerActor();
    sameOrigin(request);
    const id = await prayerId(context);
    const parsed = z.object({ content: z.string().trim().min(1).max(2000), clientId: z.string().uuid(), asAdmin: z.boolean().optional() }).strict().safeParse(await boundedJson(request));
    if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
    const commentId = await addPrayerComment(id, actor, parsed.data.content, parsed.data.clientId, parsed.data.asAdmin);
    return json({ status: "ok", id: commentId }, 201);
  } catch (error) { return prayerError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await prayerActor();
    sameOrigin(request);
    const id = await prayerId(context);
    const parsed = z.union([
      z.object({ throughCommentId: z.string().uuid(), asAdmin: z.boolean().optional() }).strict(),
      z.object({ commentId: z.string().uuid(), content: z.string().trim().min(1).max(2000), expectedVersion: z.number().int().positive() }).strict(),
    ]).safeParse(await boundedJson(request));
    if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
    if ("throughCommentId" in parsed.data) await markPrayerCommentsRead(id, actor, parsed.data.throughCommentId, parsed.data.asAdmin ?? false);
    else return json({ status: "ok", comment: await editPrayerComment(id, actor, parsed.data) });
    return json({ status: "ok" });
  } catch (error) { return prayerError(error); }
}
