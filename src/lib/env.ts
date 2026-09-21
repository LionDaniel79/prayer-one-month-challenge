import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  PHONE_LOOKUP_PEPPER: z.string().min(32),
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
