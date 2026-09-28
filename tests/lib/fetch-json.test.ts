import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "../../src/lib/fetch-json";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("bounded JSON requests", () => {
  it.each([200, 503])("preserves timeout identity if the %s response body stalls", async (status) => {
    vi.useFakeTimers();
    // The transport has delivered headers; aborting its body uses AbortError.
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => new Response(new ReadableStream({
      start(controller) {
        init.signal!.addEventListener("abort", () => controller.error(new DOMException("body aborted", "AbortError")));
      },
    }), { status }));
    const result = expect(fetchJson("/api/prayer-requests", { method: "POST" }, 25)).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(26);
    await result;
  });

  it("cancels obsolete reads and preserves the caller's cancellation", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
    }));
    const result = expect(fetchJson("/availability", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await result;
  });
});
