import type { ActionResult } from "@teleforgex/core";

type MaybePromise<T> = Promise<T> | T;

export const DEFAULT_SERVER_HOOKS_PATH = "/api/teleforge/actions";

export interface TeleforgeActionServerLoadInput {
  flowId: string;
  screenId: string;
  signedContext: string;
}

export interface TeleforgeActionServerLoadResult {
  data?: unknown;
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
  loadScreenContext(input: TeleforgeActionServerLoadInput): Promise<TeleforgeActionServerLoadResult>;
  runAction(input: TeleforgeActionServerRunActionInput): Promise<void | ActionResult>;
}

export interface CreateFetchMiniAppServerBridgeOptions {
  basePath?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit | (() => MaybePromise<HeadersInit | undefined> | undefined);
}

// Legacy types kept for compat with modules not yet rewritten
export interface TeleforgeMiniAppServerLoadInput {
  flowId: string;
  routePath: string;
  screenId: string;
  state: unknown;
  stateKey?: string;
  stepId: string;
}

export interface TeleforgeMiniAppServerSubmitInput {
  data: unknown;
  flowId: string;
  state: unknown;
  stateKey?: string;
  stepId: string;
}

export interface TeleforgeMiniAppServerActionInput {
  action: string;
  flowId: string;
  state: unknown;
  stateKey?: string;
  stepId: string;
}

export interface TeleforgeMiniAppServerChatHandoffInput {
  flowContext: string;
  state: unknown;
  stateKey: string;
  stepId: string;
}

export interface TeleforgeMiniAppServerLoadAllowedResult {
  allow: true;
  loaderData?: unknown;
  state?: unknown;
}

export interface TeleforgeMiniAppServerLoadBlockedResult {
  allow: false;
  block: { allow: false; reason?: string };
  state?: unknown;
}

export type TeleforgeMiniAppServerLoadResult =
  | TeleforgeMiniAppServerLoadAllowedResult
  | TeleforgeMiniAppServerLoadBlockedResult;

export interface TeleforgeMiniAppServerBridge {
  action(input: TeleforgeMiniAppServerActionInput): Promise<void | unknown>;
  chatHandoff(input: TeleforgeMiniAppServerChatHandoffInput): Promise<void>;
  load(input: TeleforgeMiniAppServerLoadInput): Promise<TeleforgeMiniAppServerLoadResult>;
  submit(input: TeleforgeMiniAppServerSubmitInput): Promise<void | unknown>;
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

    loadScreenContext: async (input: TeleforgeActionServerLoadInput): Promise<TeleforgeActionServerLoadResult> => {
      return postBridge(fetchImpl, basePath, { input, kind: "loadScreenContext" }, resolveHeaders) as Promise<TeleforgeActionServerLoadResult>;
    },

    runAction: async (input: TeleforgeActionServerRunActionInput): Promise<ActionResult> => {
      const response = await postBridge(fetchImpl, basePath, { input, kind: "runAction" }, resolveHeaders);
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
  const response = await fetchImpl(basePath, {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      ...headers
    },
    method: "POST"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message.trim().length > 0
        ? message
        : `Teleforge server bridge request failed with ${response.status}.`
    );
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
