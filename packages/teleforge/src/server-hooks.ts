import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { UserFlowStateManager, createFlowStorage } from "@teleforgex/core";

import { loadTeleforgeApp } from "./config.js";
import { loadTeleforgeFlowServerHooks, loadTeleforgeFlows } from "./discovery.js";
import { getFlowStep, isMiniAppStep, resolveFlowActionKey } from "./flow-definition.js";

import type { DiscoveredFlowStepServerHookModule, DiscoveredFlowModule } from "./discovery.js";
import type { FlowTransitionResult, TeleforgeFlowDefinition } from "./flow-definition.js";
import type { TeleforgeScreenGuardBlock } from "./screens.js";
import type {
  TeleforgeMiniAppServerChatHandoffInput,
  TeleforgeMiniAppServerLoadInput,
  TeleforgeMiniAppServerLoadResult,
  TeleforgeMiniAppServerSubmitInput,
  TeleforgeMiniAppServerActionInput
} from "./server-bridge.js";
import type { FlowInstance, TeleforgeAppConfig } from "@teleforgex/core";

export { createFetchMiniAppServerBridge, DEFAULT_SERVER_HOOKS_PATH } from "./server-bridge.js";

export type {
  CreateFetchMiniAppServerBridgeOptions,
  TeleforgeMiniAppServerActionInput,
  TeleforgeMiniAppServerBridge,
  TeleforgeMiniAppServerChatHandoffInput,
  TeleforgeMiniAppServerLoadAllowedResult,
  TeleforgeMiniAppServerLoadBlockedResult,
  TeleforgeMiniAppServerLoadInput,
  TeleforgeMiniAppServerLoadResult,
  TeleforgeMiniAppServerSubmitInput
} from "./server-bridge.js";

type AnyFlowDefinition = TeleforgeFlowDefinition<unknown, unknown>;
type MaybePromise<T> = Promise<T> | T;

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

export interface CreateDiscoveredServerHooksHandlerOptions {
  basePath?: string;
  cwd: string;
  onChatHandoff?: (input: TeleforgeMiniAppServerChatHandoffInput) => MaybePromise<void>;
  services?: unknown;
  storage?: UserFlowStateManager;
  trust?: TeleforgeServerHookTrustOptions;
}

interface TeleforgeDiscoveredServerHooksHandlerState {
  basePath: string;
  flows: readonly DiscoveredFlowModule[];
  hooks: readonly DiscoveredFlowStepServerHookModule[];
  onChatHandoff?: (input: TeleforgeMiniAppServerChatHandoffInput) => MaybePromise<void>;
  services?: unknown;
  storage?: UserFlowStateManager;
  trust: TeleforgeServerHookTrustOptions;
}

export interface TeleforgeServerHookTrustContext {
  actorId: string | null;
  flowId: string;
  kind: "action" | "load" | "submit";
  request: Request;
  state: unknown;
  stateKey: string | null;
  stepId: string;
  storedState: FlowInstance | null;
}

export interface TeleforgeServerHookTrustOptions {
  flowState?: UserFlowStateManager;
  requireActor?: boolean;
  requireStateKey?: boolean;
  resolveActorId?: (request: Request) => MaybePromise<string | null | undefined>;
  validate?: (context: TeleforgeServerHookTrustContext) => MaybePromise<void>;
}

export async function createDiscoveredServerHooksHandler(
  options: CreateDiscoveredServerHooksHandlerOptions
): Promise<(request: Request) => Promise<Response | null>> {
  const loadedApp = await loadTeleforgeApp(options.cwd);
  const flows = await loadTeleforgeFlows({
    app: loadedApp.app,
    cwd: options.cwd
  });
  const hooks = await loadTeleforgeFlowServerHooks({
    app: loadedApp.app,
    cwd: options.cwd
  });
  const state: TeleforgeDiscoveredServerHooksHandlerState = {
    basePath: options.basePath ?? "/api/teleforge/flow-hooks",
    flows,
    hooks,
    ...(options.onChatHandoff ? { onChatHandoff: options.onChatHandoff } : {}),
    ...(options.services !== undefined ? { services: options.services } : {}),
    ...(options.storage ? { storage: options.storage } : {}),
    trust: options.trust ?? {}
  };

  return async (request: Request) => handleDiscoveredServerHooksRequest(request, state);
}

export interface StartTeleforgeServerOptions {
  /**
   * Pre-loaded app config. When provided, the bootstrap skips config loading
   * and uses this object directly.
   */
  app?: TeleforgeAppConfig;
  basePath?: string;
  cwd?: string;
  onChatHandoff?: (input: TeleforgeMiniAppServerChatHandoffInput) => MaybePromise<void>;
  port?: number;
  services?: unknown;
  storage?: UserFlowStateManager;
  trust?: TeleforgeServerHookTrustOptions;
}

