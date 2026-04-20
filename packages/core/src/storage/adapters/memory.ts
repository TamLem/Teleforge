import type { StorageAdapter, StorageOptions } from "../types.js";

interface MemoryEntry {
  expiresAt: number;
  value: string;
}

export class MemoryStorageAdapter implements StorageAdapter {
  readonly defaultTTL: number;
  readonly namespace?: string;

  private readonly store = new Map<string, MemoryEntry>();

  constructor(options: StorageOptions) {
    if (options.defaultTTL <= 0) {
      throw new Error("Storage defaultTTL must be greater than zero.");
    }

    this.defaultTTL = options.defaultTTL;
    this.namespace = options.namespace;
  }

  async compareAndSet(
    key: string,
    expectedRevision: number,
    value: string,
    ttl = this.defaultTTL
  ): Promise<boolean> {
    const namespacedKey = this.resolveKey(key);
    const current = this.readEntry(namespacedKey);

    if (!current) {
      return false;
    }

    try {
      const parsed = JSON.parse(current);
      if (parsed.revision !== expectedRevision) {
        return false;
      }
    } catch {
      return false;
    }

    this.writeEntry(namespacedKey, value, ttl);
    return true;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(this.resolveKey(key));
  }

  async get(key: string): Promise<string | null> {
    return this.readEntry(this.resolveKey(key));
  }

  async set(key: string, value: string, ttl = this.defaultTTL): Promise<void> {
    this.writeEntry(this.resolveKey(key), value, ttl);
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

  private readEntry(key: string): string | null {
    this.cleanupExpired();

    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  private resolveExpiry(ttl: number): number {
    return Date.now() + ttl * 1000;
  }

  private resolveKey(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  private writeEntry(key: string, value: string, ttl: number): void {
    const expiresAt = this.resolveExpiry(ttl);

    this.store.set(key, {
      expiresAt,
      value
    });
  }
}
