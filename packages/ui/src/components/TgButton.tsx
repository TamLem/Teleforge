import React from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

import { TgSpinner } from "./TgSpinner.js";

export interface TgButtonProps {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "destructive";
}

const sizeStyles = {
  lg: {
    fontSize: "16px",
    padding: "14px 20px"
  },
  md: {
    fontSize: "15px",
    padding: "12px 16px"
  },
  sm: {
    fontSize: "13px",
    padding: "9px 12px"
  }
} as const;

/**
 * Renders a theme-aware button that matches Telegram Mini App colors and supports loading,
 * disabled, and variant states.
 */
export function TgButton({
  children,
  disabled = false,
  loading = false,
  onClick,
  size = "md",
  variant = "primary"
}: TgButtonProps) {
  const { buttonColor, buttonTextColor, secondaryBgColor, textColor } = useThemeColors();
  const appearance = getVariantStyles(variant, {
    buttonColor,
    buttonTextColor,
    secondaryBgColor,
    textColor
  });

  return React.createElement(
    "button",
    {
      disabled: disabled || loading,
      onClick,
      style: {
        ...sizeStyles[size],
        alignItems: "center",
        backgroundColor: appearance.backgroundColor,
        border: appearance.border,
        borderRadius: "14px",
        color: appearance.color,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        display: "inline-flex",
        fontWeight: 600,
        gap: "8px",
        justifyContent: "center",
        opacity: disabled || loading ? 0.55 : 1,
        transition: "opacity 160ms ease, transform 160ms ease"
      },
      type: "button"
    },
    loading
      ? React.createElement(TgSpinner, {
          size: "sm"
        })
      : null,
    children
  );
}

function getVariantStyles(
  variant: TgButtonProps["variant"],
  colors: {
    buttonColor: string;
    buttonTextColor: string;
    secondaryBgColor: string;
    textColor: string;
  }
) {
  switch (variant) {
    case "secondary":
      return {
        backgroundColor: colors.secondaryBgColor,
        border: "1px solid transparent",
        color: colors.textColor
      };
    case "destructive":
      return {
        backgroundColor: "#d9534f",
        border: "1px solid transparent",
        color: "#ffffff"
      };
    case "primary":
    default:
      return {
        backgroundColor: colors.buttonColor,
        border: "1px solid transparent",
        color: colors.buttonTextColor
      };
  }
}
