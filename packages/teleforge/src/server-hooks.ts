import { loadTeleforgeApp } from "./config.js";
import { loadTeleforgeFlowServerHooks, loadTeleforgeFlows } from "./discovery.js";
import { getFlowStep, isMiniAppStep, resolveFlowActionKey } from "./flow.js";

import type { DiscoveredFlowStepServerHookModule, DiscoveredFlowModule } from "./discovery.js";
import type { FlowTransitionResult, TeleforgeFlowDefinition } from "./flow.js";
import type { TeleforgeScreenGuardBlock } from "./screens.js";

type AnyFlowDefinition = TeleforgeFlowDefinition<unknown, unknown>;

export const DEFAULT_SERVER_HOOKS_PATH = "/api/teleforge/flow-hooks";

export interface TeleforgeMiniAppServerLoadInput {
  flowId: string;
  routePath: string;
  screenId: string;
  state: unknown;
  stepId: string;
}

export interface TeleforgeMiniAppServerSubmitInput {
  data: unknown;
  flowId: string;
  state: unknown;
  stepId: string;
}

export interface TeleforgeMiniAppServerActionInput {
  action: string;
  flowId: string;
  state: unknown;
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
  load(input: TeleforgeMiniAppServerLoadInput): Promise<TeleforgeMiniAppServerLoadResult>;
  submit(
    input: TeleforgeMiniAppServerSubmitInput
  ): Promise<void | FlowTransitionResult<unknown>>;
}

export interface CreateFetchMiniAppServerBridgeOptions {
  basePath?: string;
  fetch?: typeof fetch;
}

export interface CreateDiscoveredServerHooksHandlerOptions {
  basePath?: string;
  cwd: string;
  services?: unknown;
}

interface TeleforgeDiscoveredServerHooksHandlerState {
  basePath: string;
  flows: readonly DiscoveredFlowModule[];
  hooks: readonly DiscoveredFlowStepServerHookModule[];
  services?: unknown;
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
    };

export function createFetchMiniAppServerBridge(
  options: CreateFetchMiniAppServerBridgeOptions = {}
): TeleforgeMiniAppServerBridge {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("Teleforge could not resolve a fetch implementation for the server bridge.");
  }

  const basePath = options.basePath ?? DEFAULT_SERVER_HOOKS_PATH;

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
        }
      );
      return payload.result;
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
        }
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
        }
      );
      return payload.result;
    }
  });
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
    basePath: options.basePath ?? DEFAULT_SERVER_HOOKS_PATH,
    flows,
    hooks,
    ...(options.services !== undefined ? { services: options.services } : {})
  };

  return async (request: Request) => handleDiscoveredServerHooksRequest(request, state);
}

export async function executeTeleforgeServerHookLoad(options: {
  flow: AnyFlowDefinition;
  hooks?: Iterable<DiscoveredFlowStepServerHookModule>;
  input: TeleforgeMiniAppServerLoadInput;
  services?: unknown;
}): Promise<TeleforgeMiniAppServerLoadResult> {
  const step = getFlowStep(options.flow, options.input.stepId);

  if (!isMiniAppStep(step)) {
    throw new Error(
      `Flow "${options.input.flowId}" step "${options.input.stepId}" is not a Mini App step.`
    );
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
    state: options.input.state,
    stepId: options.input.stepId
  };

  const guardResult: unknown = hook?.guard ? await hook.guard(context) : true;

  if (guardResult !== true) {
    return {
      allow: false,
      block: normalizeServerGuardBlock(guardResult)
    };
  }

  return {
    allow: true,
    ...(hook?.loader ? { loaderData: await hook.loader(context) } : {})
  };
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

async function postServerHookRequest<TResponse extends TeleforgeServerHookResponse>(
  fetchImpl: typeof fetch,
  basePath: string,
  payload: TeleforgeServerHookRequest
): Promise<TResponse> {
  const response = await fetchImpl(basePath, {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json"
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

  return (await response.json()) as TResponse;
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
    const response = await executeDiscoveredServerHookRequest(payload, state);
    return jsonResponse(response);
  } catch (error) {
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
  state: TeleforgeDiscoveredServerHooksHandlerState
): Promise<TeleforgeServerHookResponse> {
  const flow = findDiscoveredFlow(state.flows, request.input.flowId);

  switch (request.kind) {
    case "load":
      return {
        kind: "load",
        result: await executeTeleforgeServerHookLoad({
          flow,
          hooks: state.hooks,
          input: request.input,
          services: state.services
        })
      };
    case "submit":
      return {
        kind: "submit",
        result: await executeTeleforgeServerHookSubmit({
          flow,
          hooks: state.hooks,
          input: request.input,
          services: state.services
        })
      };
    case "action":
      return {
        kind: "action",
        result: await executeTeleforgeServerHookAction({
          flow,
          hooks: state.hooks,
          input: request.input,
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

function jsonResponse(body: TeleforgeServerHookResponse): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json"
    },
    status: 200
  });
}
