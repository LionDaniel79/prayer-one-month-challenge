export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushSummary = {
  attempted: number;
  sent: number;
  expired: number;
  failed: number;
};

function statusCode(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }
  return null;
}

export async function fanOutPush(
  subscriptions: PushTarget[],
  send: (target: PushTarget) => Promise<void>,
  removeExpired: (endpoint: string) => Promise<void>,
): Promise<PushSummary> {
  const summary: PushSummary = {
    attempted: subscriptions.length,
    sent: 0,
    expired: 0,
    failed: 0,
  };

  for (const target of subscriptions) {
    try {
      await send(target);
      summary.sent += 1;
    } catch (error) {
      const code = statusCode(error);
      if (code === 404 || code === 410) {
        await removeExpired(target.endpoint);
        summary.expired += 1;
      } else {
        summary.failed += 1;
      }
    }
  }

  return summary;
}
