import { createHmac, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { getEnv } from "../../lib/env";

export function normalizeName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ").normalize("NFC");
  if (!normalized) throw new Error("INVALID_NAME");
  return normalized.toLocaleLowerCase("ko-KR");
}

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{9,11}$/.test(digits)) throw new Error("INVALID_PHONE");
  return digits;
}

export function phoneLookupHash(phone: string): string {
  return createHmac("sha256", getEnv().PHONE_LOOKUP_PEPPER)
    .update(normalizePhone(phone))
    .digest("hex");
}

export async function hashPhonePassword(phone: string): Promise<string> {
  return argon2.hash(normalizePhone(phone), { type: argon2.argon2id });
}

export async function verifyPhonePassword(hash: string, phone: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, normalizePhone(phone));
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionTokenHash(token: string): string {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(token).digest("hex");
}
