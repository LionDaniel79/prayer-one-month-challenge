import { and, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { memberRoster, sams, users } from "../../db/schema";

export const requesterSam = alias(sams, "requester_sam");
// Imported roster labels already normalize village/sam numbers (for example 1-2).
export const requesterSamJoin = and(
  eq(requesterSam.isActive, true),
  or(
    eq(requesterSam.name, sql`regexp_replace(${memberRoster.samLabel}, '샘$', '')`),
    and(isNull(memberRoster.samLabel), eq(requesterSam.id, users.samId)),
  ),
);
export const requesterSamLabel = sql<string | null>`coalesce(${memberRoster.samLabel}, ${requesterSam.name})`;
