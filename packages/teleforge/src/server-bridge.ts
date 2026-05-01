import type { ActionResult } from "@teleforgex/core";

type MaybePromise<T> = Promise<T> | T;

export class TeleforgeActionServerBridgeError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, body?: unknown, code?: string, details?: unknown) {
    super(message);
    this.name = "TeleforgeActionServerBridgeError";
    this.status = status;
    this.body = body;
    this.code = code;
    this.details = details;
  }
}

export const DEFAULT_SERVER_HOOKS_PATH = "/api/teleforge/actions";

export interface TeleforgeActionServerLoadInput {
  flowId: string;
  screenId: string;
  signedContext: string;
  params?: Record<string, string>;
}

export interface TeleforgeActionServerLoadResult {
  data?: unknown;
  loaderFound?: boolean;
  session?: unknown;
}

export interface TeleforgeActionServerRunActionInput {
  actionId: string;
  flowId: string;
  payload?: unknown;
  signedContext: string;
}

export interface TeleforgeActionServerHandoffInput {
  message: string;
  signedContext: string;
}

export interface TeleforgeActionServerBridge {
  handoff(input: TeleforgeActionServerHandoffInput): Promise<void>;
  loadScreenContext(
    input: TeleforgeActionServerLoadInput
  ): Promise<TeleforgeActionServerLoadResult>;
  runAction(input: TeleforgeActionServerRunActionInput): Promise<void | ActionResult>;
}

export interface CreateFetchMiniAppServerBridgeOptions {
  basePath?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit | (() => MaybePromise<HeadersInit | undefined> | undefined);
}

export function createFetchMiniAppServerBridge(
  options: CreateFetchMiniAppServerBridgeOptions = {}
): TeleforgeActionServerBridge {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("Teleforge could not resolve a fetch implementation for the server bridge.");
  }

  const basePath = options.basePath ?? DEFAULT_SERVER_HOOKS_PATH;
  const resolveHeaders = options.headers;

  return Object.freeze({
    handoff: async (input: TeleforgeActionServerHandoffInput): Promise<void> => {
      await postBridge(fetchImpl, basePath, { input, kind: "handoff" }, resolveHeaders);
    },

    loadScreenContext: async (
      input: TeleforgeActionServerLoadInput
    ): Promise<TeleforgeActionServerLoadResult> => {
      return postBridge(
        fetchImpl,
        basePath,
        { input, kind: "loadScreenContext" },
        resolveHeaders
      ) as Promise<TeleforgeActionServerLoadResult>;
    },

    runAction: async (input: TeleforgeActionServerRunActionInput): Promise<ActionResult> => {
      const response = await postBridge(
        fetchImpl,
        basePath,
        { input, kind: "runAction" },
        resolveHeaders
      );
      return (response ?? { data: {} }) as ActionResult;
    }
  });
}

async function postBridge(
  fetchImpl: typeof fetch,
  basePath: string,
  payload: unknown,
  resolveHeaders: CreateFetchMiniAppServerBridgeOptions["headers"]
): Promise<unknown> {
  const headers = await resolveBridgeHeaders(resolveHeaders);
  const body = JSON.stringify(payload);
  const parsed = payload as Record<string, unknown>;
  const input = parsed?.input as Record<string, unknown> | undefined;
  const signedContext = input?.signedContext;
  console.log("[teleforge:bridge] POST", basePath, {
    kind: parsed?.kind,
    hasSignedContext: Boolean(signedContext),
    contextPrefix: typeof signedContext === "string" ? signedContext.slice(0, 30) : undefined,
    actionId: input?.actionId,
    screenId: input?.screenId
  });
  const response = await fetchImpl(basePath, {
    body,
    headers: {
      "content-type": "application/json",
      ...headers
    },
    method: "POST"
  });

  if (!response.ok) {
    const text = await response.text();
    let body: unknown = text;
    let code: string | undefined;
    let details: unknown;
    let errorMessage: string | undefined;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      body = parsed;
      if (parsed && typeof parsed === "object" && "error" in parsed) {
        const err = parsed.error as Record<string, unknown> | undefined;
        code = typeof err?.code === "string" ? err.code : undefined;
        details = err?.details;
        errorMessage = typeof err?.message === "string" ? err.message : undefined;
      }
    } catch {
      // not JSON, use raw text
    }
    const message =
      errorMessage ??
      (typeof body === "object" && body !== null && "message" in body
        ? String((body as Record<string, unknown>).message)
        : typeof body === "string" && body.length > 0
          ? body
          : `Teleforge server bridge request failed with ${response.status}.`);
    throw new TeleforgeActionServerBridgeError(message, response.status, body, code, details);
  }

  return response.json();
}

async function resolveBridgeHeaders(
  resolveHeaders: CreateFetchMiniAppServerBridgeOptions["headers"]
): Promise<Record<string, string>> {
  if (!resolveHeaders) {
    return {};
  }

  const raw = typeof resolveHeaders === "function" ? await resolveHeaders() : resolveHeaders;
  const headers = new Headers(raw);
  const normalized: Record<string, string> = {};

  headers.forEach((value, key) => {
    normalized[key] = value;
  });

  return normalized;
}
