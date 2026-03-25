import { createContext, useContext } from "react";

import type {
  RouteCoordinationMetadata,
  TeleforgeManifest,
  UserFlowState
} from "@teleforge/core/browser";

export interface PersistFlowStateInput {
  currentState: UserFlowState | null;
  flowId: string | null;
  payload: Record<string, unknown>;
  route: string;
  stepId: string;
  userId: string | null;
}

export interface CoordinationNavigateOptions {
  replace?: boolean;
}

export interface CoordinationContextValue {
  currentRoute: string | null;
  flowSnapshot: Record<string, unknown>;
  navigate: (route: string, options?: CoordinationNavigateOptions) => void;
  persistFlowState?: (
    input: PersistFlowStateInput
  ) => Promise<UserFlowState | null> | UserFlowState | null;
  resolveRouteCoordination?: (
    route: string,
    manifest: TeleforgeManifest | null
  ) => RouteCoordinationMetadata | null;
  resolveStepRoute?: (stepId: string, state: UserFlowState | null) => string | null;
  resolveStepState?: (route: string, state: UserFlowState | null) => string | null;
}

export const CoordinationContext = createContext<CoordinationContextValue | null>(null);

export function useCoordinationContext(optional = false): CoordinationContextValue | null {
  const context = useContext(CoordinationContext);

  if (!optional && !context) {
    throw new Error("Coordination hooks must be used within a CoordinationProvider.");
  }

  return context;
}
