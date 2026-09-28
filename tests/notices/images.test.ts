import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { normalizeNoticeImage } from "../../src/features/notices/image";
import { parseNoticeRequest } from "../../src/features/notices/input";

async function png() {
  return sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#4488cc" } }).withMetadata().png().toBuffer();
}

describe("notice image validation", () => {
  it("decodes, resizes and re-encodes real images without metadata", async () => {
    const original = await png();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const image = await normalizeNoticeImage(new File([new Uint8Array(original)], "poster.png"));
    const metadata = await sharp(image.data).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(2400);
    expect(metadata.height).toBe(1200);
    expect(metadata.exif).toBeUndefined();
    expect(image.width).toBe(2400);
    expect(image.height).toBe(1200);
  });
  it("rejects disguised text, SVG and broken images", async () => {
    for (const data of ["<script>alert(1)</script>", '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>', "\x89PNG\r\n"]) {
      await expect(normalizeNoticeImage(new File([data], "picture.png", {type: "image/png"})))
        .rejects.toMatchObject({code: "INVALID_NOTICE_IMAGE", status: 400});
    }
  });
  it("rejects empty and oversized files before decoding", async () => {
    await expect(normalizeNoticeImage(new File([], "empty.jpg"))).rejects.toMatchObject({code: "INVALID_NOTICE_IMAGE"});
    await expect(normalizeNoticeImage(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "big.jpg")))
      .rejects.toMatchObject({code: "NOTICE_IMAGE_TOO_LARGE", status: 413});
  });
});

describe("notice request parsing", () => {
  const fields = {title: " 공지 ", body: " 본문 ", status: "draft"};
  it("keeps existing images when old JSON clients only edit text", async () => {
    const input = await parseNoticeRequest(new Request("https://example.test/api/admin/notices", {
      method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(fields),
    }));
    expect(input).toEqual({...fields, title: "공지", body: "본문"});
  });
  it("accepts multipart replacement and explicit removal", async () => {
    const form = new FormData();
    Object.entries(fields).forEach(([key,value]) => form.set(key,value));
    form.set("image", new File([new Uint8Array(await png())], "poster.png"));
    const parse = () => parseNoticeRequest(new Request("https://example.test/api/admin/notices", {method: "POST", body: form}));
    expect((await parse()).image?.width).toBe(2400);
    form.delete("image");
    form.set("removeImage", "true");
    expect((await parse()).image).toBeNull();
  });
  it("rejects ambiguous replacement/removal, multiple images and cross-origin forms", async () => {
    const form = new FormData();
    Object.entries(fields).forEach(([key,value]) => form.set(key,value));
    const file = new File([new Uint8Array(await png())], "poster.png");
    form.set("image", file);
    form.set("removeImage", "true");
    const request = (origin?: string) => new Request("https://example.test/api/admin/notices", {
      method: "POST", body: form, headers: origin ? {origin} : undefined,
    });
    await expect(parseNoticeRequest(request())).rejects.toMatchObject({code: "INVALID_INPUT"});
    form.delete("removeImage");
    form.append("image", file);
    await expect(parseNoticeRequest(request())).rejects.toMatchObject({code: "INVALID_INPUT"});
    await expect(parseNoticeRequest(request("https://unrelated.test"))).rejects.toMatchObject({status: 403});
  });
  it("caps request bytes even without a content-length", async () => {
    await expect(parseNoticeRequest(new Request("https://example.test/api/admin/notices", {
      method: "POST", headers: {"content-type": "application/json"}, body: "x".repeat(4 * 1024 * 1024),
    }))).rejects.toMatchObject({status: 413});
  });
});
