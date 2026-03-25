import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type { EncryptedState, UserFlowState } from "./types.js";

/**
 * Encrypts a user flow state with AES-256-GCM using a SHA-256-derived key.
 *
 * @example
 * ```ts
 * const encrypted = encryptState(state, "coord-secret");
 * ```
 */
export function encryptState(state: UserFlowState, key: string): EncryptedState {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(key), nonce);
  const plaintext = Buffer.from(JSON.stringify(state), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([Buffer.from([1]), nonce, ciphertext, authTag]).toString(
    "base64url"
  );

  return {
    algorithm: "aes-256-gcm",
    payload,
    version: 1
  };
}

/**
 * Decrypts an AES-256-GCM-encrypted user flow state.
 *
 * @example
 * ```ts
 * const state = decryptState(encrypted, "coord-secret");
 * ```
 */
export function decryptState(encrypted: EncryptedState, key: string): UserFlowState {
  if (encrypted.algorithm !== "aes-256-gcm" || encrypted.version !== 1) {
    throw new Error("Unsupported flow-state encryption envelope.");
  }

  const payload = Buffer.from(encrypted.payload, "base64url");
  const version = payload.subarray(0, 1);
  const nonce = payload.subarray(1, 13);
  const authTag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(13, payload.length - 16);

  if (version[0] !== 1 || nonce.length !== 12 || authTag.length !== 16) {
    throw new Error("Malformed encrypted flow-state payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(key), nonce);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

  return JSON.parse(plaintext) as UserFlowState;
}

function deriveEncryptionKey(key: string): Buffer {
  return createHash("sha256").update(key).digest();
}
