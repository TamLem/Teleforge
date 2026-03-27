import { useMainButton, useTelegram } from "@teleforgex/web";
import React, { useEffect, useState } from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

import { TgSpinner } from "./TgSpinner.js";

import type { CSSProperties } from "react";

export interface MainButtonProps {
  className?: string;
  destructive?: boolean;
  disabled?: boolean;
  haptic?: "light" | "medium" | "heavy" | "none";
  loading?: boolean;
  onClick: () => void | Promise<void>;
  progress?: number;
  style?: CSSProperties;
  text: string;
  visible?: boolean;
}

/**
 * Renders a sticky primary action bar that mirrors Telegram's Main Button while keeping the
 * native Mini App button synchronized for real clients.
 */
export function MainButton({
  className,
  destructive = false,
  disabled = false,
  haptic = "none",
  loading = false,
  onClick,
  progress,
  style,
  text,
  visible = true
}: MainButtonProps) {
  const { hapticFeedback } = useTelegram();
  const { buttonColor, buttonTextColor, destructiveTextColor, secondaryBgColor } = useThemeColors();
  const [isPending, setIsPending] = useState(false);
  const isBusy = loading || isPending;
  const isDisabled = disabled || isBusy;
  const accentColor = destructive ? destructiveTextColor : buttonColor;
  const accentTextColor = destructive ? "#ffffff" : buttonTextColor;
  const mainButton = useMainButton({
    color: accentColor,
    isActive: !isDisabled,
    isProgressVisible: isBusy,
    isVisible: visible,
    text,
    textColor: accentTextColor
  });
  const normalizedProgress =
    typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;
  const handlePress = async () => {
    if (isDisabled) {
      return;
    }

    triggerHaptic(hapticFeedback, haptic);
    setIsPending(true);

    try {
      await onClick();
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    const cleanup = mainButton.onClick(handlePress);

    return cleanup;
  }, [mainButton, handlePress]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={["tf-main-button-shell", className].filter(Boolean).join(" ")}
      style={{
        background: `linear-gradient(180deg, rgba(255,255,255,0), ${secondaryBgColor})`,
        bottom: 0,
        boxSizing: "border-box",
        left: 0,
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        position: "sticky",
        width: "100%",
        zIndex: 10,
        ...style
      }}
    >
      <button
        className="tf-main-button"
        disabled={isDisabled}
        onClick={() => {
          void handlePress();
        }}
        style={{
          alignItems: "center",
          backgroundColor: accentColor,
          border: "none",
          borderRadius: "18px",
          boxShadow: destructive
            ? "0 14px 24px rgba(255, 59, 48, 0.28)"
            : "0 16px 28px rgba(36, 129, 204, 0.26)",
          color: accentTextColor,
          cursor: isDisabled ? "not-allowed" : "pointer",
          display: "inline-flex",
          fontSize: "16px",
          fontWeight: 700,
          gap: "10px",
          justifyContent: "center",
          minHeight: "56px",
          opacity: isDisabled ? 0.6 : 1,
          overflow: "hidden",
          padding: "0 20px",
          position: "relative",
          transition: "transform 160ms ease, opacity 160ms ease, box-shadow 160ms ease",
          width: "100%"
        }}
        type="button"
      >
        {normalizedProgress !== null ? (
          <span
            aria-hidden="true"
            style={{
              background: "rgba(255,255,255,0.2)",
              bottom: 0,
              left: 0,
              position: "absolute",
              top: 0,
              transform: `translateX(${normalizedProgress - 100}%)`,
              transition: "transform 220ms ease",
              width: "100%"
            }}
          />
        ) : null}
        <span
          aria-hidden="true"
          style={{
            borderRadius: "inherit",
            inset: "1px",
            position: "absolute",
            boxShadow: `inset 0 1px 0 ${destructive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.2)"}`
          }}
        />
        <span
          style={{
            alignItems: "center",
            display: "inline-flex",
            gap: "10px",
            justifyContent: "center",
            position: "relative",
            zIndex: 1
          }}
        >
          {isBusy ? React.createElement(TgSpinner, { size: "sm" }) : null}
          <span>{text}</span>
        </span>
      </button>
    </div>
  );
}

function triggerHaptic(
  hapticFeedback: ReturnType<typeof useTelegram>["hapticFeedback"],
  haptic: MainButtonProps["haptic"]
) {
  if (!haptic || haptic === "none") {
    return;
  }

  hapticFeedback.impactOccurred(haptic);
}
