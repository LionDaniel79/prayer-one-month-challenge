import { z } from "zod";
import { DomainError } from "../../lib/http";
import { normalizeNoticeImage } from "./image";
import type { AdminNoticeInput } from "./types";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(50_000),
  status: z.enum(["draft", "published"]),
});
const MAX_REQUEST_BYTES = 3.5 * 1024 * 1024;

async function readBoundedBody(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) {
    throw new DomainError("NOTICE_IMAGE_TOO_LARGE", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("INVALID_INPUT", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new DomainError("NOTICE_IMAGE_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function parseNoticeRequest(request: Request): Promise<AdminNoticeInput> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new DomainError("FORBIDDEN", 403);
  const bytes = await readBoundedBody(request);
  const contentType = request.headers.get("content-type") ?? "";
  let fields: unknown;
  let file: File | undefined;
  let removeImage = false;
  try {
    if (contentType.startsWith("multipart/form-data")) {
      const form = await new Response(new Uint8Array(bytes), {headers: {"content-type": contentType}}).formData();
      fields = Object.fromEntries(["title", "body", "status"].map(key => [key, form.get(key)]));
      const images = form.getAll("image");
      if (images.length > 1 || (images[0] !== undefined && !(images[0] instanceof File))) throw new Error("invalid image field");
      file = images[0] as File | undefined;
      if (form.has("removeImage") && form.get("removeImage") !== "true") throw new Error("invalid removal");
      removeImage = form.get("removeImage") === "true";
      if (removeImage && file) throw new Error("ambiguous image change");
    } else if (contentType.startsWith("application/json")) {
      fields = JSON.parse(bytes.toString("utf8"));
    } else throw new Error("unsupported content type");
  } catch { throw new DomainError("INVALID_INPUT", 400); }
  const parsed = schema.safeParse(fields);
  if (!parsed.success) throw new DomainError("INVALID_INPUT", 400);
  const input: AdminNoticeInput = parsed.data;
  if (file) input.image = await normalizeNoticeImage(file);
  else if (removeImage) input.image = null;
  return input;
}
