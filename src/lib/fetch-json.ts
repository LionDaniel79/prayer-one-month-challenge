// Bounds both response headers and the body. Never automatically retry a write.
export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) cancel();
  else init.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("REQUEST_TIMEOUT", "TimeoutError")), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.code ?? "REQUEST_FAILED");
    }
    return await response.json() as T;
  } catch (error) {
    // Browsers can report AbortError while reading a body, even for a deadline.
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancel);
  }
}
