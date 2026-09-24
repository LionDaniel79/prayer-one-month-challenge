import {
  boolean,
  date,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const appSchema = pgSchema("prayer_app");
export const roleEnum = appSchema.enum("prayer_role", ["member", "admin"]);

export const challenges = appSchema.table(
  "challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull().default("기도운동 1달 도전"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    timezone: text("timezone").notNull().default("Asia/Seoul"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("challenges_one_active_uq")
      .on(t.isActive)
      .where(sql`${t.isActive} = true`),
  ],
);

export const sams = appSchema.table(
  "sams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    leaderName: varchar("leader_name", { length: 100 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sams_name_uq").on(t.name)],
);

export const memberRoster = appSchema.table(
  "member_roster",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceName: varchar("source_name", { length: 120 }).notNull(),
    canonicalName: varchar("canonical_name", { length: 80 }).notNull(),
    position: varchar("position", { length: 80 }),
    phoneLookupHash: varchar("phone_lookup_hash", { length: 64 }),
    phoneCiphertext: text("phone_ciphertext"),
    passwordHash: text("password_hash"),
    village: varchar("village", { length: 80 }),
    sam: varchar("sam", { length: 80 }),
    samLabel: varchar("sam_label", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    isAdmin: boolean("is_admin").notNull().default(false),
    source: varchar("source", { length: 20 }).notNull(),
    sourceRow: integer("source_row"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("member_roster_name_phone_uq")
      .on(t.canonicalName, t.phoneLookupHash)
      .where(sql`${t.phoneLookupHash} is not null`),
    index("member_roster_name_idx").on(t.canonicalName),
    index("member_roster_sam_idx").on(t.samLabel),
  ],
);

export const users = appSchema.table(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 80 }).notNull(),
    phoneLookupHash: varchar("phone_lookup_hash", { length: 64 }).notNull(),
    phonePasswordHash: text("phone_password_hash").notNull(),
    samId: uuid("sam_id").references(() => sams.id),
    rosterId: uuid("roster_id").references(() => memberRoster.id),
    role: roleEnum("role").notNull().default("member"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_name_phone_uq").on(t.normalizedName, t.phoneLookupHash),
    uniqueIndex("users_roster_uq").on(t.rosterId),
    index("users_sam_idx").on(t.samId),
  ],
);

export const prayerCheckins = appSchema.table(
  "prayer_checkins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prayerDate: date("prayer_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("checkin_user_date_uq").on(t.challengeId, t.userId, t.prayerDate),
    index("checkin_date_idx").on(t.challengeId, t.prayerDate),
    index("checkin_user_idx").on(t.userId),
  ],
);

export const sessions = appSchema.table(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sessions_token_uq").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expiry_idx").on(t.expiresAt),
  ],
);

export const authRateLimits = appSchema.table("auth_rate_limits", {
  keyHash: varchar("key_hash", { length: 64 }).primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  failureCount: integer("failure_count").notNull().default(0),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});
