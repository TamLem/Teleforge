import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  MemorySessionStorageAdapter,
  SessionManager,
  validateActionContext,
  type ActionContextToken
} from "@teleforgex/core";

import { loadTeleforgeApp } from "./config.js";
import { loadActionRegistry, loadScreenLoaders, loadTeleforgeFlows, createSignForActionContext } from "./discovery.js";

import type { DiscoveredFlowModule } from "./discovery.js";
import type { ActionFlowActionDefinition, ActionFlowDefinition } from "./flow-definition.js";
import type { LoaderRegistry, TeleforgeScreenDefinition } from "./screens.js";
import type { TeleforgeAppConfig } from "@teleforgex/core";

export { createFetchMiniAppServerBridge, DEFAULT_SERVER_HOOKS_PATH } from "./server-bridge.js";

type MaybePromise<T> = Promise<T> | T;

export interface TeleforgeActionServerHooksHandler {
  handleRequest(request: Request): Promise<Response | null>;
}

export interface CreateActionServerHooksHandlerOptions {
  basePath?: string;
  cwd: string;
  flowSecret: string;
  miniAppUrl?: string;
  onChatHandoff?: (input: { message: string; context: ActionContextToken; replyMarkup?: Record<string, unknown> }) => MaybePromise<void>;
  screens?: ReadonlyMap<string, TeleforgeScreenDefinition>;
  loaders?: LoaderRegistry;
  services?: unknown;
  sessionManager?: SessionManager;
  trust?: ActionServerHookTrustOptions;
}

export interface ActionServerHookTrustOptions {
  requireActor?: boolean;
  resolveActorId?: (request: Request) => MaybePromise<string | null>;
  validate?: (context: ActionServerHookTrustContext) => MaybePromise<void>;
}

export interface ActionServerHookTrustContext {
  actorId: string | null;
  flowId: string;
  screenId?: string;
  actionId?: string;
  signedContext: ActionContextToken;
  request: Request;
}

