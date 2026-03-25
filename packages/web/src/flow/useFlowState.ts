import { useContext } from "react";

import { FlowStateContext } from "./context.js";

/**
 * Accesses resumable-flow state managed by FlowResumeProvider.
 */
export function useFlowState() {
  const context = useContext(FlowStateContext);

  if (!context) {
    throw new Error("useFlowState must be used inside a FlowResumeProvider.");
  }

  return context;
}