export interface StartTeleforgeServerResult {
  port: number;
  stop: () => void;
  url: string;
}

/**
 * High-level server bootstrap that loads config, creates the discovered server
 * hooks handler, and starts a local HTTP server on the configured port.
 *
 * This wraps {@link createDiscoveredServerHooksHandler} and keeps it available
 * as the lower-level escape hatch for advanced use cases.
 */
export async function startTeleforgeServer(
  options: StartTeleforgeServerOptions = {}
): Promise<StartTeleforgeServerResult> {
  const cwd = options.cwd ?? process.cwd();
  const app = options.app ?? (await loadTeleforgeApp(cwd)).app;

  const storage =
    options.storage ??
    new UserFlowStateManager(
      createFlowStorage({
        backend: "memory",
        defaultTTL: 900,
        namespace: app.app.id
      })
    );

  const basePath = options.basePath ?? "/api/teleforge/flow-hooks";
  const requestedPort = options.port ?? 3100;

  const hooksHandler = await createDiscoveredServerHooksHandler({
    basePath,
    cwd,
    onChatHandoff: options.onChatHandoff,
    services: options.services,
    storage,
    trust: options.trust
  });

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*"
  };

  let resolvedPort = requestedPort;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url?.startsWith(basePath)) {
      try {
        const body = await readIncomingMessageBody(req);
        // Use the actual bound port so Request URL is correct even when port: 0
        const request = new Request(`http://localhost:${resolvedPort}${req.url}`, {
          body,
          headers: { "content-type": req.headers["content-type"] ?? "application/json" },
          method: "POST"
        });

        const response = await hooksHandler(request);

        if (response) {
          const headers = { ...Object.fromEntries(response.headers.entries()), ...corsHeaders };
          res.writeHead(response.status, headers);
          res.end(await response.text());
        } else {
          res.writeHead(404, corsHeaders);
          res.end("Not found");
        }
      } catch (error) {
        console.error("[teleforge:server] unexpected error handling request:", error);
        res.writeHead(500, corsHeaders);
        res.end("Teleforge server hook error");
      }
      return;
    }

    res.writeHead(404, corsHeaders);
    res.end("Not found");
  });

  resolvedPort = await new Promise<number>((resolve) => {
    server.listen(requestedPort, () => {
      const address = server.address();
      const actualPort =
        typeof address === "object" && address !== null ? address.port : requestedPort;
      console.log(
        `[teleforge:server] hooks server listening on ${basePath} at port ${actualPort}`
      );
      resolve(actualPort);
    });
  });

  return {
    port: resolvedPort,
    stop: () => {
      server.close();
    },
    url: `http://localhost:${resolvedPort}`
  };
}

function readIncomingMessageBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function executeTeleforgeServerHookLoad(options: {
  flow: AnyFlowDefinition;
  hooks?: Iterable<DiscoveredFlowStepServerHookModule>;
  input: TeleforgeMiniAppServerLoadInput;
  services?: unknown;
  storage?: UserFlowStateManager;
}): Promise<TeleforgeMiniAppServerLoadResult> {
  const step = getFlowStep(options.flow, options.input.stepId);

  if (!isMiniAppStep(step)) {
    throw new Error(
      `Flow "${options.input.flowId}" step "${options.input.stepId}" is not a Mini App step.`
    );
  }

  let persistedState = options.input.state;
  if (options.storage && options.input.stateKey) {
    const stored = await options.storage.getInstance(options.input.stateKey);
    if (stored) {
      persistedState =
        stored.state && Object.keys(stored.state).length > 0 ? stored.state : options.input.state;
    }
  }

  const hook = createServerHookIndex(options.hooks).get(
    createServerHookKey(options.input.flowId, options.input.stepId)
  );
  const context = {
    flow: options.flow,
    flowId: options.input.flowId,
    routePath: options.input.routePath,
    screenId: options.input.screenId,
    services: options.services,
    state: persistedState,
    stepId: options.input.stepId
  };

  const guardResult: unknown = hook?.guard ? await hook.guard(context) : true;

  if (guardResult !== true) {
    return {
      allow: false,
      block: normalizeServerGuardBlock(guardResult),
      ...(persistedState !== undefined ? { state: persistedState } : {})
    };
  }

  const result: TeleforgeMiniAppServerLoadResult = {
    allow: true,
    ...(hook?.loader ? { loaderData: await hook.loader(context) } : {}),
    ...(persistedState !== undefined ? { state: persistedState } : {})
  };

  return result;
}

