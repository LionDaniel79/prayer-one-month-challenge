import { z } from "zod";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { getNoticeImage } from "../../../../../src/features/notices/service";

export async function GET(request: Request, context: { params: Promise<{id: string}> }) {
  const user = await getCurrentSessionUser();
  if (!user) return Response.json({code: "UNAUTHORIZED"}, {status: 401, headers: {"cache-control": "no-store"}});
  const {id} = await context.params;
  if (!z.uuid().safeParse(id).success) return Response.json({code: "NOTICE_NOT_FOUND"}, {status: 404});
  const image = await getNoticeImage(id, user.role === "admin");
  if (!image) return Response.json({code: "NOTICE_NOT_FOUND"}, {status: 404, headers: {"cache-control": "no-store"}});
  const etag = `"${image.version}"`;
  const headers = {
    "content-type": "image/webp",
    "cache-control": "private, no-cache",
    "x-content-type-options": "nosniff",
    "content-disposition": "inline; filename=notice.webp",
    "vary": "Cookie",
    etag,
  };
  // Authorize on every revalidation, including after a notice returns to draft.
  if (request.headers.get("if-none-match") === etag) return new Response(null, {status: 304, headers});
  return new Response(new Uint8Array(image.data), {headers});
}
