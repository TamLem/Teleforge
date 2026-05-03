import { createSignedActionContext, validateActionContext } from "@teleforge/core";

import type { ActionContextToken } from "@teleforge/core";

export interface CreateActionContextOptions {
  appId: string;
  flowId: string;
  screenId?: string;
  userId: string;
  subject?: Record<string, unknown>;
  allowedActions?: string[];
  ttlSeconds?: number;
  secret: string;
}

export interface CreateActionCallbackOptions {
  actionId: string;
  allowedActions?: string[];
  appId: string;
  flowId: string;
  screenId?: string;
  secret: string;
  subject?: Record<string, unknown>;
  text: string;
  ttlSeconds?: number;
  userId: string;
}

export function createSignedActionContextToken(options: CreateActionContextOptions): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds ?? 900;

  const token: ActionContextToken = {
    allowedActions: options.allowedActions,
    appId: options.appId,
    expiresAt: now + ttl,
    flowId: options.flowId,
    issuedAt: now,
    nonce: randomNonce(),
    screenId: options.screenId,
    subject: options.subject,
    userId: options.userId
  };

  return createSignedActionContext(token, options.secret);
}

export function createActionCallbackData(options: CreateActionCallbackOptions): string {
  const token = createSignedActionContextToken({
    allowedActions: options.allowedActions ?? [options.actionId],
    appId: options.appId,
    flowId: options.flowId,
    screenId: options.screenId,
    secret: options.secret,
    subject: options.subject,
    ttlSeconds: options.ttlSeconds,
    userId: options.userId
  });

  return JSON.stringify({
    a: options.actionId,
    s: token
  });
}

export function verifyActionCallback(
  data: string,
  secret: string
): { actionId: string; context: ActionContextToken } | null {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;

    if (typeof parsed.a !== "string" || typeof parsed.s !== "string") {
      return null;
    }

    const context = validateActionContext(parsed.s, secret, {
      allowedAction: parsed.a
    });

    if (!context) {
      return null;
    }

    return { actionId: parsed.a, context };
  } catch {
    return null;
  }
}

export { validateActionContext } from "@teleforge/core";

function randomNonce(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
