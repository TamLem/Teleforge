import { AppShell, MainButton, SettingsItem, SettingsSection, TgCard, TgText } from "@teleforge/ui";
import { useTelegram, useTheme } from "@teleforge/web";
import { useMemo, useState } from "react";

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

  const handleClose = () => {
    telegram.close();
    setStatus("Sent a close request to Telegram.");
  };

  return (
    <AppShell
      header={{
        title: "Starter App"
      }}
      style={theme.cssVariables}
    >
      <div className="starter-shell">
        <TgCard className="starter-hero">
          <TgText variant="headline">Teleforge Starter</TgText>
          <TgText variant="body">
            This Mini App shows the live Telegram theme, user context, and MainButton wiring with
            the smallest possible surface.
          </TgText>
        </TgCard>

        <SettingsSection title="Session">
          <SettingsItem title="User" value={userLabel || "Anonymous preview"} variant="value" />
          <SettingsItem title="Platform" value={telegram.platform} variant="value" />
          <SettingsItem title="Theme" value={theme.colorScheme} variant="value" />
          <SettingsItem
            title="Bridge"
            value={telegram.isMock ? "teleforge-mock" : "telegram"}
            variant="value"
          />
          <SettingsItem
            title="Ready"
            value={telegram.isReady ? "yes" : "booting"}
            variant="value"
          />
        </SettingsSection>

        <SettingsSection
          footer="The local mock overlay can switch Telegram themes without a reload. In real Telegram sessions the theme comes from the client."
          title="Actions"
        >
          <SettingsItem onClick={handleToggleTheme} title="Toggle mock theme" variant="button" />
          <SettingsItem onClick={handleExpand} title="Expand Mini App" variant="button" />
        </SettingsSection>

        <TgCard className="starter-status">
          <TgText variant="subtitle">Status</TgText>
          <TgText variant="hint">{status}</TgText>
        </TgCard>

        <MainButton onClick={handleClose} text="Close Mini App" />
      </div>
    </AppShell>
  );
}
