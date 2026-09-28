import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { requireGoogleCalendarConfig } from "../../lib/env";

function decodeKey(value: string): Buffer {
  const decoded = Buffer.from(value, "base64");
  const normalizedInput = value.replace(/=+$/u, "");
  const normalizedRoundTrip = decoded.toString("base64").replace(/=+$/u, "");

  if (decoded.length !== 32 || normalizedInput !== normalizedRoundTrip) {
    throw new Error("INVALID_GOOGLE_CALENDAR_ENCRYPTION_KEY");
  }
  return decoded;
}

export function encryptGoogleRefreshToken(
  value: string,
  encodedKey = requireGoogleCalendarConfig().tokenEncryptionKey,
): string {
  const key = decodeKey(encodedKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
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

export function decryptGoogleRefreshToken(
  serialized: string,
  encodedKey = requireGoogleCalendarConfig().tokenEncryptionKey,
): string {
  const [version, ivPart, tagPart, ciphertextPart] = serialized.split(".");
  if (
    version !== "v1" ||
    !ivPart ||
    !tagPart ||
    !ciphertextPart
  ) {
    throw new Error("INVALID_GOOGLE_CALENDAR_TOKEN_CIPHERTEXT");
  }

  const key = decodeKey(encodedKey);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
