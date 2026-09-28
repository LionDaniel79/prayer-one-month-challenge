import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { requireRosterEncryptionKey } from "../../lib/env";
import { normalizeRosterPhone } from "./normalize";

function key(): Buffer {
  const decoded = Buffer.from(requireRosterEncryptionKey(), "base64");
  if (decoded.length !== 32) throw new Error("INVALID_ROSTER_ENCRYPTION_KEY");
  return decoded;
}

export function encryptRosterPhone(phone: string): string {
  const normalized = normalizeRosterPhone(phone);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptRosterPhone(value: string): string {
  try {
    const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
    if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
      throw new Error("INVALID_FORMAT");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("PHONE_DECRYPT_FAILED");
  }
}
