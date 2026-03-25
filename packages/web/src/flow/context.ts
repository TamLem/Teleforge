import { createContext } from "react";

import type { ResumeFlowError, ResumeFlowResult, UserFlowState } from "@teleforge/core";

export interface FlowStateContextValue {
  clear: () => void;
  error: ResumeFlowError | null;
  flowId: string | null;
  flowState: UserFlowState | null;
  freshStart: () => void;
  indicatorVisible: boolean;
  isResuming: boolean;
  redirectTo: string | null;
  resume: (flowId?: string) => Promise<ResumeFlowResult | null>;
  status: "error" | "idle" | "resumed" | "resuming";
}

export const FlowStateContext = createContext<FlowStateContextValue | null>(null);
