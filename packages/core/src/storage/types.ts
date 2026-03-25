export interface UserFlowState {
  chatId?: string;
  createdAt: number;
  expiresAt: number;
  flowId: string;
  payload: Record<string, unknown>;
  stepId: string;
  userId: string;
  version: number;
}

export interface StorageOptions {
  defaultTTL: number;
  encryptionKey?: string;
  namespace?: string;
}

export interface StorageAdapter {
  readonly defaultTTL: number;
  readonly namespace?: string;

  compareAndSet?(
    key: string,
    expectedVersion: number,
    state: UserFlowState,
    ttl?: number
  ): Promise<boolean>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<UserFlowState | null>;
  set(key: string, state: UserFlowState, ttl?: number): Promise<void>;
  touch(key: string, ttl: number): Promise<void>;
}

export interface EncryptedState {
  algorithm: "aes-256-gcm";
  payload: string;
  version: 1;
}

export type StorageBackend = "durable-objects" | "memory" | "redis";
