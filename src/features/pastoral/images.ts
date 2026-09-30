import sharp from "sharp";
import { ReportError, isRaster } from "./policy";
export const rasterSignature = isRaster;
export async function rasterPreview(data: Buffer): Promise<Buffer> {
  if (!rasterSignature(data)) throw new ReportError("UNSUPPORTED_IMAGE", 415);
  try {
    const image = sharp(data, { limitInputPixels: 64_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"].includes(metadata.format)) throw new Error("FORMAT");
    const output = await image.rotate().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    if (output.length > 3 * 1024 * 1024) throw new Error("SIZE");
    return output;
  } catch { throw new ReportError("UNSUPPORTED_IMAGE", 415); }
}