export async function createActionServerHooksHandler(
  options: CreateActionServerHooksHandlerOptions
): Promise<TeleforgeActionServerHooksHandler> {
  const loadedApp = await loadTeleforgeApp(options.cwd);
  const flows = await loadTeleforgeFlows({ app: loadedApp.app, cwd: options.cwd });
  const actions = loadActionRegistry(flows);

  const basePath = options.basePath ?? "/api/teleforge/actions";
  const services = options.services;
  const sessionManager =
    options.sessionManager ??
    new SessionManager(
      new MemorySessionStorageAdapter({
        defaultTTL: 900,
        namespace: loadedApp.app.app.id
      })
    );
  const flowSecret = options.flowSecret;
  const resolvedMiniAppUrl = options.miniAppUrl ?? process.env.MINI_APP_URL ?? "http://localhost:3000";
  const screens = options.screens;
  const loaders = options.loaders ?? await loadScreenLoaders({ app: loadedApp.app, cwd: options.cwd });
  const trust = options.trust ?? {};
  const onChatHandoff = options.onChatHandoff;
  const appId = loadedApp.app.app.id;

  return {
    async handleRequest(request: Request) {
      const url = new URL(request.url);

      if (request.method !== "POST" || url.pathname !== basePath) {
        return null;
      }

      try {
        const payload = (await request.json()) as ActionServerHookRequest;
        const response = await executeActionServerHook({
          actions,
          appId,
          flowSecret,
          flows,
          loaders,
          miniAppUrl: resolvedMiniAppUrl,
          onChatHandoff,
          payload,
          request,
          screens,
          services,
          sessionManager,
          trust
        });

        return new Response(JSON.stringify(response), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      } catch (error) {
        if (error instanceof ActionServerHookRequestError) {
          return new Response(error.message, { status: error.statusCode });
        }

        return new Response(
          error instanceof Error ? error.message : "Action server hook execution failed.",
          { status: 400 }
        );
      }
    }
  };
}

type ActionServerHookRequest =
  | { kind: "loadScreenContext"; input: { flowId: string; screenId: string; signedContext: string; params?: Record<string, string> } }
  | { kind: "runAction"; input: { flowId: string; actionId: string; signedContext: string; payload?: unknown } }
  | { kind: "handoff"; input: { signedContext: string; message: string } };

interface ExecuteActionServerHookOptions {
  actions: ReadonlyMap<string, ActionFlowActionDefinition>;
  appId: string;
  flowSecret: string;
  flows: readonly DiscoveredFlowModule[];
  loaders?: LoaderRegistry;
  miniAppUrl: string;
  onChatHandoff?: (input: { message: string; context: ActionContextToken; replyMarkup?: Record<string, unknown> }) => MaybePromise<void>;
  payload: ActionServerHookRequest;
  request: Request;
  screens?: ReadonlyMap<string, TeleforgeScreenDefinition>;
  services?: unknown;
  sessionManager: SessionManager;
  trust: ActionServerHookTrustOptions;
}

async function executeActionServerHook(
  options: ExecuteActionServerHookOptions
): Promise<unknown> {
  switch (options.payload.kind) {
    case "loadScreenContext": {
      const { flowId, screenId, signedContext } = options.payload.input;
      const context = validateActionContext(signedContext, options.flowSecret, {
        flowId
      });

      if (!context) {
        throw new ActionServerHookRequestError("Invalid or expired action context.", 401);
      }

      const flow = findFlowById(options.flows, flowId);
      if (!flow) {
        throw new ActionServerHookRequestError(`Flow "${flowId}" not found.`, 404);
      }

      if (!flow.miniApp?.routes || !Object.values(flow.miniApp.routes).includes(screenId)) {
        throw new ActionServerHookRequestError(`Screen "${screenId}" is not a member of flow "${flowId}".`, 404);
      }

      await options.trust.validate?.({
        actionId: undefined,
        actorId: flowId ? context.userId : null,
        flowId,
        request: options.request,
        screenId,
        signedContext: context
      });

      let session = undefined;
      if (flow.session?.enabled) {
        const handle = await options.sessionManager.get(context.userId, flowId, context.userId);
        if (handle) {
          session = await handle.get();
        }
      }

      let loaderData: unknown = undefined;
      let loaderFound = false;
      const loader = options.loaders?.get(screenId);
      if (loader) {
        loaderData = await loader({
          ctx: context,
          params: options.payload.input.params ?? {},
          services: options.services
        });
        loaderFound = true;
      }

      return { data: loaderData, loaderFound, session };
    }

    case "runAction": {
      const { flowId, actionId, signedContext, payload } = options.payload.input;
      const context = validateActionContext(signedContext, options.flowSecret, {
        allowedAction: actionId,
        flowId
      });

      if (!context) {
        throw new ActionServerHookRequestError("Invalid or expired action context.", 401);
      }

      const key = `${flowId}:${actionId}`;
      const action = options.actions.get(key);
      if (!action) {
        throw new ActionServerHookRequestError(`Action "${key}" not found.`, 404);
      }

      let session = undefined;
      if (action.requiresSession) {
        const handle = await options.sessionManager.get(context.userId, flowId, context.userId);
        if (handle) {
          session = handle;
        }
      }

      const sign = createSignForActionContext({
        appId: options.appId,
        defaultFlowId: context.flowId,
        flowSecret: options.flowSecret,
        miniAppUrl: options.miniAppUrl,
        userId: context.userId
      });

      const result = await action.handler({
        ctx: context,
        data: payload ?? {},
        services: options.services as never,
        session,
        sign
      });

      if (result.effects && options.onChatHandoff) {
        for (const effect of result.effects) {
          if (effect.type === "chatMessage" && typeof effect.text === "string") {
            const replyMarkup = effect.replyMarkup as Record<string, unknown> | undefined;
            await options.onChatHandoff({
              context,
              message: effect.text,
              ...(replyMarkup ? { replyMarkup } : {})
            });
          }
        }
      }

      return result;
    }

    case "handoff": {
      const { signedContext, message } = options.payload.input;
      const context = validateActionContext(signedContext, options.flowSecret);
      if (!context) {
        throw new ActionServerHookRequestError("Invalid or expired action context.", 401);
      }

      if (!options.onChatHandoff) {
        throw new ActionServerHookRequestError("Chat handoff handler not configured.", 501);
      }

      await options.onChatHandoff({ context, message });
      return {};
    }
  }
}

export interface StartTeleforgeServerOptions {
  app?: TeleforgeAppConfig;
  basePath?: string;
  cwd?: string;
  flowSecret?: string;
  loaders?: LoaderRegistry;
  miniAppUrl?: string;
  onChatHandoff?: (input: { message: string; context: ActionContextToken; replyMarkup?: Record<string, unknown> }) => MaybePromise<void>;
  port?: number;
  screens?: ReadonlyMap<string, TeleforgeScreenDefinition>;
  services?: unknown;
  sessionManager?: SessionManager;
  trust?: ActionServerHookTrustOptions;
  additionalRoutes?: Array<{
    path: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: (req: any, res: any) => Promise<void>;
  }>;
}

export interface StartTeleforgeServerResult {
  port: number;
  stop: () => void;
  url: string;
}

export async function startTeleforgeServer(
  options: StartTeleforgeServerOptions = {}
): Promise<StartTeleforgeServerResult> {
  const cwd = options.cwd ?? process.cwd();
  const app = options.app ?? (await loadTeleforgeApp(cwd)).app;

  const flowSecret = options.flowSecret ?? `${app.app.id}-preview-secret`;
  const basePath = options.basePath ?? "/api/teleforge/actions";
  const requestedPort = options.port ?? app.runtime.server?.port ?? 3100;
  const additionalRoutes = options.additionalRoutes ?? [];

  const hooksHandler = await createActionServerHooksHandler({
    basePath,
    cwd,
    flowSecret,
    loaders: options.loaders,
    miniAppUrl: options.miniAppUrl,
    onChatHandoff: options.onChatHandoff,
    screens: options.screens,
    services: options.services,
    sessionManager: options.sessionManager,
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

    const requestPathname = req.url ? new URL(req.url, "http://localhost").pathname : undefined;
    for (const route of additionalRoutes) {
      if (req.method === "POST" && requestPathname === route.path) {
        await route.handler(req, res);
        return;
      }
    }

    if (req.method === "POST" && req.url?.startsWith(basePath)) {
      try {
        const body = await readIncomingMessageBody(req);
        const request = new Request(`http://localhost:${resolvedPort}${req.url}`, {
          body,
          headers: { "content-type": req.headers["content-type"] ?? "application/json" },
          method: "POST"
        });

        const response = await hooksHandler.handleRequest(request);

        if (response) {
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          const headers = { ...responseHeaders, ...corsHeaders };
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

function findFlowById(
  flows: readonly DiscoveredFlowModule[],
  flowId: string
): ActionFlowDefinition | undefined {
  return flows.find(({ flow }) => flow.id === flowId)?.flow;
}

function readIncomingMessageBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

class ActionServerHookRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = "ActionServerHookRequestError";
  }
}

