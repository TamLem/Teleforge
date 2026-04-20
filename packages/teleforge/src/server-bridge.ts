import type { FlowTransitionResult } from "./flow-definition.js";
import type { TeleforgeScreenGuardBlock } from "./screens.js";

type MaybePromise<T> = Promise<T> | T;

export const DEFAULT_SERVER_HOOKS_PATH = "/api/teleforge/flow-hooks";

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
  block: TeleforgeScreenGuardBlock;
  state?: unknown;
}

export type TeleforgeMiniAppServerLoadResult =
  | TeleforgeMiniAppServerLoadAllowedResult
  | TeleforgeMiniAppServerLoadBlockedResult;

export interface TeleforgeMiniAppServerBridge {
  action(input: TeleforgeMiniAppServerActionInput): Promise<void | FlowTransitionResult<unknown>>;
  chatHandoff(input: TeleforgeMiniAppServerChatHandoffInput): Promise<void>;
  load(input: TeleforgeMiniAppServerLoadInput): Promise<TeleforgeMiniAppServerLoadResult>;
  submit(
    input: TeleforgeMiniAppServerSubmitInput
  ): Promise<void | FlowTransitionResult<unknown>>;
}

export interface CreateFetchMiniAppServerBridgeOptions {
  basePath?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit | (() => MaybePromise<HeadersInit | undefined> | undefined);
}

type TeleforgeServerHookRequest =
  | {
      kind: "load";
      input: TeleforgeMiniAppServerLoadInput;
    }
  | {
      kind: "submit";
      input: TeleforgeMiniAppServerSubmitInput;
    }
  | {
      kind: "action";
      input: TeleforgeMiniAppServerActionInput;
    }
  | {
      kind: "chatHandoff";
      input: TeleforgeMiniAppServerChatHandoffInput;
    };

type TeleforgeServerHookResponse =
  | {
      kind: "load";
      result: TeleforgeMiniAppServerLoadResult;
    }
  | {
      kind: "submit";
      result: void | FlowTransitionResult<unknown>;
    }
  | {
      kind: "action";
      result: void | FlowTransitionResult<unknown>;
    }
  | {
      kind: "chatHandoff";
      result: void;
    };

export function createFetchMiniAppServerBridge(
  options: CreateFetchMiniAppServerBridgeOptions = {}
): TeleforgeMiniAppServerBridge {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("Teleforge could not resolve a fetch implementation for the server bridge.");
  }

  const basePath = options.basePath ?? DEFAULT_SERVER_HOOKS_PATH;
  const resolveHeaders = options.headers;

  return Object.freeze({
    action: async (
      input: TeleforgeMiniAppServerActionInput
    ): Promise<void | FlowTransitionResult<unknown>> => {
      const payload = await postServerHookRequest<Extract<TeleforgeServerHookResponse, { kind: "action" }>>(
        fetchImpl,
        basePath,
        {
          input,
          kind: "action"
        },
        resolveHeaders
      );
      return payload.result;
    },
    chatHandoff: async (
      input: TeleforgeMiniAppServerChatHandoffInput
    ): Promise<void> => {
      console.log("[teleforge:server-bridge] chatHandoff request:", { basePath, stepId: input.stepId });
      await postServerHookRequest<Extract<TeleforgeServerHookResponse, { kind: "chatHandoff" }>>(
        fetchImpl,
        basePath,
        {
          input,
          kind: "chatHandoff"
        },
        resolveHeaders
      );
      console.log("[teleforge:server-bridge] chatHandoff response received");
    },
    load: async (
      input: TeleforgeMiniAppServerLoadInput
    ): Promise<TeleforgeMiniAppServerLoadResult> => {
      const payload = await postServerHookRequest<Extract<TeleforgeServerHookResponse, { kind: "load" }>>(
        fetchImpl,
        basePath,
        {
          input,
          kind: "load"
        },
        resolveHeaders
      );
      return payload.result;
    },
    submit: async (
      input: TeleforgeMiniAppServerSubmitInput
    ): Promise<void | FlowTransitionResult<unknown>> => {
      const payload = await postServerHookRequest<Extract<TeleforgeServerHookResponse, { kind: "submit" }>>(
        fetchImpl,
        basePath,
        {
          input,
          kind: "submit"
        },
        resolveHeaders
      );
      return payload.result;
    }
  });
}

async function postServerHookRequest<TResponse extends TeleforgeServerHookResponse>(
  fetchImpl: typeof fetch,
  basePath: string,
  payload: TeleforgeServerHookRequest,
  resolveHeaders: CreateFetchMiniAppServerBridgeOptions["headers"]
): Promise<TResponse> {
  const headers = await resolveBridgeHeaders(resolveHeaders);
  console.log("[teleforge:server-bridge] POST", basePath, payload.kind);
  const response = await fetchImpl(basePath, {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      ...headers
    },
    method: "POST"
  });
  console.log("[teleforge:server-bridge] response status:", response.status);

  if (!response.ok) {
    const message = await response.text();
    console.log("[teleforge:server-bridge] error response:", message);
    throw new Error(
      message.trim().length > 0
        ? message
        : `Teleforge server bridge request failed with ${response.status}.`
    );
  }

  return (await response.json()) as TResponse;
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