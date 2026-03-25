import { useMainButton, useTelegram, useTheme } from "@teleforge/web";
import { useEffect } from "react";

import type { CSSProperties, ReactNode } from "react";

export interface AppShellProps {
  children: ReactNode;
  className?: string;
  fullHeight?: boolean;
  header?: {
    onBackClick?: () => void;
    showBackButton?: boolean;
    title: string;
  };
  mainButton?: {
    loading?: boolean;
    onClick: () => void;
    text: string;
    visible?: boolean;
  };
  padded?: boolean;
  safeArea?: boolean;
  style?: CSSProperties;
}

/**
 * Provides a Telegram-aware layout shell that applies theme variables, handles viewport sizing,
 * and optionally binds the Telegram Main Button to a React callback.
 */
export function AppShell({
  children,
  className,
  fullHeight = true,
  header,
  mainButton,
  padded = true,
  safeArea = true,
  style
}: AppShellProps) {
  const { viewportStableHeight } = useTelegram();
  const { bgColor, cssVariables, linkColor, secondaryBgColor, textColor } = useTheme();
  const mainButtonApi = useMainButton(
    mainButton
      ? {
          isVisible: mainButton.visible ?? true,
          text: mainButton.text
        }
      : {
          isVisible: false
        }
  );
  const {
    hide: hideMainButton,
    hideProgress,
    onClick,
    setText,
    show,
    showProgress
  } = mainButtonApi;

  useEffect(() => {
    if (!mainButton) {
      hideMainButton();
      return;
    }

    setText(mainButton.text);

    if (mainButton.visible ?? true) {
      show();
    } else {
      hideMainButton();
    }

    if (mainButton.loading) {
      showProgress();
    } else {
      hideProgress();
    }

    const cleanupClick = onClick(mainButton.onClick);

    return () => {
      cleanupClick();
      hideMainButton();
    };
  }, [hideMainButton, hideProgress, mainButton, onClick, setText, show, showProgress]);

  return (
    <div
      className={["tf-app-shell", className].filter(Boolean).join(" ")}
      style={{
        ...cssVariables,
        backgroundColor: bgColor,
        boxSizing: "border-box",
        color: textColor,
        display: "flex",
        flexDirection: "column",
        minHeight: fullHeight
          ? viewportStableHeight > 0
            ? `${viewportStableHeight}px`
            : "100vh"
          : undefined,
        paddingBottom: safeArea ? "env(safe-area-inset-bottom)" : undefined,
        paddingTop: safeArea ? "env(safe-area-inset-top)" : undefined,
        width: "100%",
        ...style
      }}
    >
      {header ? (
        <header
          className="tf-app-shell-header"
          style={{
            alignItems: "center",
            borderBottom: `1px solid ${secondaryBgColor}`,
            display: "flex",
            flexShrink: 0,
            gap: "8px",
            padding: "12px 16px"
          }}
        >
          {header.showBackButton ? (
            <button
              className="tf-back-btn"
              onClick={header.onBackClick}
              style={{
                background: "none",
                border: "none",
                color: linkColor,
                cursor: "pointer",
                fontSize: "17px",
                padding: "8px"
              }}
              type="button"
            >
              ←
            </button>
          ) : null}
          <h1
            style={{
              flex: 1,
              fontSize: "17px",
              fontWeight: 600,
              margin: 0
            }}
          >
            {header.title}
          </h1>
        </header>
      ) : null}
      <main
        className={["tf-app-shell-content", padded ? "tf-padded" : ""].filter(Boolean).join(" ")}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: padded ? "16px" : undefined,
          WebkitOverflowScrolling: "touch"
        }}
      >
        {children}
      </main>
    </div>
  );
}
