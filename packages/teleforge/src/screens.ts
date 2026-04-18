import { getFlowStep, isMiniAppStep } from "./flow-definition.js";

import type { DiscoveredFlowModule } from "./discovery.js";
import type { TeleforgeFlowDefinition } from "./flow-definition.js";
import type { ComponentType } from "react";

type AnyFlowDefinition = TeleforgeFlowDefinition<unknown, unknown>;
type MaybePromise<T> = Promise<T> | T;

export interface TeleforgeScreenComponentProps<TState = unknown> {
  flow: TeleforgeFlowDefinition<TState, unknown>;
  flowId: string;
  loaderData?: unknown;
  routePath: string;
  runAction?: (action: string) => Promise<void>;
  screenId: string;
  state: TState;
  stepId: string;
  submit?: (data: unknown) => Promise<void>;
  transitioning?: boolean;
}

export interface TeleforgeScreenRuntimeContext<TState = unknown>
  extends Omit<TeleforgeScreenComponentProps<TState>, "loaderData"> {
  serverLoaderData?: unknown;
}

export interface TeleforgeScreenGuardBlock {
  allow: false;
  reason?: string;
}

export type TeleforgeScreenGuardResult = boolean | TeleforgeScreenGuardBlock;

export interface TeleforgeScreenDefinition<TState = unknown, TLoaderData = unknown> {
  component: ComponentType<TeleforgeScreenComponentProps<TState>>;
  guard?: (
    context: TeleforgeScreenRuntimeContext<TState>
  ) => MaybePromise<TeleforgeScreenGuardResult>;
  id: string;
  loader?: (
    context: TeleforgeScreenRuntimeContext<TState>
  ) => MaybePromise<TLoaderData>;
  title?: string;
}

export interface DiscoveredScreenModule<TState = unknown> {
  filePath: string;
  screen: TeleforgeScreenDefinition<TState>;
}

export interface ResolveMiniAppScreenOptions {
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  pathname: string;
  screens: Iterable<TeleforgeScreenDefinition | DiscoveredScreenModule>;
}

export interface ResolvedMiniAppScreen {
  flow: AnyFlowDefinition;
  flowId: string;
  routePath: string;
  screen: TeleforgeScreenDefinition;
  screenId: string;
  state: unknown;
  stepId: string;
}

export interface UnresolvedMiniAppScreen {
  flow?: AnyFlowDefinition;
  flowId?: string;
  pathname: string;
  reason: "missing_miniapp_step" | "missing_route" | "missing_screen";
  screenId?: string;
  stepId?: string;
}

export function defineScreen<TState>(
  screen: TeleforgeScreenDefinition<TState>
): Readonly<TeleforgeScreenDefinition<TState>> {
  if (typeof screen.id !== "string" || screen.id.trim().length === 0) {
    throw new Error("Screen id must be a non-empty string.");
  }

  if (typeof screen.component !== "function") {
    throw new Error(`Screen "${screen.id}" must define a component.`);
  }

  return Object.freeze({
    ...screen
  });
}

export function createScreenRegistry(
  screens: Iterable<TeleforgeScreenDefinition | DiscoveredScreenModule>
): ReadonlyMap<string, TeleforgeScreenDefinition> {
  const registry = new Map<string, TeleforgeScreenDefinition>();

  for (const entry of screens) {
    const screen = "screen" in entry ? entry.screen : entry;
    const existing = registry.get(screen.id);

    if (existing) {
      throw new Error(`Duplicate screen id "${screen.id}" discovered.`);
    }

    registry.set(screen.id, screen);
  }

  return registry;
}

export function resolveMiniAppScreen(
  options: ResolveMiniAppScreenOptions
): ResolvedMiniAppScreen | UnresolvedMiniAppScreen {
  const flows = normalizeDiscoveredFlows(options.flows);
  const registry = createScreenRegistry(options.screens);

  for (const flow of flows) {
    const resolvedStepId = resolveMiniAppStepFromPath(flow, options.pathname);

    if (!resolvedStepId) {
      continue;
    }

    const step = getFlowStep(flow, resolvedStepId);

    if (!isMiniAppStep(step)) {
      return {
        flow,
        flowId: flow.id,
        pathname: options.pathname,
        reason: "missing_miniapp_step",
        stepId: resolvedStepId
      };
    }

    const screen = registry.get(step.screen);

    if (!screen) {
      return {
        flow,
        flowId: flow.id,
        pathname: options.pathname,
        reason: "missing_screen",
        screenId: step.screen,
        stepId: resolvedStepId
      };
    }

    return {
      flow,
      flowId: flow.id,
      routePath: options.pathname,
      screen,
      screenId: screen.id,
      state: structuredClone(flow.state),
      stepId: resolvedStepId
    };
  }

  return {
    pathname: options.pathname,
    reason: "missing_route"
  };
}

function normalizeDiscoveredFlows(
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>
): AnyFlowDefinition[] {
  return Array.from(flows, (entry) => ("flow" in entry ? entry.flow : entry));
}

function resolveMiniAppStepFromPath(flow: AnyFlowDefinition, pathname: string): string | null {
  const miniApp = flow.miniApp;

  if (!miniApp) {
    return null;
  }

  if (miniApp.route === pathname) {
    return resolveMiniAppEntryStep(flow);
  }

  for (const [stepId, routePath] of Object.entries(miniApp.stepRoutes ?? {})) {
    if (routePath === pathname) {
      return stepId;
    }
  }

  return null;
}

function resolveMiniAppEntryStep(flow: AnyFlowDefinition): string {
  const initialStep = getFlowStep(flow, String(flow.initialStep));

  if (isMiniAppStep(initialStep)) {
    return String(flow.initialStep);
  }

  for (const [stepId, step] of Object.entries(flow.steps)) {
    if (isMiniAppStep(step)) {
      return stepId;
    }
  }

  return String(flow.initialStep);
}
