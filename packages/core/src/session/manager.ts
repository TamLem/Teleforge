import { randomBytes } from "node:crypto";

import type {
  SessionHandle,
  SessionResourceHandle,
  SessionStorageAdapter,
  TeleforgeSession
} from "./types.js";

const RESOURCES_KEY = "__resources";

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
      ttlSeconds: ttl,
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

    await this.storage.set(key, JSON.stringify(session), session.ttlSeconds);
  }

  createSessionKey(userId: string, flowId: string, sessionId: string): string {
    return `session:${userId}:${flowId}:${sessionId}`;
  }

  async ensure<TState = Record<string, unknown>>(
    userId: string,
    flowId: string,
    sessionId: string,
    options?: {
      initialState?: TState;
      ttlSeconds?: number;
    }
  ): Promise<SessionHandle<TState>> {
    const key = this.createSessionKey(userId, flowId, sessionId);
    const stored = await this.storage.get(key);
    const now = Date.now();

    if (stored) {
      const parsed = JSON.parse(stored) as TeleforgeSession<TState>;

      if (parsed.status === "active" && parsed.expiresAt > now) {
        const resumeTtl = options?.ttlSeconds ?? parsed.ttlSeconds;
        parsed.expiresAt = now + resumeTtl * 1000;
        parsed.ttlSeconds = resumeTtl;
        parsed.updatedAt = now;
        parsed.revision += 1;
        await this.storage.set(key, JSON.stringify(parsed), resumeTtl);
        return this.createHandle<TState>(key);
      }
    }

    const ttl = options?.ttlSeconds ?? this.storage.defaultTTL;
    const session: TeleforgeSession<TState> = {
      createdAt: now,
      expiresAt: now + ttl * 1000,
      flowId,
      revision: 1,
      sessionId,
      state: (options?.initialState !== undefined
        ? structuredClone(options.initialState)
        : {}) as TState,
      status: "active",
      ttlSeconds: ttl,
      updatedAt: now,
      userId
    };

    await this.storage.set(key, JSON.stringify(session), ttl);

    return this.createHandle<TState>(key);
  }

  private createHandle<TState = Record<string, unknown>>(key: string): SessionHandle<TState> {
    const storage = this.storage;
    const requireSession = this.requireSession.bind(this);

    async function readState(): Promise<TState> {
      const stored = await requireSession<TState>(key);
      const state = structuredClone(stored.state) as Record<string, unknown>;
      delete state[RESOURCES_KEY];
      return state as TState;
    }

    async function readRawState(): Promise<TState> {
      const stored = await requireSession<TState>(key);
      return structuredClone(stored.state) as TState;
    }

    async function writeState(nextState: TState): Promise<void> {
      const stored = await requireSession<TState>(key);
      const incoming = structuredClone(nextState) as Record<string, unknown>;
      delete incoming[RESOURCES_KEY];
      const existingResources = (stored.state as Record<string, unknown>)[RESOURCES_KEY];
      if (existingResources !== undefined) {
        incoming[RESOURCES_KEY] = structuredClone(existingResources);
      }
      stored.state = incoming as TState;
      stored.updatedAt = Date.now();
      stored.revision += 1;
      stored.expiresAt = Date.now() + stored.ttlSeconds * 1000;
      await storage.set(key, JSON.stringify(stored), stored.ttlSeconds);
    }

    async function writeRawState(nextState: TState): Promise<void> {
      const stored = await requireSession<TState>(key);
      stored.state = structuredClone(nextState) as TState;
      stored.updatedAt = Date.now();
      stored.revision += 1;
      stored.expiresAt = Date.now() + stored.ttlSeconds * 1000;
      await storage.set(key, JSON.stringify(stored), stored.ttlSeconds);
    }

    return {
      complete: async () => {
        const stored = await requireSession<TState>(key);
        stored.status = "completed";
        stored.updatedAt = Date.now();
        stored.revision += 1;
        await storage.set(key, JSON.stringify(stored), stored.ttlSeconds);
      },

      get: readState,

      patch: async (partial: Partial<TState>) => {
        const stored = await requireSession<TState>(key);
        const { [RESOURCES_KEY]: _, ...cleanPartial } = partial as Record<string, unknown>;
        stored.state = { ...stored.state, ...cleanPartial } as TState;
        stored.updatedAt = Date.now();
        stored.revision += 1;
        stored.expiresAt = Date.now() + stored.ttlSeconds * 1000;
        await storage.set(key, JSON.stringify(stored), stored.ttlSeconds);
      },

      set: writeState,

      resource: <TValue = Record<string, unknown>>(
        resourceKey: string,
        options?: { initialValue?: TValue | (() => TValue | Promise<TValue>) }
      ): SessionResourceHandle<TValue> => {
        async function resolveInitial(): Promise<TValue> {
          if (options?.initialValue !== undefined) {
            return typeof options.initialValue === "function"
              ? await (options.initialValue as () => TValue | Promise<TValue>)()
              : (options.initialValue as TValue);
          }
          return {} as TValue;
        }

        return {
          get: async () => {
            const state = (await readRawState()) as Record<string, unknown>;
            const resources = (state[RESOURCES_KEY] ?? {}) as Record<string, unknown>;
            if (resourceKey in resources) {
              return structuredClone(resources[resourceKey]) as TValue;
            }
            return resolveInitial();
          },

          set: async (value: TValue) => {
            const state = (await readRawState()) as Record<string, unknown>;
            const resources = structuredClone(
              (state[RESOURCES_KEY] ?? {}) as Record<string, unknown>
            );
            resources[resourceKey] = value;
            await writeRawState({ ...state, [RESOURCES_KEY]: resources } as unknown as TState);
          },

          update: async (mutator) => {
            const state = (await readRawState()) as Record<string, unknown>;
            const resources = structuredClone(
              (state[RESOURCES_KEY] ?? {}) as Record<string, unknown>
            );
            const current =
              resourceKey in resources
                ? (structuredClone(resources[resourceKey]) as TValue)
                : await resolveInitial();
            const draft = structuredClone(current) as TValue;
            const result = await mutator(draft);
            const next = result !== undefined ? result : draft;
            resources[resourceKey] = next;
            await writeRawState({ ...state, [RESOURCES_KEY]: resources } as unknown as TState);
            return next;
          },

          clear: async () => {
            const state = (await readRawState()) as Record<string, unknown>;
            const resources = structuredClone(
              (state[RESOURCES_KEY] ?? {}) as Record<string, unknown>
            );
            delete resources[resourceKey];
            await writeRawState({ ...state, [RESOURCES_KEY]: resources } as unknown as TState);
          }
        };
      }
    };
  }

  private async requireSession<TState>(key: string): Promise<TeleforgeSession<TState>> {
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
