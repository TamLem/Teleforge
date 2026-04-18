import { useLaunch } from "@teleforgex/web";
import { useMemo } from "react";

import { resolveMiniAppScreen } from "./screens.js";


import type { DiscoveredFlowModule } from "./discovery.js";
import type { TeleforgeFlowDefinition } from "./flow.js";
import type {
  DiscoveredScreenModule,
  ResolvedMiniAppScreen,
  TeleforgeScreenDefinition,
  UnresolvedMiniAppScreen
} from "./screens.js";
import type { ReactNode } from "react";

type AnyFlowDefinition = TeleforgeFlowDefinition<unknown, unknown>;

export interface TeleforgeMiniAppProps {
  fallback?: ReactNode;
  flows: Iterable<AnyFlowDefinition | DiscoveredFlowModule>;
  pathname?: string;
  renderError?: (error: UnresolvedMiniAppScreen) => ReactNode;
  screens: Iterable<TeleforgeScreenDefinition | DiscoveredScreenModule>;
}

export interface UseTeleforgeMiniAppRuntimeOptions
  extends Omit<TeleforgeMiniAppProps, "fallback" | "renderError"> {}

export function TeleforgeMiniApp(props: TeleforgeMiniAppProps) {
  const resolution = useTeleforgeMiniAppRuntime(props);

  if ("reason" in resolution) {
    if (props.renderError) {
      return <>{props.renderError(resolution)}</>;
    }

    if (props.fallback) {
      return <>{props.fallback}</>;
    }

    return <DefaultMiniAppError error={resolution} />;
  }

  const Screen = resolution.screen.component;

  return (
    <Screen
      flow={resolution.flow}
      flowId={resolution.flowId}
      routePath={resolution.routePath}
      screenId={resolution.screenId}
      state={resolution.state}
      stepId={resolution.stepId}
    />
  );
}

export function useTeleforgeMiniAppRuntime(
  options: UseTeleforgeMiniAppRuntimeOptions
): ResolvedMiniAppScreen | UnresolvedMiniAppScreen {
  const launch = useLaunch();
  const pathname = options.pathname ?? resolveWindowPathname();

  return useMemo(
    () =>
      resolveMiniAppScreen({
        flows: options.flows,
        pathname,
        screens: options.screens
      }),
    [launch.startParam, options.flows, pathname, options.screens]
  );
}

function DefaultMiniAppError(options: { error: UnresolvedMiniAppScreen }) {
  const { error } = options;

  switch (error.reason) {
    case "missing_route":
      return <div>Teleforge could not resolve a Mini App screen for "{error.pathname}".</div>;
    case "missing_screen":
      return (
        <div>
          Teleforge could not find screen "{error.screenId}" for flow "{error.flowId}" step "
          {error.stepId}".
        </div>
      );
    case "missing_miniapp_step":
      return (
        <div>
          Teleforge route "{error.pathname}" resolved to step "{error.stepId}", but that step is
          not a Mini App step.
        </div>
      );
  }
}

function resolveWindowPathname(): string {
  if (typeof window === "undefined" || !window.location.pathname) {
    return "/";
  }

  return window.location.pathname;
}
