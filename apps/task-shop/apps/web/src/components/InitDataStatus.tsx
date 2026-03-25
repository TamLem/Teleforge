import { TgCard, TgText } from "@teleforge/ui";

import { useInitDataValidation } from "../hooks/useInitDataValidation";

export function InitDataStatus() {
  const state = useInitDataValidation();

  return (
    <TgCard padding="md">
      <div className="status-card">
        <div className={`status-pill status-pill--${state.status}`}>{state.status}</div>
        <div>
          <TgText variant="subtitle">Telegram initData check</TgText>
          <TgText variant="body">{state.message}</TgText>
        </div>
      </div>
    </TgCard>
  );
}
