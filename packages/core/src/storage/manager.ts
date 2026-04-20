import { randomBytes } from "node:crypto";

import type {
  FlowInstance,
  FlowInstanceSurface,
  FlowInstanceWaitReason,
  StorageAdapter
} from "./types.js";

function generateInstanceId(): string {
  return `inst_${randomBytes(12).toString("base64url")}`;
}

export class UserFlowStateManager {
  constructor(private readonly storage: StorageAdapter) {}

  async advanceStep(
    key: string,
    newStep: string,
    stateUpdate: Record<string, unknown> = {},
    surface?: FlowInstanceSurface,
    waitReason?: FlowInstanceWaitReason
  ): Promise<FlowInstance> {
    const current = await this.requireInstance(key);
    const next: FlowInstance = {
      ...current,
      currentSurface: surface ?? current.currentSurface,
      expiresAt: Date.now() + this.storage.defaultTTL * 1000,
      lastTransitionAt: Date.now(),
      revision: current.revision + 1,
      state: { ...current.state, ...stateUpdate },
      stepId: newStep,
      ...(waitReason !== undefined ? { waitReason } : {})
    };

    await this.commitWithOptimisticLock(key, current.revision, next);
    return next;
  }

  async cancelInstance(key: string): Promise<void> {
    const current = await this.requireInstance(key);
    await this.commitWithOptimisticLock(key, current.revision, {
      ...current,
      expiresAt: Date.now() + this.storage.defaultTTL * 1000,
      lastTransitionAt: Date.now(),
      revision: current.revision + 1,
      status: "cancelled"
    });
  }

  async completeInstance(key: string): Promise<void> {
    const current = await this.requireInstance(key);
    await this.commitWithOptimisticLock(key, current.revision, {
      ...current,
      expiresAt: Date.now() + this.storage.defaultTTL * 1000,
      lastTransitionAt: Date.now(),
      revision: current.revision + 1,
      status: "completed"
    });
  }

  createStateKey(userId: string, flowId: string): string {
    return `flow:${userId}:${flowId}`;
  }

  createInstanceKey(instanceId: string): string {
    return `instance:${instanceId}`;
  }

  async failInstance(key: string, error: Error): Promise<void> {
    const current = await this.requireInstance(key);
    await this.commitWithOptimisticLock(key, current.revision, {
      ...current,
      expiresAt: Date.now() + this.storage.defaultTTL * 1000,
      lastTransitionAt: Date.now(),
      revision: current.revision + 1,
      state: { ...current.state, lastError: { message: error.message, name: error.name } },
      status: "failed",
      stepId: "failed",
      waitReason: "error"
    });
  }

  async getInstance(key: string): Promise<FlowInstance | null> {
    const raw = await this.storage.get(key);
    return raw ? (JSON.parse(raw) as FlowInstance) : null;
  }

  async resumeFlow(userId: string, flowId: string): Promise<FlowInstance | null> {
    return this.getInstance(this.createStateKey(userId, flowId));
  }

  async startInstance(
    userId: string,
    flowId: string,
    initialStep: string,
    state: Record<string, unknown> = {},
    chatId?: string
  ): Promise<{ instanceId: string; key: string }> {
    const instanceId = generateInstanceId();
    const key = this.createInstanceKey(instanceId);
    const now = Date.now();

    const instance: FlowInstance = {
      chatId,
      createdAt: now,
      currentSurface: "chat",
      expiresAt: now + this.storage.defaultTTL * 1000,
      flowId,
      instanceId,
      lastTransitionAt: now,
      revision: 1,
      state: structuredClone(state),
      status: "active",
      stepId: initialStep,
      userId,
      waitReason: "userInput"
    };

    await this.storage.set(key, JSON.stringify(instance), this.storage.defaultTTL);
    await this.storage.set(
      this.createStateKey(userId, flowId),
      JSON.stringify(instance),
      this.storage.defaultTTL
    );

    return { instanceId, key };
  }

  private async commitWithOptimisticLock(
    key: string,
    expectedRevision: number,
    nextInstance: FlowInstance
  ): Promise<void> {
    const serialized = JSON.stringify(nextInstance);

    if (this.storage.compareAndSet) {
      const updated = await this.storage.compareAndSet(
        key,
        expectedRevision,
        serialized,
        this.storage.defaultTTL
      );

      if (!updated) {
        throw new Error(`Flow instance conflict for key "${key}".`);
      }

      return;
    }

    await this.storage.set(key, serialized, this.storage.defaultTTL);
  }

  private async requireInstance(key: string): Promise<FlowInstance> {
    const raw = await this.storage.get(key);

    if (!raw) {
      throw new Error(`Flow instance "${key}" was not found or already expired.`);
    }

    return JSON.parse(raw) as FlowInstance;
  }
}