export async function executeTeleforgeServerHookSubmit(options: {
  flow: AnyFlowDefinition;
  hooks?: Iterable<DiscoveredFlowStepServerHookModule>;
  input: TeleforgeMiniAppServerSubmitInput;
  services?: unknown;
}): Promise<void | FlowTransitionResult<unknown>> {
  const step = getFlowStep(options.flow, options.input.stepId);

  if (!isMiniAppStep(step)) {
    throw new Error(
      `Flow "${options.input.flowId}" step "${options.input.stepId}" is not a Mini App step.`
    );
  }

  const hook = createServerHookIndex(options.hooks).get(
    createServerHookKey(options.input.flowId, options.input.stepId)
  );
  const handler = hook?.onSubmit ?? step.onSubmit;

  if (!handler) {
    throw new Error(
      `Flow "${options.input.flowId}" step "${options.input.stepId}" does not define a server submit hook.`
    );
  }

  return (await handler({
    data: options.input.data,
    flow: options.flow,
    services: options.services,
    state: options.input.state
  })) as void | FlowTransitionResult<unknown>;
}

export async function executeTeleforgeServerHookAction(options: {
  flow: AnyFlowDefinition;
  hooks?: Iterable<DiscoveredFlowStepServerHookModule>;
  input: TeleforgeMiniAppServerActionInput;
  services?: unknown;
}): Promise<void | FlowTransitionResult<unknown>> {
  const step = getFlowStep(options.flow, options.input.stepId);

  if (!isMiniAppStep(step)) {
    throw new Error(
      `Flow "${options.input.flowId}" step "${options.input.stepId}" is not a Mini App step.`
    );
  }

  const hook = createServerHookIndex(options.hooks).get(
    createServerHookKey(options.input.flowId, options.input.stepId)
  );
  const actionDefinition = (step.actions ?? []).find(
    (candidate) => resolveFlowActionKey(candidate) === options.input.action
  );
  const handler = hook?.actions[options.input.action] ?? actionDefinition?.handler;

  if (!handler) {
    throw new Error(
      `Flow "${options.input.flowId}" step "${options.input.stepId}" action "${options.input.action}" does not define a server action hook.`
    );
  }

  return (await handler({
    flow: options.flow,
    services: options.services,
    state: options.input.state
  })) as void | FlowTransitionResult<unknown>;
}

async function handleDiscoveredServerHooksRequest(
  request: Request,
  state: TeleforgeDiscoveredServerHooksHandlerState
): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method !== "POST" || url.pathname !== state.basePath) {
    return null;
  }

  try {
    const payload = (await request.json()) as TeleforgeServerHookRequest;
    const response = await executeDiscoveredServerHookRequest(payload, request, state);
    return jsonResponse(response);
  } catch (error) {
    if (error instanceof TeleforgeServerHookRequestError) {
      return new Response(error.message, {
        status: error.statusCode
      });
    }

    return new Response(
      error instanceof Error ? error.message : "Teleforge server hook execution failed.",
      {
        status: 400
      }
    );
  }
}

async function executeDiscoveredServerHookRequest(
  request: TeleforgeServerHookRequest,
  sourceRequest: Request,
  state: TeleforgeDiscoveredServerHooksHandlerState
): Promise<TeleforgeServerHookResponse> {
  if (request.kind === "chatHandoff") {
    console.log("[teleforge:server-hooks] chatHandoff request received:", {
      stepId: request.input.stepId,
      stateKey: request.input.stateKey
    });
    if (!state.onChatHandoff) {
      throw new TeleforgeServerHookRequestError(
        "Teleforge server-hook handler does not have a chat handoff handler configured.",
        501
      );
    }

    await state.onChatHandoff(request.input);
    console.log("[teleforge:server-hooks] chatHandoff onChatHandoff completed");
    return { kind: "chatHandoff", result: undefined };
  }

  const flow = findDiscoveredFlow(state.flows, request.input.flowId);
  const trusted = await resolveTrustedExecutionInput(sourceRequest, request, state.trust);

  switch (request.kind) {
    case "load":
      return {
        kind: "load",
        result: await executeTeleforgeServerHookLoad({
          flow,
          hooks: state.hooks,
          input: {
            ...request.input,
            state: trusted.state,
            ...(trusted.stateKey ? { stateKey: trusted.stateKey } : {})
          },
          services: state.services,
          storage: state.storage
        })
      };
    case "submit":
      return {
        kind: "submit",
        result: await executeTeleforgeServerHookSubmit({
          flow,
          hooks: state.hooks,
          input: {
            ...request.input,
            state: trusted.state,
            ...(trusted.stateKey ? { stateKey: trusted.stateKey } : {})
          },
          services: state.services
        })
      };
    case "action":
      return {
        kind: "action",
        result: await executeTeleforgeServerHookAction({
          flow,
          hooks: state.hooks,
          input: {
            ...request.input,
            state: trusted.state,
            ...(trusted.stateKey ? { stateKey: trusted.stateKey } : {})
          },
          services: state.services
        })
      };
  }
}

