import { useMemo, useState } from "react";

import { parseResumeParam } from "../flow/parseResumeParam.js";
import { useFlowState } from "../flow/useFlowState.js";
import { useManifest } from "../guards/ManifestContext.js";
import { useLaunch } from "../hooks/useLaunch.js";
import { hasWindow } from "../utils/ssr.js";

import { useCoordinationContext } from "./context.js";
import { returnToChat as returnToChatAction } from "./return.js";
import { getLaunchFlowContext, inferStateKey, parseFlowContext } from "./shared.js";

import type { TransmitConfig } from "./transmit.js";
import type {
  FlowContext,
  FlowInstance,
  RouteCoordinationMetadata,
  TeleforgeManifest
} from "@teleforgex/core/browser";

export interface UseLaunchCoordinationReturn {
  entryRoute: string | null;
  error: string | null;
  flowContext: FlowContext | null;
  flowId: string | null;
  isValid: boolean;
  rawFlowContext: string | null;
  stateKey: string | null;
  stepId: string | null;
}

export interface ReturnToChatHookOptions {
  flowContext?: string;
  payload?: Record<string, unknown>;
  result?: "cancelled" | "completed" | "error";
  returnMessage?: string;
  stateKey?: string;
  stayInChat?: boolean;
}

export interface UseReturnToChatReturn {
  cancelFlow: (reason?: string) => Promise<void>;
  completeFlow: (payload?: Record<string, unknown>) => Promise<void>;
  error: Error | null;
  isReturning: boolean;
  returnToChat: (options?: ReturnToChatHookOptions) => Promise<void>;
}

export interface NavigateToStepOptions {
  payload?: Record<string, unknown>;
  replace?: boolean;
  route?: string;
}

export interface NavigateToRouteOptions {
  preserveFlow?: boolean;
  replace?: boolean;
}

export interface UseFlowNavigationReturn {
  buildLink: (route: string, params?: Record<string, string>) => string;
  navigateToRoute: (route: string, options?: NavigateToRouteOptions) => void;
  navigateToStep: (stepId: string, options?: NavigateToStepOptions) => Promise<void>;
}

export interface UseFlowCoordinationReturn {
  advance: (stepId: string, payload?: Record<string, unknown>) => Promise<void>;
  complete: (result?: Record<string, unknown>) => Promise<void>;
  coordination: RouteCoordinationMetadata | null;
  fail: (error: unknown) => Promise<void>;
  flowState: FlowInstance | null;
  isResuming: boolean;
  resumeError: string | null;
}

export function useFlowCoordination(routePath?: string): UseFlowCoordinationReturn {
  const flow = useFlowState();
  const navigation = useFlowNavigation();
  const { completeFlow, returnToChat } = useReturnToChat();
  const coordination = useRouteCoordination(routePath);

  return {
    advance: (stepId: string, payload?: Record<string, unknown>) =>
      navigation.navigateToStep(stepId, {
        payload
      }),
    complete: async (result: Record<string, unknown> = {}) => {
      await completeFlow(result);
    },
    coordination,
    fail: async (error: unknown) => {
      await returnToChat({
        payload: normalizeErrorPayload(error),
        result: "error"
      });
    },
    flowState: flow.flowState,
    isResuming: flow.isResuming,
    resumeError: flow.error
  };
}

export function useReturnToChat(config: TransmitConfig = {}): UseReturnToChatReturn {
  const [error, setError] = useState<Error | null>(null);
  const [isReturning, setIsReturning] = useState(false);
  const launchCoordination = useLaunchCoordination();

  async function run(action: () => Promise<void>) {
    setIsReturning(true);
    setError(null);

    try {
      await action();
    } catch (caught) {
      const resolved = caught instanceof Error ? caught : new Error(String(caught));
      setError(resolved);
      throw resolved;
    } finally {
      setIsReturning(false);
    }
  }

  return {
    cancelFlow: (reason?: string) =>
      run(() =>
        returnToChatAction(
          {
            data: reason ? { reason } : {},
            result: "cancelled"
          },
          config
        )
      ),
    completeFlow: (payload: Record<string, unknown> = {}) =>
      run(() =>
        returnToChatAction(
          {
            data: payload,
            result: "completed",
            returnMessage: launchCoordination.flowContext?.returnText ?? undefined
          },
          config
        )
      ),
    error,
    isReturning,
    returnToChat: (options: ReturnToChatHookOptions = {}) =>
      run(async () => {
        if (
          typeof options.stayInChat === "boolean" &&
          launchCoordination.flowContext &&
          launchCoordination.flowContext.stayInChat !== options.stayInChat
        ) {
          console.warn(
            "Teleforge useReturnToChat cannot override stayInChat at runtime; the signed launch payload remains authoritative."
          );
        }

        await returnToChatAction(
          {
            data: options.payload ?? {},
            flowContext: options.flowContext,
            result: options.result ?? "completed",
            returnMessage: options.returnMessage,
            stateKey: options.stateKey
          },
          config
        );
      })
  };
}

