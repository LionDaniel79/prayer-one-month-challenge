import { z } from "zod";
import { boundedJson, json, prayerActor, prayerError, prayerId, sameOrigin } from "../../../../src/features/prayer-requests/http";
import { updateOwnPrayerRequest } from "../../../../src/features/prayer-requests/service";

const Input = z.union([
  z.object({ content: z.string().trim().min(1).max(10000), expectedVersion: z.number().int().positive() }).strict(),
  z.object({ complete: z.literal(true) }).strict(),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await prayerActor();
    sameOrigin(request);
    const id = await prayerId(context);
    const parsed = Input.safeParse(await boundedJson(request));
    if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
    await updateOwnPrayerRequest(id, actor, parsed.data);
    return json({ status: "ok" });
  } catch (error) { return prayerError(error); }
}
