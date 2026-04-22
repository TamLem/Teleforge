import { useEffect, useMemo, useState } from "react";
import { useTelegram, useTheme, useMainButton } from "teleforge/web";

type MockTheme = "dark" | "light";

declare global {
  interface Window {
    __teleforgeMock?: {
      setTheme?: (theme: MockTheme) => void;
    };
  }
}

export default function App() {
  const telegram = useTelegram();
  const theme = useTheme();
  const [status, setStatus] = useState("Ready");

  const mainButton = useMainButton({
    isVisible: true,
    text: "Close Mini App"
  });

  useEffect(() => {
    const cleanup = mainButton.onClick(() => {
      telegram.close();
      setStatus("Sent a close request to Telegram.");
    });
    return cleanup;
  }, [mainButton, telegram]);

  const userLabel = useMemo(() => {
    if (!telegram.user) {
      return "Anonymous preview";
    }

    const pieces = [telegram.user.first_name, telegram.user.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    return telegram.user.username
      ? `${pieces || telegram.user.username} (@${telegram.user.username})`
      : pieces;
  }, [telegram.user]);

  const handleToggleTheme = () => {
    const nextTheme: MockTheme = theme.isDark ? "light" : "dark";
    if (window.__teleforgeMock?.setTheme) {
      window.__teleforgeMock.setTheme(nextTheme);
      setStatus(`Switched mock theme to ${nextTheme}.`);
      return;
    }

    setStatus("Theme follows Telegram outside the local mock bridge.");
  };

  const handleExpand = () => {
    telegram.expand();
    setStatus("Requested Telegram to expand the Mini App.");
  };

  return (
    <main
      className="shell"
      style={{
        background: theme.bgColor,
        color: theme.textColor,
        minHeight: "100vh"
      }}
    >
      <header className="hero">
        <p className="eyebrow" style={{ color: theme.hintColor }}>
          Teleforge Starter
        </p>
        <h1>Starter App</h1>
        <p className="lede" style={{ color: theme.hintColor }}>
          This Mini App shows the live Telegram theme, user context, and
          MainButton wiring through teleforge/web hooks directly.
        </p>
      </header>

      <section
        className="card stack"
        style={{ background: theme.secondaryBgColor }}
      >
        <p className="badge" style={{ color: theme.hintColor }}>
          Screen: home
        </p>
        <h2>Session</h2>
        <div className="row">
          <span style={{ color: theme.hintColor }}>User</span>
          <span>{userLabel || "Anonymous preview"}</span>
        </div>
        <div className="row">
          <span style={{ color: theme.hintColor }}>Platform</span>
          <span>{telegram.platform}</span>
        </div>
        <div className="row">
          <span style={{ color: theme.hintColor }}>Theme</span>
          <span>{theme.colorScheme}</span>
        </div>
        <div className="row">
          <span style={{ color: theme.hintColor }}>Bridge</span>
          <span>{telegram.isMock ? "teleforge-mock" : "telegram"}</span>
        </div>
        <div className="row">
          <span style={{ color: theme.hintColor }}>Ready</span>
          <span>{telegram.isReady ? "yes" : "booting"}</span>
        </div>
      </section>

      <section
        className="card stack"
        style={{ background: theme.secondaryBgColor }}
      >
        <h2>Actions</h2>
        <button
          onClick={handleToggleTheme}
          style={{
            background: theme.buttonColor,
            color: theme.buttonTextColor
          }}
        >
          Toggle mock theme
        </button>
        <button
          onClick={handleExpand}
          style={{
            background: theme.buttonColor,
            color: theme.buttonTextColor
          }}
        >
          Expand Mini App
        </button>
      </section>

      <section
        className="card stack"
        style={{ background: theme.secondaryBgColor }}
      >
        <h2>Status</h2>
        <p style={{ color: theme.hintColor }}>{status}</p>
      </section>
    </main>
  );
}
