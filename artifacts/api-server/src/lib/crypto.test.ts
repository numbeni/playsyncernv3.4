import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  encrypt,
  decrypt,
  hashForLookup,
  generateKey,
  CryptoKeyError,
  DecryptionError,
} from "./crypto.ts";

describe("crypto utilities", () => {
  test("encrypt/decrypt round-trips plaintext", () => {
    const key = generateKey();
    const plaintext = "player@example.com";
    const ciphertext = encrypt(plaintext, key);

    assert.notEqual(ciphertext, plaintext);
    assert.equal(decrypt(ciphertext, key), plaintext);
  });

  test("encrypt produces different ciphertext for the same plaintext (random IV)", () => {
    const key = generateKey();
    const a = encrypt("same-value", key);
    const b = encrypt("same-value", key);
    assert.notEqual(a, b);
  });

  test("decrypt fails with the wrong key", () => {
    const key = generateKey();
    const wrongKey = generateKey();
    const ciphertext = encrypt("secret", key);
    assert.throws(() => decrypt(ciphertext, wrongKey), DecryptionError);
  });

  test("decrypt fails on tampered ciphertext (auth tag check)", () => {
    const key = generateKey();
    const ciphertext = encrypt("secret", key);
    const raw = Buffer.from(ciphertext, "base64");
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0xff; // flip last byte
    const tampered = raw.toString("base64");
    assert.throws(() => decrypt(tampered, key), DecryptionError);
  });

  test("rejects keys that are not exactly 32 bytes", () => {
    const shortKey = Buffer.alloc(16);
    assert.throws(() => encrypt("x", shortKey), CryptoKeyError);
  });

  test("hashForLookup is deterministic for the same key and input", () => {
    const key = generateKey();
    const a = hashForLookup("PlayerOne", key);
    const b = hashForLookup("PlayerOne", key);
    assert.equal(a, b);
  });

  test("hashForLookup differs for different inputs or keys", () => {
    const key = generateKey();
    const otherKey = generateKey();
    assert.notEqual(hashForLookup("PlayerOne", key), hashForLookup("PlayerTwo", key));
    assert.notEqual(hashForLookup("PlayerOne", key), hashForLookup("PlayerOne", otherKey));
  });

  test("hashForLookup output looks like a hex sha256 digest", () => {
    const key = generateKey();
    const digest = hashForLookup("value", key);
    assert.match(digest, /^[0-9a-f]{64}$/);
  });
});
