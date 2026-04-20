import { useEffect, useRef, useState } from "react";

import { useLaunch } from "../hooks/useLaunch.js";
import { hasWindow } from "../utils/ssr.js";

import { FlowStateContext, type FlowStateCommitOptions, type FlowStateStatus } from "./context.js";
import { parseResumeParam } from "./parseResumeParam.js";
import { resumeFlow } from "./resumeFlow.js";

import type {
  FlowInstance,
  FlowStateResolver,
  ResumeFlowError,
  ResumeFlowResult
} from "@teleforgex/core";
import type { ReactNode } from "react";

export interface FlowResumeProviderProps {
  children: ReactNode;
  indicatorDurationMs?: number;
  onFreshStart?: (reason: ResumeFlowError | null) => void;
  onResume?: (result: Extract<ResumeFlowResult, { success: true }>) => void;
  parseFlowId?: () => string | null;
  resolveRoute?: (state: FlowInstance) => string | null;
  resolver: FlowStateResolver;
}

/**
 * Automatically resumes Telegram flows from launch parameters and exposes the result via context.
 */
export function FlowResumeProvider({
  children,
  indicatorDurationMs = 2400,
  onFreshStart,
  onResume,
  parseFlowId,
  resolveRoute,
  resolver
}: FlowResumeProviderProps) {
  const launch = useLaunch();
  const [error, setError] = useState<ResumeFlowError | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowInstance | null>(null);
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [status, setStatus] = useState<FlowStateStatus>("idle");
  const attemptedFlowRef = useRef<string | null>(null);
  const errorRef = useRef<ResumeFlowError | null>(error);
  const onFreshStartRef = useRef(onFreshStart);
  const onResumeRef = useRef(onResume);
  const parseFlowIdRef = useRef(parseFlowId);
  const resolveRouteRef = useRef(resolveRoute);
  const resolverRef = useRef(resolver);
  const timeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  errorRef.current = error;
  onFreshStartRef.current = onFreshStart;
  onResumeRef.current = onResume;
  parseFlowIdRef.current = parseFlowId;
  resolveRouteRef.current = resolveRoute;
  resolverRef.current = resolver;

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        globalThis.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!launch.isReady) {
      return;
    }

    const nextFlowId = (parseFlowIdRef.current ?? parseResumeParam)();

    if (!nextFlowId || attemptedFlowRef.current === nextFlowId) {
      return;
    }

    attemptedFlowRef.current = nextFlowId;
    void performResume(nextFlowId);
  }, [launch.isReady, launch.startParam, launch.user]);

  async function performResume(targetFlowId: string): Promise<ResumeFlowResult> {
    setStatus("resuming");
    setFlowId(targetFlowId);

    const result = await resumeFlow(targetFlowId, resolverRef.current, {
      currentUserId: launch.user?.id ?? null,
      resolveRoute: resolveRouteRef.current ?? undefined
    });

    consumeResumeParam();

    if (!result.success) {
      commitFlowState(result.flowInstance ?? null, {
        error: result.error,
        indicatorVisible: false,
        redirectTo: null,
        status: "error"
      });
      setFlowId(targetFlowId);
      return result;
    }

    commitFlowState(result.flowInstance, {
      error: null,
      indicatorVisible: true,
      redirectTo: result.redirectTo,
      status: "resumed"
    });
    scheduleIndicatorDismiss(timeoutRef, setIndicatorVisible, indicatorDurationMs);
    onResumeRef.current?.(result);

    return result;
  }

  function clear() {
    if (timeoutRef.current !== null) {
      globalThis.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    commitFlowState(null, {
      error: null,
      indicatorVisible: false,
      redirectTo: null,
      status: "idle"
    });
    setFlowId(null);
  }

  function freshStart() {
    attemptedFlowRef.current = null;
    consumeResumeParam();
    clear();
    onFreshStartRef.current?.(errorRef.current);
  }

  async function resume(targetFlowId?: string): Promise<ResumeFlowResult | null> {
    const nextFlowId = targetFlowId ?? (parseFlowIdRef.current ?? parseResumeParam)();

    if (!nextFlowId) {
      return null;
    }

    attemptedFlowRef.current = nextFlowId;
    return performResume(nextFlowId);
  }

  function commitFlowState(state: FlowInstance | null, options: FlowStateCommitOptions = {}) {
    setError(options.error ?? null);
    setFlowId(state?.flowId ?? flowId);
    setFlowState(state);
    setIndicatorVisible(options.indicatorVisible ?? false);
    setRedirectTo(options.redirectTo ?? null);
    setStatus(options.status ?? (state ? "resumed" : "idle"));
  }

  return (
    <FlowStateContext.Provider
      value={{
        clear,
        error,
        flowId,
        flowState,
        freshStart,
        indicatorVisible,
        isResuming: status === "resuming",
        redirectTo,
        resume,
        setFlowState: commitFlowState,
        status
      }}
    >
      {children}
    </FlowStateContext.Provider>
  );
}

function consumeResumeParam() {
  if (!hasWindow()) {
    return;
  }

  const url = new URL(window.location.href);
  const hadResumeParam =
    url.searchParams.has("tgWebAppStartParam") || url.searchParams.has("startapp");

  if (!hadResumeParam) {
    return;
  }

  url.searchParams.delete("tgWebAppStartParam");
  url.searchParams.delete("startapp");
  window.history.replaceState(window.history.state, "", url);
}

function scheduleIndicatorDismiss(
  timeoutRef: { current: ReturnType<typeof globalThis.setTimeout> | null },
  setIndicatorVisible: (visible: boolean) => void,
  durationMs: number
) {
  if (!hasWindow()) {
    return;
  }

  if (timeoutRef.current !== null) {
    globalThis.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  if (durationMs <= 0) {
    return;
  }

  timeoutRef.current = globalThis.setTimeout(() => {
    setIndicatorVisible(false);
    timeoutRef.current = null;
  }, durationMs);
}
