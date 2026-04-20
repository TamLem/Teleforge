import React, { useEffect, useMemo, useRef } from "react";

import { FlowResumeProvider, type FlowResumeProviderProps } from "../flow/FlowResumeProvider.js";
import { useFlowState } from "../flow/useFlowState.js";
import { ManifestProvider } from "../guards/ManifestContext.js";
import { useLaunch } from "../hooks/useLaunch.js";
import { hasWindow } from "../utils/ssr.js";

import {
  CoordinationContext,
  type CoordinationContextValue,
  type PersistFlowStateInput
} from "./context.js";

import type {
  FlowInstance,
  ResolvedCoordinationConfig,
  TeleforgeManifest
} from "@teleforgex/core/browser";

export interface CoordinationProviderProps extends FlowResumeProviderProps {
  children: React.ReactNode;
  currentRoute?: string | null;
  config?: ResolvedCoordinationConfig;
  flowSnapshot?: Record<string, unknown>;
  manifest?: TeleforgeManifest;
  navigate?: (route: string, options?: { replace?: boolean }) => void;
  persistFlowState?: (
    input: PersistFlowStateInput
  ) => Promise<FlowInstance | null> | FlowInstance | null;
  resolveRouteCoordination?: CoordinationContextValue["resolveRouteCoordination"];
  resolveStepRoute?: CoordinationContextValue["resolveStepRoute"];
  resolveStepState?: CoordinationContextValue["resolveStepState"];
}

interface CoordinationBridgeProps {
  children: React.ReactNode;
  currentRoute?: string | null;
  config?: ResolvedCoordinationConfig;
  flowSnapshot: Record<string, unknown>;
  manifest?: TeleforgeManifest;
  navigate?: (route: string, options?: { replace?: boolean }) => void;
  persistFlowState?: (
    input: PersistFlowStateInput
  ) => Promise<FlowInstance | null> | FlowInstance | null;
  resolveRouteCoordination?: CoordinationContextValue["resolveRouteCoordination"];
  resolveStepRoute?: CoordinationContextValue["resolveStepRoute"];
  resolveStepState?: CoordinationContextValue["resolveStepState"];
}

export function CoordinationProvider({
  children,
  currentRoute,
  config,
  flowSnapshot = {},
  manifest,
  navigate,
  persistFlowState,
  resolveRouteCoordination,
  resolveStepRoute,
  resolveStepState,
  ...flowResumeProps
}: CoordinationProviderProps) {
  return (
    <FlowResumeProvider {...flowResumeProps}>
      <CoordinationBridge
        currentRoute={currentRoute}
        config={config}
        flowSnapshot={flowSnapshot}
        manifest={manifest}
        navigate={navigate}
        persistFlowState={persistFlowState}
        resolveRouteCoordination={resolveRouteCoordination}
        resolveStepRoute={resolveStepRoute}
        resolveStepState={resolveStepState}
      >
        {children}
      </CoordinationBridge>
    </FlowResumeProvider>
  );
}

function CoordinationBridge({
  children,
  currentRoute,
  config,
  flowSnapshot,
  manifest,
  navigate,
  persistFlowState,
  resolveRouteCoordination,
  resolveStepRoute,
  resolveStepState
}: CoordinationBridgeProps) {
  const flow = useFlowState();
  const launch = useLaunch();
  const lastPersistedKey = useRef<string | null>(null);
  const resolvedCurrentRoute = currentRoute ?? readCurrentRoute();
  const flowId = flow.flowId ?? flow.flowState?.flowId ?? null;
  const userId = launch.user ? String(launch.user.id) : (flow.flowState?.userId ?? null);
  const stepId =
    (resolvedCurrentRoute ? resolveStepState?.(resolvedCurrentRoute, flow.flowState) : null) ??
    (resolvedCurrentRoute
      ? config?.resolveStep(resolvedCurrentRoute, flowId ?? undefined)
      : null) ??
    flow.flowState?.stepId ??
    null;

  useEffect(() => {
    if (!persistFlowState || !resolvedCurrentRoute || !flowId || !userId || !stepId) {
      return;
    }

    const persistKey = JSON.stringify({
      flowId,
      payload: flowSnapshot,
      route: resolvedCurrentRoute,
      stepId,
      userId
    });

    if (lastPersistedKey.current === persistKey) {
      return;
    }

    lastPersistedKey.current = persistKey;

    void Promise.resolve(
      persistFlowState({
        currentState: flow.flowState,
        flowId,
        payload: structuredClone(flowSnapshot),
        route: resolvedCurrentRoute,
        stepId,
        userId
      })
    ).then((nextState) => {
      if (nextState) {
        flow.setFlowState(nextState, {
          error: null,
          redirectTo: resolvedCurrentRoute,
          status: flow.status === "idle" ? "idle" : "resumed"
        });
      }
    });
  }, [
    flow.flowState,
    flow.setFlowState,
    flow.status,
    flowId,
    flowSnapshot,
    persistFlowState,
    resolvedCurrentRoute,
    stepId,
    userId
  ]);

  const value = useMemo<CoordinationContextValue>(
    () => ({
      config,
      currentRoute: resolvedCurrentRoute,
      flowSnapshot,
      navigate: navigate ?? defaultNavigate,
      persistFlowState,
      resolveRouteCoordination,
      resolveStepRoute,
      resolveStepState
    }),
    [
      config,
      flowSnapshot,
      navigate,
      persistFlowState,
      resolveRouteCoordination,
      resolveStepRoute,
      resolveStepState,
      resolvedCurrentRoute
    ]
  );

  const content = React.createElement(CoordinationContext.Provider, { value }, children);

  return manifest
    ? React.createElement(ManifestProvider, { manifest, children: content })
    : content;
}

function defaultNavigate(route: string, options: { replace?: boolean } = {}) {
  if (!hasWindow()) {
    return;
  }

  const target = new URL(route, window.location.origin);

  if (options.replace) {
    window.history.replaceState(window.history.state, "", target);
    return;
  }

  window.history.pushState(window.history.state, "", target);
}

function readCurrentRoute(): string | null {
  if (!hasWindow()) {
    return null;
  }

  return window.location.pathname;
}
