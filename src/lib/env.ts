import { z } from "zod";

const RosterEncryptionKey = z.string().refine((value) => {
  try {
    const decoded = Buffer.from(value, "base64");
    const normalizedInput = value.replace(/=+$/u, "");
    const normalizedRoundTrip = decoded.toString("base64").replace(/=+$/u, "");
    return decoded.length === 32 && normalizedRoundTrip === normalizedInput;
  } catch {
    return false;
  }
}, "ROSTER_ENCRYPTION_KEY must decode to 32 bytes");

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  PHONE_LOOKUP_PEPPER: z.string().min(32),
  ROSTER_ENCRYPTION_KEY: RosterEncryptionKey.optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function parseEnv(input: Record<string, string | undefined>): AppEnv {
  return EnvSchema.parse(input);
}

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

export function requireRosterEncryptionKey(): string {
  const value = getEnv().ROSTER_ENCRYPTION_KEY;
  if (!value) throw new Error("MISSING_ROSTER_ENCRYPTION_KEY");
  return value;
}
