import type { FlowInstance } from "./types.js";

export type FlowStateResolver = (flowId: string) => Promise<FlowInstance | null>;

export type ResumeFlowError = "completed" | "expired" | "invalid" | "invalid_step" | "not_found";

export interface ResumeFlowSuccess {
  flowInstance: FlowInstance;
  redirectTo: string;
  success: true;
}

export interface ResumeFlowFailure {
  error: ResumeFlowError;
  flowInstance?: FlowInstance;
  success: false;
}

export type ResumeFlowResult = ResumeFlowFailure | ResumeFlowSuccess;
