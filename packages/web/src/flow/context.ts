import { createContext } from "react";

import type { ResumeFlowError, ResumeFlowResult, UserFlowState } from "@teleforge/core";

export type FlowStateStatus = "error" | "idle" | "resumed" | "resuming";

export interface FlowStateCommitOptions {
  error?: ResumeFlowError | null;
  indicatorVisible?: boolean;
  redirectTo?: string | null;
  status?: FlowStateStatus;
}

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
  setFlowState: (state: UserFlowState | null, options?: FlowStateCommitOptions) => void;
  status: FlowStateStatus;
}

export const FlowStateContext = createContext<FlowStateContextValue | null>(null);
