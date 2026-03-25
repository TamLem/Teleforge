import { normalizeRouteCoordination } from "./route.js";
import { validateCoordinationConfig } from "./validate.js";

import type {
  LaunchEntryPoint,
  ReturnToChatMetadata,
  RouteCoordinationMetadata,
  RouteFlowMetadata
} from "./types.js";
import type { ValidationResult } from "./validate.js";

export interface CoordinationDefaults {
  expiryMinutes: number;
  persistence: "database" | "memory" | "session";
  returnToChat?: ReturnToChatMetadata;
}

export interface FlowDefinition {
  defaultStep: string;
  finalStep: string;
  onComplete?: "close" | "return_to_chat" | string;
  onExpiry?: "cancel" | "restart" | "retry";
  steps: readonly string[];
}

export interface FlowEntry extends FlowDefinition {
  id: string;
}

export interface RouteCoordinationConfig {
  entryPoints: readonly LaunchEntryPoint[];
  flow?: RouteFlowMetadata;
  flowId?: string;
  returnToChat?: ReturnToChatMetadata;
  stepRoutes?: Readonly<Record<string, string>>;
}

export interface RouteEntry extends RouteCoordinationConfig {
  path: string;
}

export interface ResolvedRouteCoordinationConfig extends RouteEntry {
  metadata: RouteCoordinationMetadata;
}

export interface CommandMapping {
  description?: string;
  route: string;
}

export interface ButtonMapping {
  route: string;
  text: string;
}

export interface DeepLinkMapping {
  param?: string;
  route: string;
  url?: string;
}

export interface CoordinationEntryPointMappings {
  buttons?: Record<string, ButtonMapping>;
  commands?: Record<string, CommandMapping>;
  deepLinks?: Record<string, DeepLinkMapping>;
}

export interface ResolvedCoordinationEntryPointMappings {
  buttons: Record<string, ButtonMapping>;
  commands: Record<string, CommandMapping>;
  deepLinks: Record<string, DeepLinkMapping>;
}

export interface CoordinationConfig {
  defaults: CoordinationDefaults;
  entryPoints?: CoordinationEntryPointMappings;
  flows?: Record<string, FlowDefinition | FlowEntry>;
  routes: Record<string, RouteCoordinationConfig | RouteEntry>;
}

export interface ResolvedCoordinationConfig {
  defaults: CoordinationDefaults;
  entryPoints: ResolvedCoordinationEntryPointMappings;
  flows: Record<string, FlowEntry>;
  resolveEntryPoint: (type: "button" | "command" | "deepLink", key: string) => string | undefined;
  resolveFlow: (flowId: string) => FlowEntry | undefined;
  resolveRoute: (path: string) => ResolvedRouteCoordinationConfig | undefined;
  resolveStep: (path: string, flowId?: string) => string | undefined;
  resolveStepRoute: (flowId: string, stepId: string) => string | undefined;
  routes: Record<string, ResolvedRouteCoordinationConfig>;
  validation: ValidationResult;
}

export function flowCoordination(flowId: string, definition: FlowDefinition): FlowEntry {
  return Object.freeze({
    ...definition,
    id: flowId,
    steps: Object.freeze([...definition.steps])
  });
}

export function routeCoordination(path: string, config: RouteCoordinationConfig): RouteEntry {
  return Object.freeze({
    ...config,
    entryPoints: Object.freeze([...config.entryPoints]),
    path,
    ...(config.stepRoutes ? { stepRoutes: Object.freeze({ ...config.stepRoutes }) } : {})
  });
}

