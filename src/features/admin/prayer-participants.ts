import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { challenges, prayerParticipantExclusions, users } from "../../db/schema";
import { DomainError } from "../../lib/http";

export function prayerParticipantNotExcluded(challengeId: string) {
  return sql`not exists (select 1 from ${prayerParticipantExclusions}
    where ${prayerParticipantExclusions.challengeId} = ${challengeId}
      and ${prayerParticipantExclusions.userId} = ${users.id})`;
}

export async function excludePrayerParticipant(userId: string, challengeId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [activeChallenge] = await tx.select({ id: challenges.id }).from(challenges)
      .where(eq(challenges.isActive, true)).limit(1).for("share");
    if (!activeChallenge) throw new DomainError("NO_ACTIVE_CHALLENGE", 409);
    if (activeChallenge.id !== challengeId) throw new DomainError("CHALLENGE_CHANGED", 409);

    const [participant] = await tx.select({ id: users.id }).from(users)
      .where(and(eq(users.id, userId), eq(users.isActive, true))).limit(1).for("share");
    if (!participant) throw new DomainError("PARTICIPANT_NOT_FOUND", 404);

    await tx.insert(prayerParticipantExclusions).values({ challengeId, userId })
      .onConflictDoNothing({ target: [prayerParticipantExclusions.challengeId, prayerParticipantExclusions.userId] });
  });
}

/** One population definition for dashboard, participant list and sam statistics. */
export function prayerParticipantHasCheckin(
  challenge: { id: string; startDate: string; endDate: string },
  today: string,
) {
  const end = today < challenge.endDate ? today : challenge.endDate;
  return sql`exists (select 1 from prayer_app.prayer_checkins eligible_check
    where eligible_check.user_id = ${users.id}
      and eligible_check.challenge_id = ${challenge.id}
      and eligible_check.prayer_date >= ${challenge.startDate}::date
      and eligible_check.prayer_date <= ${end}::date
      and extract(isodow from eligible_check.prayer_date) <> 7)`;
}
