import type { UserFlowState } from "./types.js";

export type FlowStateResolver = (flowId: string) => Promise<UserFlowState | null>;

export type ResumeFlowError = "completed" | "expired" | "invalid" | "invalid_step" | "not_found";

export interface ResumeFlowSuccess {
  flowState: UserFlowState;
  redirectTo: string;
  success: true;
}

export interface ResumeFlowFailure {
  error: ResumeFlowError;
  flowState?: UserFlowState;
  success: false;
}

export type ResumeFlowResult = ResumeFlowFailure | ResumeFlowSuccess;
