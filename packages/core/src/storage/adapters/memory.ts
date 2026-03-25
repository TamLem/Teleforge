import { decryptState, encryptState } from "../crypto.js";

import type { EncryptedState, StorageAdapter, StorageOptions, UserFlowState } from "../types.js";

interface MemoryEntry {
  expiresAt: number;
  state: EncryptedState | UserFlowState;
}

/**
 * In-memory storage adapter for coordinated flow state.
 *
 * Entries expire automatically on access and support optimistic locking through
 * `compareAndSet()`.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly defaultTTL: number;

  readonly namespace?: string;

  private readonly encryptionKey?: string;

  private readonly store = new Map<string, MemoryEntry>();

  constructor(options: StorageOptions) {
    if (options.defaultTTL <= 0) {
      throw new Error("Storage defaultTTL must be greater than zero.");
    }

    this.defaultTTL = options.defaultTTL;
    this.encryptionKey = options.encryptionKey;
    this.namespace = options.namespace;
  }

  async compareAndSet(
    key: string,
    expectedVersion: number,
    state: UserFlowState,
    ttl = this.defaultTTL
  ): Promise<boolean> {
    const namespacedKey = this.resolveKey(key);
    const current = this.readEntry(namespacedKey);

    if (!current || current.version !== expectedVersion) {
      return false;
    }

    this.writeEntry(namespacedKey, state, ttl);
    return true;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(this.resolveKey(key));
  }

  async get(key: string): Promise<UserFlowState | null> {
    return this.readEntry(this.resolveKey(key));
  }

  async set(key: string, state: UserFlowState, ttl = this.defaultTTL): Promise<void> {
    this.writeEntry(this.resolveKey(key), state, ttl);
  }

  async touch(key: string, ttl: number): Promise<void> {
    const namespacedKey = this.resolveKey(key);
    const current = this.readEntry(namespacedKey);

    if (!current) {
      return;
    }

    this.writeEntry(namespacedKey, current, ttl);
  }

  private cleanupExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private readEntry(key: string): UserFlowState | null {
    this.cleanupExpired();

    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return this.unwrapState(entry.state);
  }

  private resolveExpiry(ttl: number): number {
    return Date.now() + ttl * 1000;
  }

  private resolveKey(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  private unwrapState(value: EncryptedState | UserFlowState): UserFlowState {
    if (this.encryptionKey) {
      return decryptState(value as EncryptedState, this.encryptionKey);
    }

    return structuredClone(value as UserFlowState);
  }

  private wrapState(value: UserFlowState): EncryptedState | UserFlowState {
    const clonedState = structuredClone(value);

    return this.encryptionKey ? encryptState(clonedState, this.encryptionKey) : clonedState;
  }

  private writeEntry(key: string, state: UserFlowState, ttl: number): void {
    const expiresAt = this.resolveExpiry(ttl);

    this.store.set(key, {
      expiresAt,
      state: this.wrapState({
        ...structuredClone(state),
        expiresAt
      })
    });
  }
}
