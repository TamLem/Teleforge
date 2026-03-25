import React from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

export interface TgCardProps {
  children: React.ReactNode;
  elevation?: "flat" | "raised" | "floating";
  padding?: "sm" | "md" | "lg";
}

const paddingMap = {
  lg: "20px",
  md: "16px",
  sm: "12px"
} as const;

const shadowMap = {
  flat: "none",
  floating: "0 18px 32px rgba(0, 0, 0, 0.12)",
  raised: "0 8px 20px rgba(0, 0, 0, 0.08)"
} as const;

/**
 * Renders a padded surface with Telegram-aware colors and selectable elevation presets.
 */
export function TgCard({ children, elevation = "raised", padding = "md" }: TgCardProps) {
  const { bgColor, secondaryBgColor, textColor } = useThemeColors();

  return React.createElement(
    "section",
    {
      style: {
        background: bgColor,
        border: `1px solid ${secondaryBgColor}`,
        borderRadius: "18px",
        boxShadow: shadowMap[elevation],
        color: textColor,
        padding: paddingMap[padding]
      }
    },
    children
  );
}
