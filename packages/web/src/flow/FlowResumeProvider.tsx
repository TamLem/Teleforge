import { useEffect, useRef, useState } from "react";

import { useLaunch } from "../hooks/useLaunch.js";
import { hasWindow } from "../utils/ssr.js";

import { FlowStateContext } from "./context.js";
import { parseResumeParam } from "./parseResumeParam.js";
import { resumeFlow } from "./resumeFlow.js";

import type {
  FlowStateResolver,
  ResumeFlowError,
  ResumeFlowResult,
  UserFlowState
} from "@teleforge/core";
import type { ReactNode } from "react";

export interface FlowResumeProviderProps {
  children: ReactNode;
  indicatorDurationMs?: number;
  onFreshStart?: (reason: ResumeFlowError | null) => void;
  onResume?: (result: Extract<ResumeFlowResult, { success: true }>) => void;
  parseFlowId?: () => string | null;
  resolveRoute?: (state: UserFlowState) => string | null;
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
  const [flowState, setFlowState] = useState<UserFlowState | null>(null);
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [status, setStatus] = useState<"error" | "idle" | "resumed" | "resuming">("idle");
  const attemptedFlowRef = useRef<string | null>(null);
  const errorRef = useRef<ResumeFlowError | null>(error);
  const onFreshStartRef = useRef(onFreshStart);
  const onResumeRef = useRef(onResume);
  const parseFlowIdRef = useRef(parseFlowId);
  const resolveRouteRef = useRef(resolveRoute);
  const resolverRef = useRef(resolver);
  const timeoutRef = useRef<number | null>(null);

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
      setError(result.error);
      setFlowState(result.flowState ?? null);
      setIndicatorVisible(false);
      setRedirectTo(null);
      setStatus("error");
      return result;
    }

    setError(null);
    setFlowState(result.flowState);
    setRedirectTo(result.redirectTo);
    setStatus("resumed");
    setIndicatorVisible(true);
    scheduleIndicatorDismiss(timeoutRef, setIndicatorVisible, indicatorDurationMs);
    onResumeRef.current?.(result);

    return result;
  }

  function clear() {
    if (timeoutRef.current !== null) {
      globalThis.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setError(null);
    setFlowId(null);
    setFlowState(null);
    setIndicatorVisible(false);
    setRedirectTo(null);
    setStatus("idle");
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
  timeoutRef: { current: number | null },
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
