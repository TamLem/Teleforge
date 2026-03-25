import { createHash } from "node:crypto";

import type { StorageAdapter, UserFlowState } from "./types.js";

/**
 * Manages the lifecycle of coordinated user flow state on top of a storage adapter.
 */
export class UserFlowStateManager {
  constructor(private readonly storage: StorageAdapter) {}

  async advanceStep(
    key: string,
    newStep: string,
    payloadUpdate: Record<string, unknown> = {}
  ): Promise<UserFlowState> {
    const current = await this.requireState(key);
    const nextState = this.withNextExpiry({
      ...current,
      payload: {
        ...current.payload,
        ...payloadUpdate
      },
      stepId: newStep,
      version: current.version + 1
    });

    await this.commitWithOptimisticLock(key, current.version, nextState);

    return nextState;
  }

  async completeFlow(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  createStateKey(userId: string, flowId: string): string {
    const digest = createHash("sha256").update(`${userId}:${flowId}`).digest("hex").slice(0, 24);

    return `flow:${digest}`;
  }

  async failFlow(key: string, error: Error): Promise<void> {
    const current = await this.requireState(key);

    await this.commitWithOptimisticLock(
      key,
      current.version,
      this.withNextExpiry({
        ...current,
        payload: {
          ...current.payload,
          lastError: {
            message: error.message,
            name: error.name
          }
        },
        stepId: "failed",
        version: current.version + 1
      })
    );
  }

  async getState(key: string): Promise<UserFlowState | null> {
    return this.storage.get(key);
  }

  async resumeFlow(userId: string, flowId: string): Promise<UserFlowState | null> {
    return this.storage.get(this.createStateKey(userId, flowId));
  }

  async startFlow(
    userId: string,
    flowId: string,
    initialStep: string,
    payload: Record<string, unknown> = {},
    chatId?: string
  ): Promise<string> {
    const key = this.createStateKey(userId, flowId);
    const now = Date.now();

    await this.storage.set(key, {
      ...(chatId ? { chatId } : {}),
      createdAt: now,
      expiresAt: now + this.storage.defaultTTL * 1000,
      flowId,
      payload: structuredClone(payload),
      stepId: initialStep,
      userId,
      version: 1
    });

    return key;
  }

  private async commitWithOptimisticLock(
    key: string,
    expectedVersion: number,
    nextState: UserFlowState
  ): Promise<void> {
    if (this.storage.compareAndSet) {
      const updated = await this.storage.compareAndSet(
        key,
        expectedVersion,
        nextState,
        this.storage.defaultTTL
      );

      if (!updated) {
        throw new Error(`Flow state conflict for key "${key}".`);
      }

      return;
    }

    await this.storage.set(key, nextState, this.storage.defaultTTL);
  }

  private async requireState(key: string): Promise<UserFlowState> {
    const state = await this.storage.get(key);

    if (!state) {
      throw new Error(`Flow state "${key}" was not found or already expired.`);
    }

    return state;
  }

  private withNextExpiry(state: UserFlowState): UserFlowState {
    return {
      ...state,
      expiresAt: Date.now() + this.storage.defaultTTL * 1000
    };
  }
}