export function defineCoordinationConfig(config: CoordinationConfig): ResolvedCoordinationConfig {
  const flows = Object.freeze(
    Object.fromEntries(
      Object.entries(config.flows ?? {}).map(([flowId, definition]) => [
        flowId,
        normalizeFlowEntry(flowId, definition)
      ])
    )
  ) as Record<string, FlowEntry>;
  const routes = Object.freeze(
    Object.fromEntries(
      Object.entries(config.routes).map(([path, definition]) => {
        const route = normalizeRouteEntry(path, definition, flows, config.defaults);
        return [route.path, route];
      })
    )
  ) as Record<string, ResolvedRouteCoordinationConfig>;
  const entryPoints = Object.freeze({
    buttons: Object.freeze({ ...(config.entryPoints?.buttons ?? {}) }),
    commands: Object.freeze({ ...(config.entryPoints?.commands ?? {}) }),
    deepLinks: Object.freeze({ ...(config.entryPoints?.deepLinks ?? {}) })
  }) as ResolvedCoordinationEntryPointMappings;
  const validation = Object.freeze(
    validateResolvedCoordinationConfig({ entryPoints, flows, routes })
  );

  return Object.freeze({
    defaults: Object.freeze({
      ...config.defaults,
      ...(config.defaults.returnToChat ? { returnToChat: { ...config.defaults.returnToChat } } : {})
    }),
    entryPoints,
    flows,
    resolveEntryPoint(type: "button" | "command" | "deepLink", key: string): string | undefined {
      switch (type) {
        case "button":
          return entryPoints.buttons[key]?.route;
        case "command":
          return entryPoints.commands[key]?.route;
        case "deepLink":
          return entryPoints.deepLinks[key]?.route;
      }
    },
    resolveFlow(flowId: string): FlowEntry | undefined {
      return flows[flowId];
    },
    resolveRoute(path: string): ResolvedRouteCoordinationConfig | undefined {
      return routes[path];
    },
    resolveStep(path: string, flowId?: string): string | undefined {
      const route = routes[path];
      const resolvedFlowId = flowId ?? (route ? resolveFlowId(route) : undefined);

      if (!resolvedFlowId) {
        return undefined;
      }

      for (const candidate of Object.values(routes)) {
        if (resolveFlowId(candidate) !== resolvedFlowId) {
          continue;
        }

        for (const [stepId, stepPath] of Object.entries(candidate.stepRoutes ?? {})) {
          if (stepPath === path) {
            return stepId;
          }
        }
      }

      return flows[resolvedFlowId]?.defaultStep;
    },
    resolveStepRoute(flowId: string, stepId: string): string | undefined {
      for (const route of Object.values(routes)) {
        if (resolveFlowId(route) !== flowId) {
          continue;
        }

        const mapped = route.stepRoutes?.[stepId];
        if (mapped) {
          return mapped;
        }

        if (flows[flowId]?.defaultStep === stepId) {
          return route.path;
        }
      }

      return undefined;
    },
    routes,
    validation
  });
}

function normalizeFlowEntry(flowId: string, definition: FlowDefinition | FlowEntry): FlowEntry {
  if ("id" in definition) {
    return flowCoordination(definition.id, definition);
  }

  return flowCoordination(flowId, definition);
}

function normalizeRouteEntry(
  path: string,
  definition: RouteCoordinationConfig | RouteEntry,
  flows: Record<string, FlowEntry>,
  defaults: CoordinationDefaults
): ResolvedRouteCoordinationConfig {
  const route = "path" in definition ? definition : routeCoordination(path, definition);
  const flowId = resolveFlowId(route);
  const flow = resolveFlowMetadata(route, flows[flowId ?? ""]);
  const returnToChat = mergeReturnToChat(defaults.returnToChat, route.returnToChat);
  const metadata = normalizeRouteCoordination({
    entryPoints: [...route.entryPoints],
    ...(flow ? { flow } : {}),
    ...(returnToChat ? { returnToChat } : {})
  });

  return Object.freeze({
    ...route,
    flowId,
    metadata,
    ...(route.stepRoutes ? { stepRoutes: Object.freeze({ ...route.stepRoutes }) } : {})
  });
}

function resolveFlowId(route: RouteCoordinationConfig | RouteEntry): string | undefined {
  return route.flowId ?? route.flow?.flowId;
}

function mergeReturnToChat(
  defaults?: ReturnToChatMetadata,
  routeValue?: ReturnToChatMetadata
): ReturnToChatMetadata | undefined {
  const text = routeValue?.text ?? defaults?.text;

  if (!text) {
    return undefined;
  }

  return {
    ...(defaults ?? {}),
    ...(routeValue ?? {}),
    text
  };
}

function resolveFlowMetadata(
  route: RouteCoordinationConfig | RouteEntry,
  flow: FlowEntry | undefined
): RouteFlowMetadata | undefined {
  if (route.flow) {
    return route.flow;
  }

  if (!route.flowId || !flow) {
    return undefined;
  }

  return {
    entryStep: flow.defaultStep,
    flowId: route.flowId
  };
}

function validateResolvedCoordinationConfig(input: {
  entryPoints: ResolvedCoordinationEntryPointMappings;
  flows: Record<string, FlowEntry>;
  routes: Record<string, ResolvedRouteCoordinationConfig>;
}): ValidationResult {
  return validateCoordinationConfig({
    defaults: {
      expiryMinutes: 0,
      persistence: "memory"
    },
    entryPoints: input.entryPoints,
    flows: input.flows,
    routes: input.routes
  });
}
