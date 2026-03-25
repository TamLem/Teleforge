import { TgButton, TgCard, TgText } from "@teleforge/ui";

interface CartSummaryProps {
  actionLabel: string;
  count: number;
  onAction: () => void;
  subtitle: string;
  total: number;
}

export function CartSummary({ actionLabel, count, onAction, subtitle, total }: CartSummaryProps) {
  return (
    <TgCard padding="lg">
      <div className="summary-card">
        <div>
          <TgText variant="subtitle">Cart summary</TgText>
          <TgText variant="hint">{subtitle}</TgText>
        </div>
        <dl className="summary-grid">
          <div>
            <dt>Items</dt>
            <dd>{count}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{total} Stars</dd>
          </div>
        </dl>
        <TgButton onClick={onAction} variant="primary">
          {actionLabel}
        </TgButton>
      </div>
    </TgCard>
  );
}
