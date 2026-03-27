import type { FlowStateResolver, ResumeFlowResult, UserFlowState } from "@teleforgex/core";

export interface ResumeFlowOptions {
  currentUserId?: number | string | null;
  resolveRoute?: (state: UserFlowState) => string | null;
}

/**
 * Loads and validates a resumable flow for the current Telegram user.
 */
export async function resumeFlow(
  flowId: string,
  resolver: FlowStateResolver,
  options: ResumeFlowOptions = {}
): Promise<ResumeFlowResult> {
  let flowState: UserFlowState | null;

  try {
    flowState = await resolver(flowId);
  } catch (error) {
    console.warn("Teleforge resumeFlow resolver failed; falling back to a fresh start.", error);
    return {
      error: "expired",
      success: false
    };
  }

  if (!flowState) {
    return {
      error: "not_found",
      success: false
    };
  }

  const currentUserId = normalizeUserId(options.currentUserId);

  if (!currentUserId || currentUserId !== flowState.userId) {
    return {
      error: "invalid",
      success: false
    };
  }

  if (typeof flowState.expiresAt === "number" && flowState.expiresAt <= Date.now()) {
    return {
      error: "expired",
      success: false
    };
  }

  if (flowState.stepId === "completed") {
    return {
      error: "completed",
      flowState,
      success: false
    };
  }

  const redirectTo = (options.resolveRoute ?? defaultResolveRoute)(flowState);

  if (!redirectTo) {
    return {
      error: "invalid_step",
      flowState,
      success: false
    };
  }

  return {
    flowState,
    redirectTo,
    success: true
  };
}

function defaultResolveRoute(state: UserFlowState): string | null {
  const stepId = state.stepId.trim();

  if (!stepId) {
    return null;
  }

  if (stepId.startsWith("/")) {
    return stepId;
  }

  return `/${stepId}`;
}

function normalizeUserId(userId: number | string | null | undefined): string | null {
  if (typeof userId === "number" && Number.isFinite(userId)) {
    return String(userId);
  }

  if (typeof userId === "string") {
    const normalized = userId.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}
