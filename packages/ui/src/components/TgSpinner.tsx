import React from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

export interface TgSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  lg: 24,
  md: 18,
  sm: 14
} as const;

export function TgSpinner({ size = "md" }: TgSpinnerProps) {
  const { hintColor, linkColor } = useThemeColors();
  const dimension = sizeMap[size];

  return React.createElement("span", {
    "aria-label": "Loading",
    role: "status",
    style: {
      animation: "tf-spin 0.8s linear infinite",
      border: `2px solid ${hintColor}`,
      borderRadius: "50%",
      borderTopColor: linkColor,
      boxSizing: "border-box",
      display: "inline-block",
      height: `${dimension}px`,
      width: `${dimension}px`
    }
  });
}
