# Chat-to-MiniApp Deep Links

## Overview

A chat step action can transition directly into a Mini App step. When an action carries a `miniApp` marker, the framework renders it as a `web_app` inline keyboard button with a signed deep-link payload. The user taps once to open the Mini App at the target screen — no intermediate callback message.

Actions without a `miniApp` marker continue to render as `callback_data` buttons. Both button types can coexist in a single chat step message.

## Implementation

### `FlowActionDefinition.miniApp`

```ts
export interface FlowActionDefinition<TState, TServices = unknown> {
  id?: string;
  handler?: (...) => MaybePromise<void | FlowTransitionResult<TState>>;
  label: string;
  miniApp?: { payload?: Record<string, unknown> };
  to?: string;
}
```

When `miniApp` is present, the action renders as a `web_app` button. The optional `payload` is merged into the signed launch payload so the Mini App screen can read action-specific context (e.g. the selected item ID).

### `sendChatStepMessage`

Accepts `miniAppUrl` and `stateKey`. Per action:

- If `action.miniApp` is present **and** `miniAppUrl` is available → `createSignedPayload` + `createMiniAppButton` → `web_app` button
- Otherwise → `createFlowCallback` → `callback_data` button

### `createChatEntryCommands`

Receives `miniAppUrl` from `createDiscoveredBotRuntime` and forwards it through `enterDiscoveredFlowStep` to `sendChatStepMessage`.

### Server bridge path for return-to-chat

Inline-keyboard-launched Mini Apps cannot use `Telegram.WebApp.sendData`. The framework falls back to the server bridge:

1. Mini App calls `serverBridge.chatHandoff()` → HTTP POST to the hooks API
2. `createDiscoveredServerHooksHandler` receives the request and calls `onChatHandoff`
3. `runtime.handleChatHandoff()` advances the flow state and sends the confirmation message

The Task Shop wires this through `apps/api` (HTTP hooks server) → `apps/bot` (passes `runtime.handleChatHandoff` as the callback).

### Vite proxy

During development, Vite proxies `/api/teleforge/flow-hooks` to `localhost:3100` so the Mini App uses same-origin requests (no CORS issues, works through ngrok tunnel).

## Flow Paths

| Path                      | Mechanism                                                  | When                                                     |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Mini App entry (`/start`) | `sendFlowInit` → single `web_app` button                   | Flow with `type: "miniapp"` entry step                   |
| Chat deep link (`/shop`)  | `sendChatStepMessage` → `web_app` buttons per action       | Action with `miniApp` marker                             |
| Callback transition       | `callback_data` button → `sendFlowInit` → `web_app` button | Action without `miniApp` marker targeting a miniapp step |
| Return to chat            | `sendData` or `serverBridge.chatHandoff()`                 | Mini App step targeting `type: "chat"` step              |

## Backward Compatibility

- Actions without `miniApp` render as `callback_data` buttons unchanged.
- The `miniApp` field is optional. Existing flows work without modification.
- The two-message callback path remains valid for actions that run a handler before transitioning.

## Implementation Files

| File                                         | Change                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/teleforge/src/flow-definition.ts`  | `miniApp` field on `FlowActionDefinition`                                                                                                       |
| `packages/teleforge/src/bot-runtime.ts`      | `sendChatStepMessage` renders `web_app` buttons; `createChatEntryCommands` forwards `miniAppUrl`; `handleChatHandoff` on `DiscoveredBotRuntime` |
| `packages/teleforge/src/miniapp-runtime.tsx` | `transmitMiniAppChatHandoff` falls back to `serverBridge.chatHandoff()` when `sendData` unavailable                                             |
| `packages/teleforge/src/server-bridge.ts`    | `chatHandoff` method on `TeleforgeMiniAppServerBridge`                                                                                          |
| `packages/teleforge/src/server-hooks.ts`     | `onChatHandoff` handler option on `createDiscoveredServerHooksHandler`                                                                          |
| `apps/task-shop/apps/api/`                   | HTTP hooks server wiring `onChatHandoff` → `runtime.handleChatHandoff`                                                                          |
| `apps/task-shop/apps/web/vite.config.ts`     | Proxy `/api/teleforge/flow-hooks` to `localhost:3100`                                                                                           |
