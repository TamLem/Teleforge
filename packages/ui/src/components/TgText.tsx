import React from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

export interface TgTextProps {
  children: React.ReactNode;
  className?: string;
  variant?: "title" | "subtitle" | "body" | "caption" | "hint";
}

const variantStyles = {
  body: {
    fontSize: "15px",
    fontWeight: 400
  },
  caption: {
    fontSize: "13px",
    fontWeight: 400
  },
  hint: {
    fontSize: "13px",
    fontWeight: 400
  },
  subtitle: {
    fontSize: "17px",
    fontWeight: 600
  },
  title: {
    fontSize: "22px",
    fontWeight: 700
  }
} as const;

/**
 * Displays themed text using Telegram-friendly typography presets.
 */
export function TgText({ children, className, variant = "body" }: TgTextProps) {
  const { hintColor, textColor } = useThemeColors();

  return React.createElement(
    "span",
    {
      className,
      style: {
        color: variant === "hint" ? hintColor : textColor,
        display: "inline-block",
        ...variantStyles[variant]
      }
    },
    children
  );
}
