import sharp from "sharp";
import { DomainError } from "../../lib/http";

export type NoticeImageUpload = { data: Buffer; width: number; height: number };

export async function normalizeNoticeImage(file: File): Promise<NoticeImageUpload> {
  if (file.size > 3 * 1024 * 1024) throw new DomainError("NOTICE_IMAGE_TOO_LARGE", 413);
  if (!file.size) throw new DomainError("INVALID_NOTICE_IMAGE", 400);
  try {
    const source = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000, failOn: "warning" });
    const metadata = await source.metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) > 1) {
      throw new DomainError("INVALID_NOTICE_IMAGE", 400);
    }
    // Re-encode only decoded pixels: discard EXIF/location and any appended content.
    const { data, info } = await source.rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    if (data.length > 2 * 1024 * 1024) throw new DomainError("NOTICE_IMAGE_TOO_LARGE", 413);
    return { data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("INVALID_NOTICE_IMAGE", 400);
  }
}
