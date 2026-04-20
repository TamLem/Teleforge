import { createContext } from "react";

import type { FlowInstance, ResumeFlowError, ResumeFlowResult } from "@teleforgex/core";

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
  flowState: FlowInstance | null;
  freshStart: () => void;
  indicatorVisible: boolean;
  isResuming: boolean;
  redirectTo: string | null;
  resume: (flowId?: string) => Promise<ResumeFlowResult | null>;
  setFlowState: (state: FlowInstance | null, options?: FlowStateCommitOptions) => void;
  status: FlowStateStatus;
}

export const FlowStateContext = createContext<FlowStateContextValue | null>(null);