export function useLaunchCoordination(): UseLaunchCoordinationReturn {
  const launch = useLaunch();

  return useMemo(() => {
    const rawFlowContext = getLaunchFlowContext() ?? launch.startParam;

    if (!rawFlowContext) {
      return {
        entryRoute: null,
        error: null,
        flowContext: null,
        flowId: null,
        isValid: true,
        rawFlowContext: null,
        stateKey: null,
        stepId: null
      };
    }

    const parsed = parseFlowContext(rawFlowContext);

    if (parsed) {
      const entryRoute = typeof parsed.payload.route === "string" ? parsed.payload.route : null;

      return {
        entryRoute,
        error: null,
        flowContext: parsed,
        flowId: parsed.flowId,
        isValid: true,
        rawFlowContext,
        stateKey: inferStateKey(rawFlowContext),
        stepId: typeof parsed.stepId === "string" ? parsed.stepId : null
      };
    }

    const flowId = parseResumeParam();

    if (!flowId) {
      return {
        entryRoute: null,
        error: "Invalid launch coordination payload.",
        flowContext: null,
        flowId: null,
        isValid: false,
        rawFlowContext,
        stateKey: null,
        stepId: null
      };
    }

    return {
      entryRoute: null,
      error: null,
      flowContext: null,
      flowId,
      isValid: true,
      rawFlowContext,
      stateKey: null,
      stepId: null
    };
  }, [launch.startParam]);
}

export function useFlowNavigation(): UseFlowNavigationReturn {
  const context = useCoordinationContext(true);
  const flow = useFlowState();
  const launch = useLaunch();
  const launchCoordination = useLaunchCoordination();

  return {
    buildLink(route: string, params: Record<string, string> = {}) {
      return buildCoordinationLink(route, params, launchCoordination.rawFlowContext);
    },
    navigateToRoute(route: string, options: NavigateToRouteOptions = {}) {
      const target = buildCoordinationLink(
        route,
        {},
        options.preserveFlow === false ? null : launchCoordination.rawFlowContext
      );

      (context?.navigate ?? defaultNavigate)(target, {
        replace: options.replace
      });
    },
    async navigateToStep(stepId: string, options: NavigateToStepOptions = {}) {
      const targetRoute =
        options.route ??
        context?.resolveStepRoute?.(stepId, flow.flowState) ??
        (flow.flowState?.flowId
          ? context?.config?.resolveStepRoute(flow.flowState.flowId, stepId)
          : undefined) ??
        (launchCoordination.flowId
          ? context?.config?.resolveStepRoute(launchCoordination.flowId, stepId)
          : undefined) ??
        defaultResolveStepRoute(stepId);
      const userId = launch.user ? String(launch.user.id) : (flow.flowState?.userId ?? null);
      const flowId = flow.flowId ?? flow.flowState?.flowId ?? launchCoordination.flowId;
      const payload = {
        ...(context?.flowSnapshot ?? {}),
        ...(options.payload ?? {})
      };

      if (context?.persistFlowState && targetRoute && flowId && userId) {
        const nextState = await Promise.resolve(
          context.persistFlowState({
            currentState: flow.flowState,
            flowId,
            payload,
            route: targetRoute,
            stepId,
            userId
          })
        );

        if (nextState) {
          flow.setFlowState(nextState, {
            error: null,
            redirectTo: targetRoute,
            status: "resumed"
          });
        }
      }

      if (targetRoute) {
        const target = buildCoordinationLink(targetRoute, {}, launchCoordination.rawFlowContext);

        (context?.navigate ?? defaultNavigate)(target, {
          replace: options.replace
        });
      }
    }
  };
}

function buildCoordinationLink(
  route: string,
  params: Record<string, string>,
  rawFlowContext: string | null
): string {
  const url = createUrl(route);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  if (rawFlowContext) {
    url.searchParams.set("tgWebAppStartParam", rawFlowContext);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function createUrl(route: string): URL {
  if (hasWindow()) {
    return new URL(route, window.location.origin);
  }

  return new URL(route, "https://teleforge.invalid");
}

function defaultNavigate(route: string, options: { replace?: boolean } = {}) {
  if (!hasWindow()) {
    return;
  }

  if (options.replace) {
    window.history.replaceState(window.history.state, "", route);
    return;
  }

  window.history.pushState(window.history.state, "", route);
}

function defaultResolveStepRoute(stepId: string): string {
  return stepId.startsWith("/") ? stepId : `/${stepId}`;
}

function normalizeErrorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name
    };
  }

  return {
    message: String(error)
  };
}

function useRouteCoordination(routePath?: string): RouteCoordinationMetadata | null {
  const context = useCoordinationContext(true);
  const manifest = useManifest(true);
  const currentRoute = routePath ?? context?.currentRoute ?? readCurrentRoute();

  return useMemo(
    () => resolveRouteCoordination(currentRoute, context, manifest),
    [context, currentRoute, manifest]
  );
}

function resolveRouteCoordination(
  route: string | null,
  context: ReturnType<typeof useCoordinationContext>,
  manifest: TeleforgeManifest | null
): RouteCoordinationMetadata | null {
  if (!route) {
    return null;
  }

  const resolved = context?.resolveRouteCoordination?.(route, manifest);

  if (resolved) {
    return resolved;
  }

  const fromConfig = context?.config?.resolveRoute(route)?.metadata;
  if (fromConfig) {
    return fromConfig;
  }

  return manifest?.routes.find((entry) => entry.path === route)?.coordination ?? null;
}

function readCurrentRoute(): string | null {
  if (!hasWindow()) {
    return null;
  }

  return window.location.pathname;
}
