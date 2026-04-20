export type FlowInstanceStatus = "active" | "completed" | "suspended" | "failed" | "cancelled";
export type FlowInstanceSurface = "chat" | "miniapp" | "background";
export type FlowInstanceWaitReason =
  | "userInput"
  | "externalEvent"
  | "backgroundWork"
  | "handoffPending"
  | "error";

export interface FlowInstance {
  instanceId: string;
  flowId: string;
  status: FlowInstanceStatus;
  currentSurface: FlowInstanceSurface;
  waitReason?: FlowInstanceWaitReason;
  stepId: string;
  state: Record<string, unknown>;
  userId: string;
  chatId?: string;
  revision: number;
  createdAt: number;
  lastTransitionAt: number;
  expiresAt: number;
}

export interface RuntimeSignal {
  signalId?: string;
  type: string;
  source: "chat" | "miniapp" | "system" | "external";
  data?: Record<string, unknown>;
  metadata?: {
    telegramUpdateId?: number;
    userId?: string;
    chatId?: string;
    timestamp?: number;
  };
}

export type EffectType =
  | "sendMessage"
  | "editMessage"
  | "openMiniApp"
  | "showHandoff"
  | "navigateScreen"
  | "closeMiniApp"
  | "scheduleTimeout"
  | "suspendInstance"
  | "cancelInstance"
  | "resumeInstance"
  | "webhook"
  | "emitEvent"
  | "invokeExternalCommand";

export interface Effect {
  type: EffectType;
  dedupKey: string;
  payload: Record<string, unknown>;
}

export interface TransitionResult {
  instanceId: string;
  revision: number;
  status: FlowInstanceStatus;
  currentSurface: FlowInstanceSurface;
  stepId: string;
  state: Record<string, unknown>;
  effects: Effect[];
  requiresReload?: boolean;
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
    expectedRevision: number,
    value: string,
    ttl?: number
  ): Promise<boolean>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  touch(key: string, ttl: number): Promise<void>;
}

export interface EncryptedState {
  algorithm: "aes-256-gcm";
  payload: string;
  version: 1;
}

export type StorageBackend = "durable-objects" | "memory" | "redis";
