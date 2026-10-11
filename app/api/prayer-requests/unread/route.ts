import { json, prayerActor, prayerError } from "../../../../src/features/prayer-requests/http";
import { hasUnreadPrayerComments } from "../../../../src/features/prayer-requests/service";

export async function GET() {
  try {
    const actor = await prayerActor();
    return json({ hasUnread: await hasUnreadPrayerComments(actor.id) });
  } catch (error) { return prayerError(error); }
}
