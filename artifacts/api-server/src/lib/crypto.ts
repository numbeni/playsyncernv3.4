/**
 * Reusable cryptography utilities built on Node's native `crypto` module.
 *
 * PS-01 scope note: these utilities are foundation-only. They are NOT wired
 * into Accounts, Backup Codes, or any existing database column yet — that
 * wiring is a separate, explicitly-authorized phase per docs/CURRENT_PHASE.md.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // recommended IV length for GCM
const AUTH_TAG_LENGTH_BYTES = 16;

export class CryptoKeyError extends Error {}
export class DecryptionError extends Error {}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new CryptoKeyError(
      `Encryption key must be exactly ${KEY_LENGTH_BYTES} bytes, got ${key.length}`,
    );
  }
}

/** Generates a fresh random 32-byte key, suitable for AES-256-GCM. */
export function generateKey(): Buffer {
  return randomBytes(KEY_LENGTH_BYTES);
}

/**
 * Authenticated-encrypts `plaintext` with AES-256-GCM.
 * Returns a single base64 string containing iv + authTag + ciphertext,
 * so it can be stored as one opaque value.
 */
export function encrypt(plaintext: string, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypts a value produced by `encrypt`. Throws `DecryptionError` if the
 * payload is malformed or has been tampered with (auth tag mismatch).
 */
export function decrypt(payload: string, key: Buffer): string {
  assertKey(key);

  let raw: Buffer;
  try {
    raw = Buffer.from(payload, "base64");
  } catch {
    throw new DecryptionError("Payload is not valid base64");
  }

  if (raw.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new DecryptionError("Payload is too short to be a valid ciphertext");
  }

  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(
    IV_LENGTH_BYTES,
    IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
  );
  const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch (err) {
    throw new DecryptionError(
      `Failed to decrypt payload (tampered or wrong key): ${(err as Error).message}`,
    );
  }
}

/**
 * Deterministic keyed lookup hash (HMAC-SHA256), hex-encoded.
 * Same (value, key) always produces the same hash — usable for exact-match
 * lookups (e.g. blind indexes) without storing plaintext, and without the
 * randomness of `encrypt`.
 */
export function hashForLookup(value: string, key: Buffer): string {
  assertKey(key);
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}
