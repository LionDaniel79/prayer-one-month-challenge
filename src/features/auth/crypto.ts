import { createHmac, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { getEnv } from "../../lib/env";
import { canonicalizeRosterName, normalizeRosterPhone } from "../roster/normalize";

export function normalizeName(value: string): string {
  return canonicalizeRosterName(value).toLocaleLowerCase("ko-KR");
}

export function normalizePhone(value: string): string {
  return normalizeRosterPhone(value);
}

export function phoneLookupHash(phone: string): string {
  return createHmac("sha256", getEnv().PHONE_LOOKUP_PEPPER)
    .update(normalizePhone(phone))
    .digest("hex");
}

export async function hashPassword(value: string): Promise<string> {
  if (!value) throw new Error("INVALID_PASSWORD");
  return argon2.hash(value, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, value: string): Promise<boolean> {
  if (!value) return false;
  try {
    return await argon2.verify(hash, value);
  } catch {
    return false;
  }
}

export async function hashPhonePassword(phone: string): Promise<string> {
  return hashPassword(normalizePhone(phone));
}

export async function verifyPhonePassword(hash: string, phone: string): Promise<boolean> {
  try {
    return await verifyPassword(hash, normalizePhone(phone));
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
