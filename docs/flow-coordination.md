# Flow Coordination

Flow coordination is Teleforge's main product model: a user can start in chat, continue in the Mini App, and return to chat while the framework preserves flow state across surfaces.

Use this guide after [Build Your First Feature](./first-feature.md). It describes the current high-level architecture used by generated apps and `teleforge start`.

## Mental Model

```txt
flow -> step -> screen -> transition
```

- **Flow**: the complete journey, including state, entry command, and step graph.
- **Step**: one interaction point, either `type: "chat"` or `type: "miniapp"`.
- **Screen**: a React module registered with `defineScreen()` and referenced by a Mini App step.
- **Transition**: a state update and optional move to another step.
- **Runtime**: framework-owned bot, Mini App, server bridge, and custom server-hook wiring.

The app author should normally edit flow files and screen files. Teleforge owns command routing, signed Mini App launch payloads, client manifest generation, server-hook routing, and bot delivery.

## Default Lifecycle

For a generated app, the normal lifecycle is:

1. User sends a bot command such as `/start`.
2. `startTeleforgeBot()` loads `teleforge.config.ts`, discovers flows, and enters the command's flow.
3. The bot sends a Mini App launch button when the flow enters a Mini App step.
4. `TeleforgeMiniApp` resolves the current URL against the client flow manifest and renders the matching screen.
5. The screen calls `submit()` or an action helper.
6. Teleforge runs the matching flow handler or trusted server hook, updates state, and moves to the next step.
7. If the next step is a chat step, Teleforge hands control back to the bot runtime and renders the chat message.

The same flow definition owns both chat and Mini App steps. Do not split one journey into separate "bot flow" and "Mini App flow" files.

## Flow Definition

```ts
import { chatStep, defineFlow, miniAppStep, openMiniAppAction } from "teleforge";

export default defineFlow({
  id: "checkout",
  initialStep: "welcome",
  state: {
    selectedItemId: null as string | null
  },
  bot: {
    command: {
      command: "start",
      description: "Start checkout",
      text: "Open checkout to continue."
    }
  },
  miniApp: {
    route: "/checkout"
  },
  steps: {
    welcome: chatStep("Ready to shop?", [openMiniAppAction("Open checkout", "catalog")]),
    catalog: miniAppStep("catalog"),
    done: {
      type: "chat",
      message: ({ state }) =>
        state.selectedItemId ? `Selected ${state.selectedItemId}.` : "No item selected."
    }
  }
});
```

Raw step objects are also supported when a helper does not fit:

```ts
catalog: {
  screen: "catalog",
  type: "miniapp",
  onSubmit({ data, state }) {
    return {
      state: { ...state, selectedItemId: String(data.itemId) },
      to: "done"
    };
  }
}
```

## Screen Registration

Mini App screens live under the configured screen root, normally `apps/web/src/screens`.

```tsx
import { defineScreen, useTeleforgeMiniAppRuntime } from "teleforge/web";

function CatalogScreen() {
  const runtime = useTeleforgeMiniAppRuntime();

  return (
    <button onClick={() => runtime.submit({ itemId: "task-001" })}>
      Select task-001
    </button>
  );
}

export default defineScreen({
  component: CatalogScreen,
  id: "catalog",
  title: "Catalog"
});
```

`apps/web/src/main.tsx` is the framework-owned Mini App shell:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { TeleforgeMiniApp } from "teleforge/web";

import { flowManifest } from "./teleforge-generated/client-flow-manifest.js";
import catalogScreen from "./screens/catalog.screen.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TeleforgeMiniApp flowManifest={flowManifest} screens={[catalogScreen]} />
  </React.StrictMode>
);
```

The client manifest is browser-safe. Do not import `apps/bot/src/flows/*` from the web entry; flow files may contain server-only handlers or dependencies. `teleforge dev` refreshes the manifest when stale, and `teleforge doctor` reports drift.

## Trusted Server Work

Keep simple state transitions in flow `onSubmit` handlers. Use server hooks when a step needs authority the browser cannot have:

- private data loading
- permission checks
- durable writes
- payment/order/session creation
- calls to services with server-only credentials

Generated apps include the API surface by default because coordinated chat and Mini App flows need the server bridge:

```bash
create-teleforge-app my-app
```

The default convention is:

```txt
apps/api/src/flow-hooks/{flowId}/{stepId}.ts
```

At runtime, `teleforge start` starts the framework-owned server bridge so Mini App loads, submits, actions, and chat handoff can use bot-owned flow state.

## Runtime Communication Contract

Bot, Mini App, API, and server bridge code should communicate through framework contracts rather than process-local objects:

- server bridge requests: `load`, `submit`, `action`, and `chatHandoff`
- flow storage: shared `UserFlowStateManager` over a durable `StorageAdapter`
- event bus: `TeleforgeEventBus` and typed event sources for bot, Mini App, API, and system events
- Telegram webhook or polling updates as transport input, not application state

In local development these pieces can run in one process. In production they can run as split processes as long as both sides share storage and emit or consume events through the same application contract.

```ts
import { createEventBus } from "@teleforgex/core";

export const events = createEventBus({
  source: { surface: "api" }
});

events.emit("user:action", {
  action: "checkout.submit",
  data: { source: "miniapp" }
});
```

## Chat Handoff

When a Mini App action transitions to a chat step, Teleforge attempts to hand control back to the bot runtime. The high-level runtime wires this path for generated apps and `teleforge start`.

For most apps, the important rule is simple: keep the chat step in the same flow.

```ts
steps: {
  catalog: {
    screen: "catalog",
    type: "miniapp",
    actions: [
      {
        id: "complete",
        label: "Return to chat",
        to: "done"
      }
    ]
  },
  done: {
    type: "chat",
    message: "Done."
  }
}
```

## Anti-Pattern: Splitting One Journey Across Flows

Do not create one flow for chat entry and another flow for the Mini App continuation when they are one user journey.

The runtime signs launch context for a single `flowId` and advances steps inside that same flow. If a Mini App submit returns `{ to: "confirm" }`, the runtime looks for `confirm` in the flow that owns the active instance.

```ts
// Good: one flow owns both surfaces.
defineFlow({
  id: "onboarding",
  steps: {
    welcome: { type: "chat", ... },
    profile: { type: "miniapp", screen: "profile" },
    confirm: { type: "chat", ... }
  }
});

// Bad: state and transitions are split across unrelated flows.
defineFlow({ id: "start", steps: { welcome: { type: "chat", ... } } });
defineFlow({ id: "profile", steps: { profile: { type: "miniapp", ... } } });
```

## Escape Hatches

Advanced apps can still assemble lower-level runtime pieces manually:

- `createDiscoveredBotRuntime()` for custom bot process ownership, storage, or service injection
- `createDiscoveredServerHooksHandler()` for custom HTTP hosting
- `teleforge/bot` webhook adapters for non-standard server frameworks

Treat these as escape hatches. The default app path is `teleforge.config.ts`, flow files, screen files, the server bridge, `teleforge dev`, and `teleforge start`.

## Read Alongside

- [Framework Model](./framework-model.md)
- [Server Hooks](./server-hooks.md)
- [Flow State Architecture](./flow-state-design.md)
- [Deployment](./deployment.md)
