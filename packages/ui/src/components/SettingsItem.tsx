import React from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

export type SettingsItemVariant = "navigation" | "toggle" | "value" | "button";

export interface SettingsItemProps {
  checked?: boolean;
  className?: string;
  destructive?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onChange?: (checked: boolean) => void;
  onClick?: () => void;
  subtitle?: string;
  title: string;
  value?: string;
  variant?: SettingsItemVariant;
}

/**
 * Renders a Telegram-style settings row with support for navigation, toggle, value, and action
 * variants.
 */
export function SettingsItem({
  checked = false,
  className,
  destructive = false,
  disabled = false,
  icon,
  onChange,
  onClick,
  subtitle,
  title,
  value,
  variant = "navigation"
}: SettingsItemProps) {
  const { destructiveTextColor, hintColor, linkColor, secondaryBgColor, textColor } =
    useThemeColors();
  const actionColor = destructive ? destructiveTextColor : textColor;
  const canPress = !disabled && (variant === "toggle" ? Boolean(onChange) : Boolean(onClick));
  const Component =
    variant === "button" || variant === "navigation" || (variant === "value" && onClick)
      ? "button"
      : "div";

  return (
    <Component
      className={["tf-settings-item", className].filter(Boolean).join(" ")}
      {...(Component === "button"
        ? {
            onClick,
            type: "button"
          }
        : {})}
      style={{
        alignItems: "center",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${secondaryBgColor}`,
        color: actionColor,
        cursor: canPress ? "pointer" : "default",
        display: "grid",
        gap: "12px",
        gridTemplateColumns: icon ? "24px minmax(0, 1fr) auto" : "minmax(0, 1fr) auto",
        minHeight: "56px",
        opacity: disabled ? 0.55 : 1,
        padding: "14px 16px",
        textAlign: "left",
        width: "100%"
      }}
    >
      {icon ? (
        <span
          style={{
            alignItems: "center",
            color: destructive ? destructiveTextColor : linkColor,
            display: "inline-flex",
            fontSize: "18px",
            height: "24px",
            justifyContent: "center",
            width: "24px"
          }}
        >
          {icon}
        </span>
      ) : null}
      <span
        style={{
          display: "grid",
          gap: subtitle ? "2px" : 0,
          minWidth: 0
        }}
      >
        <span
          style={{
            color: actionColor,
            fontSize: "16px",
            fontWeight: 600
          }}
        >
          {title}
        </span>
        {subtitle ? (
          <span
            style={{
              color: hintColor,
              fontSize: "14px",
              lineHeight: 1.4
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
      <span
        style={{
          alignItems: "center",
          color: variant === "button" ? actionColor : hintColor,
          display: "inline-flex",
          gap: "10px",
          justifyContent: "flex-end",
          minWidth: "44px"
        }}
      >
        {variant === "toggle" ? (
          <button
            aria-pressed={checked}
            className="tf-settings-toggle"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onChange?.(!checked);
            }}
            style={{
              background: checked ? linkColor : secondaryBgColor,
              border: "none",
              borderRadius: "999px",
              cursor: disabled ? "not-allowed" : "pointer",
              height: "28px",
              padding: "2px",
              position: "relative",
              transition: "background 160ms ease",
              width: "46px"
            }}
            type="button"
          >
            <span
              aria-hidden="true"
              style={{
                background: "#ffffff",
                borderRadius: "999px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.24)",
                display: "block",
                height: "24px",
                transform: checked ? "translateX(18px)" : "translateX(0)",
                transition: "transform 160ms ease",
                width: "24px"
              }}
            />
          </button>
        ) : null}
        {variant === "value" && value ? (
          <span
            style={{
              color: hintColor,
              fontSize: "15px",
              fontWeight: 500
            }}
          >
            {value}
          </span>
        ) : null}
        {variant === "navigation" ? (
          <span
            aria-hidden="true"
            style={{
              color: hintColor,
              fontSize: "18px",
              lineHeight: 1
            }}
          >
            ›
          </span>
        ) : null}
      </span>
    </Component>
  );
}