function createServerHookIndex(
  hooks: Iterable<DiscoveredFlowStepServerHookModule> | undefined
): ReadonlyMap<string, DiscoveredFlowStepServerHookModule> {
  return new Map(
    Array.from(hooks ?? [], (hook) => [createServerHookKey(hook.flowId, hook.stepId), hook])
  );
}

function createServerHookKey(flowId: string, stepId: string): string {
  return `${flowId}:${stepId}`;
}

function findDiscoveredFlow(
  flows: readonly DiscoveredFlowModule[],
  flowId: string
): AnyFlowDefinition {
  const flow = flows.find((candidate) => candidate.flow.id === flowId)?.flow;

  if (!flow) {
    throw new Error(`Teleforge could not find flow "${flowId}" for server-hook execution.`);
  }

  return flow;
}

function normalizeServerGuardBlock(result: unknown): TeleforgeScreenGuardBlock {
  if (result === false) {
    return {
      allow: false
    };
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "allow" in result &&
    result.allow === false
  ) {
    return result as TeleforgeScreenGuardBlock;
  }

  return {
    allow: false
  };
}

async function resolveTrustedExecutionInput(
  request: Request,
  hookRequest: Exclude<TeleforgeServerHookRequest, { kind: "chatHandoff" }>,
  trust: TeleforgeServerHookTrustOptions
): Promise<{ state: unknown; stateKey: string | null }> {
  const actorId = await resolveActorId(request, trust.resolveActorId);
  const stateKey =
    "stateKey" in hookRequest.input && typeof hookRequest.input.stateKey === "string"
      ? hookRequest.input.stateKey
      : null;

  if (trust.requireActor && !actorId) {
    throw new TeleforgeServerHookRequestError(
      "Teleforge server-hook request requires an authenticated actor.",
      401
    );
  }

  if (trust.requireStateKey && !stateKey) {
    throw new TeleforgeServerHookRequestError(
      "Teleforge server-hook request requires a stateKey.",
      400
    );
  }

  let storedState: FlowInstance | null = null;
  let authoritativeState = hookRequest.input.state;

  if (trust.flowState && stateKey) {
    storedState = await trust.flowState.getInstance(stateKey);

    if (!storedState) {
      throw new TeleforgeServerHookRequestError(
        `Teleforge flow state "${stateKey}" was not found or expired.`,
        404
      );
    }

    if (storedState.flowId !== hookRequest.input.flowId) {
      throw new TeleforgeServerHookRequestError(
        `Flow state "${stateKey}" does not belong to flow "${hookRequest.input.flowId}".`,
        409
      );
    }

    if (storedState.stepId !== hookRequest.input.stepId) {
      throw new TeleforgeServerHookRequestError(
        `Flow state "${stateKey}" is on step "${storedState.stepId}", not "${hookRequest.input.stepId}".`,
        409
      );
    }

    if (actorId && storedState.userId !== actorId) {
      throw new TeleforgeServerHookRequestError(
        `Authenticated actor "${actorId}" does not own flow state "${stateKey}".`,
        403
      );
    }

    const storedFlowState =
      storedState.state && Object.keys(storedState.state).length > 0
        ? structuredClone(storedState.state)
        : undefined;

    if (storedFlowState !== undefined) {
      if (
        hookRequest.input.state !== undefined &&
        !isJsonEqual(hookRequest.input.state, storedFlowState)
      ) {
        throw new TeleforgeServerHookRequestError(
          `Flow state "${stateKey}" does not match the provided runtime state.`,
          409
        );
      }

      authoritativeState = storedFlowState;
    }
  }

  const trustContext: TeleforgeServerHookTrustContext = {
    actorId,
    flowId: hookRequest.input.flowId,
    kind: hookRequest.kind,
    request,
    state: authoritativeState,
    stateKey,
    stepId: hookRequest.input.stepId,
    storedState
  };

  await trust.validate?.(trustContext);

  return {
    state: authoritativeState,
    stateKey
  };
}

async function resolveActorId(
  request: Request,
  resolver: TeleforgeServerHookTrustOptions["resolveActorId"]
): Promise<string | null> {
  if (!resolver) {
    return null;
  }

  const resolved = await resolver(request);
  const actorId = typeof resolved === "string" ? resolved.trim() : "";
  return actorId.length > 0 ? actorId : null;
}

function isJsonEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

class TeleforgeServerHookRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = "TeleforgeServerHookRequestError";
  }
}

function jsonResponse(body: TeleforgeServerHookResponse): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json"
    },
    status: 200
  });
}
