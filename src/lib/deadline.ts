// For reads only. Timing out does not prove that a write failed.
export async function withDeadline<T>(pending: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
