import type { StorageAdapter, StorageOptions } from "../types.js";

export interface RedisStorageClient {
  del(key: string): Promise<unknown>;
  eval?(
    script: string,
    options: {
      arguments: string[];
      keys: string[];
    }
  ): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
}

export interface RedisStorageAdapterOptions extends StorageOptions {
  client: RedisStorageClient;
}

const COMPARE_AND_SET_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then
  return 0
end
local decoded = cjson.decode(current)
if decoded["revision"] ~= tonumber(ARGV[1]) then
  return 0
end
redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
return 1
`;

export class RedisStorageAdapter implements StorageAdapter {
  readonly defaultTTL: number;
  readonly namespace?: string;

  private readonly client: RedisStorageClient;

  constructor(options: RedisStorageAdapterOptions) {
    if (options.defaultTTL <= 0) {
      throw new Error("Storage defaultTTL must be greater than zero.");
    }

    this.client = options.client;
    this.defaultTTL = options.defaultTTL;
    this.namespace = options.namespace;
  }

  async compareAndSet(
    key: string,
    expectedRevision: number,
    value: string,
    ttl = this.defaultTTL
  ): Promise<boolean> {
    if (!this.client.eval) {
      throw new Error("RedisStorageAdapter compareAndSet requires a Redis client with eval().");
    }

    const result = await this.client.eval(COMPARE_AND_SET_SCRIPT, {
      arguments: [String(expectedRevision), value, String(ttl)],
      keys: [this.resolveKey(key)]
    });

    return result === 1 || result === "1";
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.resolveKey(key));
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(this.resolveKey(key));
  }

  async set(key: string, value: string, ttl = this.defaultTTL): Promise<void> {
    await this.client.set(this.resolveKey(key), value, { EX: ttl });
  }

  async touch(key: string, ttl: number): Promise<void> {
    await this.client.expire(this.resolveKey(key), ttl);
  }

  private resolveKey(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }
}
