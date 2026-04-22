import { useMemo } from "react";

import { parseResumeParam } from "./parseResumeParam.js";
import { useLaunch } from "../hooks/useLaunch.js";

import { getLaunchFlowContext, inferStateKey, parseFlowContext } from "./shared.js";

import type { FlowContext } from "@teleforgex/core/browser";

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
