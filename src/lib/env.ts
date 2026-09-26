import { z } from "zod";

const GoogleCalendarEncryptionKey = z.string().refine((value) => {
  try {
    const decoded = Buffer.from(value, "base64");
    const normalizedInput = value.replace(/=+$/u, "");
    const normalizedRoundTrip = decoded.toString("base64").replace(/=+$/u, "");
    return decoded.length === 32 && normalizedRoundTrip === normalizedInput;
  } catch {
    return false;
  }
}, "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");

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
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  WEB_PUSH_SUBJECT: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY: GoogleCalendarEncryptionKey.optional(),
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


export function requireWebPushConfig(): {
  publicKey: string;
  privateKey: string;
  subject: string;
} {
  const current = getEnv();
  if (
    !current.WEB_PUSH_VAPID_PUBLIC_KEY ||
    !current.WEB_PUSH_VAPID_PRIVATE_KEY ||
    !current.WEB_PUSH_SUBJECT
  ) {
    throw new Error("MISSING_WEB_PUSH_CONFIG");
  }
  return {
    publicKey: current.WEB_PUSH_VAPID_PUBLIC_KEY,
    privateKey: current.WEB_PUSH_VAPID_PRIVATE_KEY,
    subject: current.WEB_PUSH_SUBJECT,
  };
}


export function requireGoogleCalendarConfig(): {
  clientId: string;
  clientSecret: string;
  tokenEncryptionKey: string;
} {
  const current = getEnv();
  if (
    !current.GOOGLE_OAUTH_CLIENT_ID ||
    !current.GOOGLE_OAUTH_CLIENT_SECRET ||
    !current.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY
  ) {
    throw new Error("MISSING_GOOGLE_CALENDAR_CONFIG");
  }

  return {
    clientId: current.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: current.GOOGLE_OAUTH_CLIENT_SECRET,
    tokenEncryptionKey: current.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY,
  };
}
