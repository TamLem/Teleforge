export type TeleforgeSessionStatus = "active" | "completed" | "expired" | "cancelled";

export interface TeleforgeSession<TState = Record<string, unknown>> {
  sessionId: string;
  flowId: string;
  userId: string;
  state: TState;
  status: TeleforgeSessionStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  revision: number;
}

export interface SessionHandle<TState = Record<string, unknown>> {
  get(): Promise<TState>;
  patch(partial: Partial<TState>): Promise<void>;
  set(next: TState): Promise<void>;
  complete(): Promise<void>;
}

export interface SessionStorageAdapter {
  readonly defaultTTL: number;
  readonly namespace?: string;

  delete(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  touch(key: string, ttl: number): Promise<void>;
  compareAndSet?(
    key: string,
    expectedRevision: number,
    value: string,
    ttl?: number
  ): Promise<boolean>;
}
