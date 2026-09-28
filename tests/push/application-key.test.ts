import { describe, expect, it } from "vitest";
import { decodeApplicationServerKey } from "../../src/features/push/browser-key";

describe("push application server key", () => {
  it("returns a real ArrayBuffer for PushManager.subscribe", () => {
    const result = decodeApplicationServerKey("AQID");
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(result))).toEqual([1, 2, 3]);
  });
});
