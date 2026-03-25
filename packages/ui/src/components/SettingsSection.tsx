import React from "react";

import { useThemeColors } from "../hooks/useThemeColors.js";

export interface SettingsSectionProps {
  children: React.ReactNode;
  footer?: string;
  title?: string;
}

/**
 * Groups settings rows with Telegram-style section chrome, optional header text, and footer copy.
 */
export function SettingsSection({ children, footer, title }: SettingsSectionProps) {
  const { bgColor, hintColor, secondaryBgColor } = useThemeColors();

  return (
    <section
      style={{
        display: "grid",
        gap: "8px"
      }}
    >
      {title ? (
        <header
          style={{
            color: hintColor,
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            padding: "0 4px",
            textTransform: "uppercase"
          }}
        >
          {title}
        </header>
      ) : null}
      <div
        style={{
          background: bgColor,
          border: `1px solid ${secondaryBgColor}`,
          borderRadius: "18px",
          overflow: "hidden"
        }}
      >
        {children}
      </div>
      {footer ? (
        <footer
          style={{
            color: hintColor,
            fontSize: "13px",
            lineHeight: 1.5,
            padding: "0 4px"
          }}
        >
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
