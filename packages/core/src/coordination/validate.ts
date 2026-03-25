import type {
  ButtonMapping,
  CommandMapping,
  CoordinationConfig,
  DeepLinkMapping,
  FlowEntry,
  ResolvedRouteCoordinationConfig,
  RouteCoordinationConfig
} from "./config.js";

export interface ValidationError {
  message: string;
  path: string;
  type:
    | "duplicate_entry_point"
    | "invalid_flow_ref"
    | "invalid_step"
    | "missing_default_step"
    | "orphan_route"
    | "unknown_flow";
}

export interface ValidationResult {
  errors: ValidationError[];
  valid: boolean;
  warnings: ValidationError[];
}

export function validateCoordinationConfig(config: CoordinationConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const flows = Object.fromEntries(
    Object.entries(config.flows ?? {}).map(([flowId, definition]) => [
      flowId,
      "id" in definition ? definition : { ...definition, id: flowId }
    ])
  ) as Record<string, FlowEntry>;
  const routes = Object.fromEntries(
    Object.entries(config.routes).map(([path, definition]) => [
      "path" in definition ? definition.path : path,
      definition
    ])
  ) as Record<string, RouteCoordinationConfig | ResolvedRouteCoordinationConfig>;
  const entryPoints = {
    buttons: config.entryPoints?.buttons ?? {},
    commands: config.entryPoints?.commands ?? {},
    deepLinks: config.entryPoints?.deepLinks ?? {}
  };

  validateFlows(flows, errors);
  validateRoutes(routes, flows, errors, warnings);
  validateEntryPointConflicts(routes, entryPoints, errors);

  return {
    errors,
    valid: errors.length === 0,
    warnings
  };
}

function validateFlows(flows: Record<string, FlowEntry>, errors: ValidationError[]) {
  for (const [flowId, flow] of Object.entries(flows)) {
    if (flow.steps.length === 0 || !flow.steps.includes(flow.defaultStep)) {
      errors.push({
        message: `Flow "${flowId}" must declare a defaultStep present in steps.`,
        path: `flows.${flowId}.defaultStep`,
        type: "missing_default_step"
      });
    }

    if (!flow.steps.includes(flow.finalStep)) {
      errors.push({
        message: `Flow "${flowId}" finalStep must be present in steps.`,
        path: `flows.${flowId}.finalStep`,
        type: "invalid_step"
      });
    }

    if (
      flow.onComplete &&
      flow.onComplete !== "close" &&
      flow.onComplete !== "return_to_chat" &&
      !flows[flow.onComplete]
    ) {
      errors.push({
        message: `Flow "${flowId}" onComplete references unknown flow "${flow.onComplete}".`,
        path: `flows.${flowId}.onComplete`,
        type: "invalid_flow_ref"
      });
    }
  }
}

function validateRoutes(
  routes: Record<string, RouteCoordinationConfig | ResolvedRouteCoordinationConfig>,
  flows: Record<string, FlowEntry>,
  errors: ValidationError[],
  warnings: ValidationError[]
) {
  for (const [path, route] of Object.entries(routes)) {
    const flowId = resolveFlowId(route);

    if (flowId && !flows[flowId]) {
      errors.push({
        message: `Route "${path}" references unknown flow "${flowId}".`,
        path: `routes.${path}.flowId`,
        type: "unknown_flow"
      });
      continue;
    }

    if (route.stepRoutes && flowId) {
      for (const stepId of Object.keys(route.stepRoutes)) {
        if (!flows[flowId]?.steps.includes(stepId)) {
          errors.push({
            message: `Route "${path}" maps unknown step "${stepId}" for flow "${flowId}".`,
            path: `routes.${path}.stepRoutes.${stepId}`,
            type: "invalid_step"
          });
        }
      }
    }

    if (flowId && route.entryPoints.length === 0) {
      warnings.push({
        message: `Route "${path}" references flow "${flowId}" but declares no entry points.`,
        path: `routes.${path}.entryPoints`,
        type: "orphan_route"
      });
    }
  }
}

function validateEntryPointConflicts(
  routes: Record<string, RouteCoordinationConfig | ResolvedRouteCoordinationConfig>,
  entryPoints: {
    buttons: Record<string, ButtonMapping>;
    commands: Record<string, CommandMapping>;
    deepLinks: Record<string, DeepLinkMapping>;
  },
  errors: ValidationError[]
) {
  const assignments = new Map<string, string>();

  for (const [command, mapping] of Object.entries(entryPoints.commands)) {
    rememberAssignment(
      assignments,
      `command:${command}`,
      mapping.route,
      errors,
      `entryPoints.commands.${command}`
    );
  }

  for (const [key, mapping] of Object.entries(entryPoints.buttons)) {
    rememberAssignment(
      assignments,
      `button:${mapping.text}`,
      mapping.route,
      errors,
      `entryPoints.buttons.${key}`
    );
  }

  for (const [key, mapping] of Object.entries(entryPoints.deepLinks)) {
    if (!mapping.url) {
      continue;
    }

    rememberAssignment(
      assignments,
      `deepLink:${mapping.url}`,
      mapping.route,
      errors,
      `entryPoints.deepLinks.${key}`
    );
  }

  for (const [path, route] of Object.entries(routes)) {
    route.entryPoints.forEach((entryPoint, index) => {
      if (entryPoint.type === "bot_command") {
        rememberAssignment(
          assignments,
          `command:${entryPoint.command}`,
          path,
          errors,
          `routes.${path}.entryPoints.${index}`
        );
      } else if (entryPoint.type === "bot_button") {
        rememberAssignment(
          assignments,
          `button:${entryPoint.text}`,
          path,
          errors,
          `routes.${path}.entryPoints.${index}`
        );
      } else if (entryPoint.type === "deep_link") {
        rememberAssignment(
          assignments,
          `deepLink:${entryPoint.url}`,
          path,
          errors,
          `routes.${path}.entryPoints.${index}`
        );
      }
    });
  }
}

function rememberAssignment(
  assignments: Map<string, string>,
  key: string,
  route: string,
  errors: ValidationError[],
  path: string
) {
  const existing = assignments.get(key);

  if (existing && existing !== route) {
    errors.push({
      message: `Entry point "${key}" is assigned to both "${existing}" and "${route}".`,
      path,
      type: "duplicate_entry_point"
    });
    return;
  }

  assignments.set(key, route);
}

function resolveFlowId(
  route: RouteCoordinationConfig | ResolvedRouteCoordinationConfig
): string | undefined {
  return route.flowId ?? route.flow?.flowId;
}
