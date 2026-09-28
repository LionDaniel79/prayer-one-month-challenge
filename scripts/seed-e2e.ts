import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import { encryptRosterPhone } from "../src/features/roster/crypto";
import { hashPhonePassword, normalizeName, phoneLookupHash } from "../src/features/auth/crypto";
import { addDays, defaultEndDate, todayInSeoul } from "../src/features/challenge/date";
import { e2eAccounts, e2eChallengeId, e2eDraftNoticeId, e2ePublishedNoticeId } from "../tests/fixtures/e2e-data";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  // Refuse remote/shared DBs and require explicit CI opt-in. Never drop existing data.
  if (process.env.CI !== "true" || process.env.E2E_DATABASE_READY !== "1" ||
      !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/prayer_e2e") {
    throw new Error("E2E_SEED_REQUIRES_DISPOSABLE_LOCAL_CI_DATABASE");
  }
  const sql = postgres(url.toString(), { ssl: "require", prepare: false, max: 1 });
  try {
    const [existing] = await sql`select to_regnamespace('prayer_app') as schema`;
    if (existing.schema !== null) throw new Error("E2E_DATABASE_MUST_BE_EMPTY");
    await sql.begin(async (tx) => {
      await tx.unsafe("create role anon nologin; create role authenticated nologin;");
      const migrations = (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort();
      for (const name of migrations) await tx.unsafe(await readFile("drizzle/" + name, "utf8"));
      for (const [role, account] of Object.entries(e2eAccounts)) {
        const lookup = phoneLookupHash(account.phone);
        await tx`insert into prayer_app.member_roster
          (id, source_name, canonical_name, position, phone_lookup_hash, phone_ciphertext,
           village, sam, sam_label, is_admin, source)
          values (${account.rosterId}, ${account.name}, ${account.name}, '성도', ${lookup},
            ${encryptRosterPhone(account.phone)}, '검증', '검증샘', '검증샘', ${role === "admin"}, 'manual')`;
        if (account.userId) {
          await tx`insert into prayer_app.users
            (id, roster_id, display_name, normalized_name, phone_lookup_hash, phone_password_hash, role)
            values (${account.userId}, ${account.rosterId}, ${account.name}, ${normalizeName(account.name)},
              ${lookup}, ${await hashPhonePassword(account.phone)}, ${role})`;
        }
      }
      const start = addDays(todayInSeoul(), -3);
      await tx`insert into prayer_app.challenges (id, title, start_date, end_date, is_active)
        values (${e2eChallengeId}, '기도운동 1달 도전', ${start}, ${defaultEndDate(start)}, true)`;
      await tx`insert into prayer_app.notices (id, title, body, status, author_user_id, published_at)
        values (${e2ePublishedNoticeId}, '검증용 공개 공지', '공개 안내 내용', 'published', ${e2eAccounts.admin.userId}, now()),
          (${e2eDraftNoticeId}, '검증용 비공개 초안', '초안은 관리자에게만 표시', 'draft', ${e2eAccounts.admin.userId}, null)`;
    });
    console.log("Disposable CI database migrated and seeded with synthetic data.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "E2E_SEED_FAILED");
  process.exitCode = 1;
});
