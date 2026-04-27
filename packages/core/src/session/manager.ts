import { randomBytes } from "node:crypto";

import type { SessionHandle, SessionStorageAdapter, TeleforgeSession } from "./types.js";

export class SessionManager {
  constructor(private readonly storage: SessionStorageAdapter) {}

  async create<TState = Record<string, unknown>>(
    userId: string,
    flowId: string,
    initialState: TState = {} as TState,
    ttlSeconds?: number
  ): Promise<{ sessionId: string; handle: SessionHandle<TState> }> {
    const sessionId = generateSessionId();
    const key = this.createSessionKey(userId, flowId, sessionId);
    const ttl = ttlSeconds ?? this.storage.defaultTTL;
    const now = Date.now();
    const session: TeleforgeSession<TState> = {
      createdAt: now,
      expiresAt: now + ttl * 1000,
      flowId,
      revision: 1,
      sessionId,
      state: structuredClone(initialState) as TState,
      status: "active",
      updatedAt: now,
      userId
    };

    await this.storage.set(key, JSON.stringify(session), ttl);

    return {
      sessionId,
      handle: this.createHandle<TState>(key)
    };
  }

  async get<TState = Record<string, unknown>>(
    userId: string,
    flowId: string,
    sessionId: string
  ): Promise<SessionHandle<TState> | null> {
    const key = this.createSessionKey(userId, flowId, sessionId);
    const stored = await this.storage.get(key);

    if (!stored) {
      return null;
    }

    const session = JSON.parse(stored) as TeleforgeSession<TState>;

    if (session.status !== "active" || session.expiresAt <= Date.now()) {
      return null;
    }

    return this.createHandle<TState>(key);
  }

  async cancel(userId: string, flowId: string, sessionId: string): Promise<void> {
    const key = this.createSessionKey(userId, flowId, sessionId);
    const stored = await this.storage.get(key);

    if (!stored) {
      return;
    }

    const session = JSON.parse(stored) as TeleforgeSession;
    session.status = "cancelled";
    session.updatedAt = Date.now();
    session.revision += 1;

    await this.storage.set(key, JSON.stringify(session), this.storage.defaultTTL);
  }

  createSessionKey(userId: string, flowId: string, sessionId: string): string {
    return `session:${userId}:${flowId}:${sessionId}`;
  }

  private createHandle<TState = Record<string, unknown>>(
    key: string
  ): SessionHandle<TState> {
    return {
      complete: async () => {
        const stored = await this.requireSession<TState>(key);
        stored.status = "completed";
        stored.updatedAt = Date.now();
        stored.revision += 1;

        await this.storage.set(key, JSON.stringify(stored), this.storage.defaultTTL);
      },

      get: async () => {
        const stored = await this.requireSession<TState>(key);
        return structuredClone(stored.state) as TState;
      },

      patch: async (partial: Partial<TState>) => {
        const stored = await this.requireSession<TState>(key);
        stored.state = { ...stored.state, ...partial } as TState;
        stored.updatedAt = Date.now();
        stored.revision += 1;
        stored.expiresAt = Date.now() + this.storage.defaultTTL * 1000;

        await this.storage.set(key, JSON.stringify(stored), this.storage.defaultTTL);
      },

      set: async (next: TState) => {
        const stored = await this.requireSession<TState>(key);
        stored.state = structuredClone(next) as TState;
        stored.updatedAt = Date.now();
        stored.revision += 1;
        stored.expiresAt = Date.now() + this.storage.defaultTTL * 1000;

        await this.storage.set(key, JSON.stringify(stored), this.storage.defaultTTL);
      }
    };
  }

  private async requireSession<TState>(
    key: string
  ): Promise<TeleforgeSession<TState>> {
    const raw = await this.storage.get(key);

    if (!raw) {
      throw new Error(`Session "${key}" was not found or expired.`);
    }

    const session = JSON.parse(raw) as TeleforgeSession<TState>;

    if (session.status !== "active") {
      throw new Error(`Session "${key}" is ${session.status}.`);
    }

    if (session.expiresAt <= Date.now()) {
      throw new Error(`Session "${key}" has expired.`);
    }

    return session;
  }
}

function generateSessionId(): string {
  return `sess_${randomBytes(16).toString("base64url")}`;
}
