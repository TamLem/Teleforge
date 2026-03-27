import { useLaunch, useTelegram } from "@teleforgex/web";
import React, { useEffect, useMemo, useRef } from "react";

import { useLaunchMode, type LaunchMode } from "../hooks/useLaunchMode.js";

import { TgButton } from "./TgButton.js";
import { TgCard } from "./TgCard.js";
import { TgSpinner } from "./TgSpinner.js";
import { TgText } from "./TgText.js";

export interface LaunchModeBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  modes: LaunchMode[];
  onModeChange?: (mode: LaunchMode) => void;
  redirectTo?: string;
  showExpandPrompt?: boolean;
}

/**
 * Guards a subtree behind one or more Telegram launch modes and renders loading, fallback,
 * redirect, or expand affordances when the current mode is not allowed.
 */
export function LaunchModeBoundary({
  children,
  fallback,
  modes,
  onModeChange,
  redirectTo,
  showExpandPrompt = false
}: LaunchModeBoundaryProps) {
  const { capabilities, isReady } = useLaunch();
  const { expand } = useTelegram();
  const { canRender, mode } = useLaunchMode();
  const lastModeRef = useRef<LaunchMode | null>(null);
  const requiredModesLabel = useMemo(() => modes.map(formatModeLabel).join(" or "), [modes]);
  const shouldShowLoading = !isReady || mode === null;
  const shouldRedirect = Boolean(redirectTo) && mode !== null && !canRender(modes) && !fallback;
  const canShowExpandPrompt =
    showExpandPrompt &&
    capabilities.canExpand &&
    mode !== null &&
    !canRender(modes) &&
    modes.includes("fullscreen");

  useEffect(() => {
    if (!mode || mode === lastModeRef.current) {
      return;
    }

    lastModeRef.current = mode;
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    if (!shouldRedirect || typeof window === "undefined" || !redirectTo) {
      return;
    }

    window.location.replace(redirectTo);
  }, [redirectTo, shouldRedirect]);

  if (shouldShowLoading) {
    return (
      <CenteredCard>
        <TgSpinner size="lg" />
        <TgText variant="hint">Detecting launch mode...</TgText>
      </CenteredCard>
    );
  }

  if (canRender(modes)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (shouldRedirect) {
    return null;
  }

  if (canShowExpandPrompt) {
    return (
      <CenteredCard>
        <TgText variant="title">Expand required</TgText>
        <TgText variant="body">
          This view needs {requiredModesLabel}. Expand the Mini App to continue.
        </TgText>
        <TgButton onClick={expand} variant="primary">
          Expand App
        </TgButton>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <TgText variant="title">Unsupported view</TgText>
      <TgText variant="body">This content is not available in {mode} mode.</TgText>
      <TgText variant="hint">Open the app in {requiredModesLabel} to continue.</TgText>
    </CenteredCard>
  );
}

/**
 * Restricts rendering to fullscreen Mini App launches.
 */
export function FullscreenOnly(props: Omit<LaunchModeBoundaryProps, "modes">) {
  return <LaunchModeBoundary {...props} modes={["fullscreen"]} />;
}

/**
 * Restricts rendering to compact or fullscreen launches.
 */
export function ExpandedOnly(props: Omit<LaunchModeBoundaryProps, "modes">) {
  return <LaunchModeBoundary {...props} modes={["compact", "fullscreen"]} />;
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "24px 0"
      }}
    >
      <div style={{ maxWidth: "360px", width: "100%" }}>
        <TgCard padding="lg">
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              textAlign: "center"
            }}
          >
            {children}
          </div>
        </TgCard>
      </div>
    </div>
  );
}

function formatModeLabel(mode: LaunchMode): string {
  switch (mode) {
    case "compact":
      return "compact mode";
    case "fullscreen":
      return "fullscreen mode";
    case "inline":
    default:
      return "inline mode";
  }
}
