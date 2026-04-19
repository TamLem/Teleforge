import { AppShell, TgButton, TgText } from "teleforge/ui";

import type { ReactNode } from "react";

interface TaskShopFrameProps {
  actions?: ReactNode;
  backLabel?: string;
  children: ReactNode;
  onBack?: () => void;
  subtitle?: string;
  title: string;
}

export function TaskShopFrame({
  actions,
  backLabel = "Back",
  children,
  onBack,
  subtitle,
  title
}: TaskShopFrameProps) {
  return (
    <AppShell
      header={{
        onBackClick: onBack,
        showBackButton: Boolean(onBack),
        title
      }}
      style={{
        background:
          "radial-gradient(circle at top left, rgba(255, 200, 87, 0.16), transparent 32%), radial-gradient(circle at top right, rgba(46, 196, 182, 0.14), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,248,252,0.98))"
      }}
    >
      <div className="task-shop-shell">
        <section className="cart-banner">
          <div>
            <TgText variant="subtitle">{title}</TgText>
            {subtitle ? <TgText variant="hint">{subtitle}</TgText> : null}
          </div>
          <div className="hero-card__actions">
            {onBack ? (
              <TgButton onClick={onBack} size="sm" variant="secondary">
                {backLabel}
              </TgButton>
            ) : null}
            {actions}
          </div>
        </section>
        {children}
      </div>
    </AppShell>
  );
}
