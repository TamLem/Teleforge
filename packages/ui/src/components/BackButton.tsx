import { useBackButton, useTelegram } from "@teleforgex/web";
import React, { useEffect } from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

export interface BackButtonProps {
  className?: string;
  haptic?: "light" | "medium" | "heavy" | "none";
  onClick: () => void;
  visible?: boolean;
}

/**
 * Renders an inline back button that mirrors Telegram's native Back Button while remaining
 * available during SSR and desktop preview flows.
 */
export function BackButton({
  className,
  haptic = "none",
  onClick,
  visible = true
}: BackButtonProps) {
  const { hapticFeedback } = useTelegram();
  const { linkColor, secondaryBgColor } = useThemeColors();
  const backButton = useBackButton({
    isVisible: visible
  });

  useEffect(() => {
    const cleanup = backButton.onClick(() => {
      triggerHaptic(hapticFeedback, haptic);
      onClick();
    });

    return cleanup;
  }, [backButton, haptic, hapticFeedback, onClick]);

  if (!visible) {
    return null;
  }

  return (
    <button
      className={["tf-back-button", className].filter(Boolean).join(" ")}
      onClick={() => {
        triggerHaptic(hapticFeedback, haptic);
        onClick();
      }}
      style={{
        alignItems: "center",
        backgroundColor: secondaryBgColor,
        border: "none",
        borderRadius: "999px",
        color: linkColor,
        cursor: "pointer",
        display: "inline-flex",
        fontSize: "17px",
        fontWeight: 700,
        height: "36px",
        justifyContent: "center",
        minWidth: "36px",
        padding: "0 12px",
        transition: "transform 160ms ease, opacity 160ms ease"
      }}
      type="button"
    >
      ←
    </button>
  );
}

function triggerHaptic(
  hapticFeedback: ReturnType<typeof useTelegram>["hapticFeedback"],
  haptic: BackButtonProps["haptic"]
) {
  if (!haptic || haptic === "none") {
    return;
  }

  hapticFeedback.impactOccurred(haptic);
}
