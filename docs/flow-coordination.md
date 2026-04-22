# Flow Coordination

Flow coordination is Teleforge's main differentiator: a user starts in chat, continues in the Mini App, and returns to chat with structured state persisted across surfaces.

This guide walks through the flow-first coordination model using `apps/task-shop`.

## Core Mental Model

```
flow → step → screen → transition
```

- **Flow** defines the state machine: initial step, state shape, and step transitions
- **Step** is a node in the flow: either `type: "chat"` (message with buttons) or `type: "miniapp"` (screen)
- **Screen** is a React component registered by ID that renders a miniapp step
- **Transition** is a state update + optional step change, triggered by submit or action

## The Lifecycle

The coordinated flow in Task Shop is:

1. User sends `/start` in chat → bot creates a `FlowInstance`
2. Bot sends a Mini App button with signed flow context URL
3. Mini App opens, resolves screen from URL, loads persisted state
4. User navigates screens, submits data → flow `onSubmit` handlers run
5. Final step targets `chat` → Mini App transmits handoff to bot
6. Bot renders chat step message with confirmation and next actions

## 1. Define the Flow

Open [`apps/task-shop/apps/bot/src/flows/task-shop-browse.flow.ts`](../../apps/task-shop/apps/bot/src/flows/task-shop-browse.flow.ts).

```ts
export default defineFlow<TaskShopFlowState>({
  id: "task-shop-browse",
  initialStep: "catalog",
  finalStep: "completed",
  state: { cart: [], lastOrder: null, selectedTaskId: null },
  bot: {
    command: {
      command: "start",
      description: "Open the Task Shop Mini App",
      text: "Welcome to Task Shop..."
    }
  },
  miniApp: {
    route: "/",
    stepRoutes: {
      cart: "/cart",
      checkout: "/checkout",
      detail: "/detail",
      success: "/success"
    }
  },
  steps: {
    catalog: {
      screen: "task-shop.catalog",
      type: "miniapp",
      async onSubmit({ data, state }) {
        // Handle add-item, view-detail, go-to-cart, go-to-checkout
      }
    },
    checkout: {
      screen: "task-shop.checkout",
      type: "miniapp",
      async onSubmit({ data, state }) {
        if (data.type === "complete-order") {
          return {
            state: { ...state, cart: [], lastOrder: createOrderFromCart(state.cart) },
            to: "success"
          };
        }
      }
    },
    success: {
      screen: "task-shop.success",
      type: "miniapp"
      // actions array defines "return-to-chat" button
    },
    completed: {
      type: "chat",
      message: ({ state }) => `Order confirmed! Total: ${state.lastOrder?.total} Stars`
    }
  }
});
```

This file defines:

- The flow ID: `task-shop-browse`
- The state shape: `TaskShopFlowState`
- The steps and their types (`miniapp` or `chat`)
- The `onSubmit` handlers that process Mini App submissions
- The bot command that enters the flow
- The Mini App routes for each step

## 2. Enter the Flow from the Bot

Open [`apps/task-shop/apps/bot/src/index.ts`](../../apps/task-shop/apps/bot/src/index.ts).

The bot uses `createDiscoveredBotRuntime` which automatically:

1. Discovers all `.flow.ts` files in `apps/bot/src/flows/`
2. Registers bot commands from each flow's `bot.command` definition
3. Creates a `UserFlowStateManager` with configured storage
4. Binds update handlers for commands, callbacks, and `web_app_data`

When the user sends `/start`:

```ts
// Framework automatically:
// 1. storage.startInstance(userId, flowId, initialStep, initialState, chatId)
// 2. Creates signed flow context URL with stateKey
// 3. Sends Mini App button with the signed URL
```

The chat button's `web_app.url` contains:

```
https://app.ngrok.app?tgWebAppStartParam=tfp1.{signedPayload}
```

The signed payload includes: `flowId`, `stepId`, `stateKey`, `route`, and any `miniApp.payload` from the action.

## 3. Register Screens in the Mini App

Open [`apps/task-shop/apps/web/src/main.tsx`](../../apps/task-shop/apps/web/src/main.tsx).

```tsx
import { TeleforgeMiniApp, createFetchMiniAppServerBridge } from "teleforge/web";

import { flowManifest } from "./teleforge-generated/client-flow-manifest.js";

const serverBridge = createFetchMiniAppServerBridge();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <TeleforgeMiniApp
    flowManifest={flowManifest}
    screens={[catalogScreen, cartScreen, checkoutScreen, successScreen, taskDetailScreen]}
    serverBridge={serverBridge}
  />
);
```

The `TeleforgeMiniApp` shell:

1. Resolves the current pathname to a flow step using `resolveMiniAppScreen`
2. Loads persisted state from the server bridge
3. Merges launch payload (e.g., `selectedItem` from chat button) into state
4. Renders the matching screen component with `state`, `submit`, `transitioning` props

The manifest is intentionally client-safe. Do not import `apps/bot/src/flows/*` from the web entry; flow modules may contain server handlers and Node-only dependencies.

## 4. Implement a Screen

Open [`apps/task-shop/apps/web/src/screens/catalog.screen.tsx`](../../apps/task-shop/apps/web/src/screens/catalog.screen.tsx).

```tsx
export default defineScreen<TaskShopFlowState>({
  id: "task-shop.catalog",
  title: "Browse Tasks",
  component({ state, submit, transitioning }) {
    const handleSubmit = (payload: TaskShopSubmitPayload) => void submit?.(payload);

    return (
      <TaskShopFrame title="Task Shop">
        <div className="catalog-grid">
          {mockTasks.map((task) => (
            <TaskCard
              key={task.id}
              onAdd={() => handleSubmit({ taskId: task.id, type: "add-item" })}
              onViewDetail={() => handleSubmit({ taskId: task.id, type: "view-detail" })}
              task={task}
            />
          ))}
        </div>
      </TaskShopFrame>
    );
  }
});
```

Screens receive:

- **`state`** — The authoritative `FlowInstance.state` (from storage, merged with launch payload)
- **`submit`** — Function to call flow `onSubmit` handler (triggers server-side transition)
- **`transitioning`** — Boolean indicating a submit is in progress
- **`loaderData`** — Optional data from server-side loader

## 5. Submit and Transition

When the user clicks "Add to cart":

```
Screen calls submit({ taskId: "task-001", type: "add-item" })
  → executeMiniAppStepSubmit()
    → serverBridge.submit({ data, flowId, state, stepId, stateKey })
      → POST /api/teleforge/flow-hooks submit
        → Server executes flow.onSubmit({ data, state })
          → Returns { state: { cart: [...] } } (no `to` → stays on same step)
            → Client updates state, re-renders screen
```

When the user clicks "Complete purchase":

```
Screen calls submit({ type: "complete-order" })
  → Server executes flow.onSubmit()
    → Returns { state: { cart: [], lastOrder: {...} }, to: "success" }
      → Client transitions to success screen
        → URL updates to /success
          → persistMiniAppSnapshot saves state to sessionStorage
```

## 6. Return to Chat (Handoff)

When the user clicks "Return to chat" on the success screen:

```
Screen action "return-to-chat" triggers
  → executeMiniAppStepAction()
    → Server finds action "return-to-chat" in flow definition
      → Returns target: "chat", stepId: "completed"
        → applyMiniAppExecutionResult()
          → target === "chat"
            → transmitMiniAppChatHandoff()
              → serverBridge.chatHandoff({ flowContext, state, stateKey, stepId: "completed" })
                → POST /api/teleforge/flow-hooks chatHandoff
                  → Bot's handleChatHandoff() receives the call
                    → storage.advanceStep(stateKey, "completed", state, "chat")
                    → enterDiscoveredFlowStep()
                      → sendChatStepMessage()
                        → "Order confirmed! Items: 1, Total: 10 Stars"
```

## Chat-To-Mini App Deep Links

A chat step action can transition directly into a Mini App step. When an action carries a `miniApp` marker, the framework renders it as a `web_app` inline keyboard button with a signed deep-link payload.

Actions without a `miniApp` marker render as `callback_data` buttons. Both button types can coexist in a single chat step message.

```ts
actions: [
  {
    label: "Open checkout",
    miniApp: { payload: { source: "chat" } },
    to: "checkout"
  },
  {
    label: "Ask a question",
    to: "support"
  }
];
```

Runtime behavior:

- `miniApp` action with `miniAppUrl` available → signed launch payload + `web_app` button
- action without `miniApp` → callback data button
- Mini App return to chat → `sendData` when available, otherwise server-hook bridge `chatHandoff`

During local development, Task Shop proxies `/api/teleforge/flow-hooks` to the hooks server so the Mini App can use same-origin requests through the simulator and tunnel.

## Standalone Mode

When the Mini App is opened from Telegram's Mini Apps menu (no `tgWebAppStartParam`):

1. `launchCoordination` returns `flowContext: null, stateKey: null`
2. `resolveScreenWithStandaloneFallback` detects this and redirects to the first `type: "miniapp"` step
3. Chat handoff is skipped — the app stays in the Mini App
4. Screens should handle missing state gracefully (e.g., show a product picker when `selectedItem` is null)

## Anti-Pattern: Splitting a Journey Across Flows

Do not split a user journey that crosses chat and Mini App surfaces into separate "entry flow" and "miniapp flow" definitions. For example, do not create a `start` flow with a chat step and a separate `onboard` flow with a Mini App step when those steps belong to the same journey.

The framework scopes flow state, signed launch context, and step transitions to a single flow. A `FlowInstance` records one `flowId`. The signed `tgWebAppStartParam` embeds that `flowId` at launch time. When a Mini App `onSubmit` returns `{ to: "confirm" }`, the runtime looks up step `"confirm"` in the flow that owns the instance — not in whatever flow the Mini App screen happened to resolve to by URL route.

If the instance belongs to a `start` flow but the Mini App resolved to an `onboard` flow's route, the handoff will fail because `"confirm"` does not exist in the `start` flow. The `defineFlow` validation also enforces that all `action.to` references point to steps within the same flow.

**Correct:** one flow with `chat → miniapp → chat` steps (like `shop-catalogue` in task-shop). The entry step's type (`"chat"` or `"miniapp"`) determines whether the bot command sends a chat message or a Mini App launch button, but both step types coexist in the same flow.

```ts
// ✅ One flow, multiple surface types
defineFlow({
  id: "onboard",
  initialStep: "identify",
  steps: {
    identify: { type: "chat", ... },
    home: { type: "miniapp", ... },
    confirm: { type: "chat", ... }
  }
})

// ❌ Two flows for one journey — handoff breaks
defineFlow({ id: "start", steps: { identify: { type: "chat", ... } } })
defineFlow({ id: "onboard", steps: { home: { type: "miniapp", ... }, confirm: { type: "chat", ... } } })
```

## What to Copy Into Your Own App

1. **Define a flow** with `defineFlow({ id, initialStep, state, steps })`
2. **Add a bot command** in `bot.command` for chat entry
3. **Expose client-safe route metadata in `apps/web/src/teleforge-generated/client-flow-manifest.ts` (generated by `teleforge generate client-manifest`)** for URL-based screen resolution
4. **Implement `onSubmit` handlers** in steps that need server-side logic
5. **Create screens** with `defineScreen({ id, component })`
6. **Register the flow manifest and screens** in `main.tsx`
7. **Wire `createFetchMiniAppServerBridge()`** for server communication
8. **Create a hooks server** in `apps/api` using `createDiscoveredServerHooksHandler`

## Hooks Server Setup

For chat handoff to work through the server bridge (required for inline-keyboard-launched Mini Apps), the bot process must also run a hooks server with `onChatHandoff` wired to the bot runtime. Without this, the server bridge returns 501 for `chatHandoff` requests and the Mini App falls back to `sendData`, which only works for main-keyboard-launched Mini Apps.

```ts
// apps/bot/src/index.ts
import { startHooksServer } from "../../api/src/index.ts";

const runtime = await createDiscoveredBotRuntime(config);

await startHooksServer({
  cwd: process.cwd(),
  onChatHandoff: (input) => runtime.handleChatHandoff(input),
  storage: runtime.getStorage()
});
```

```ts
// apps/api/src/index.ts
export async function startHooksServer(options) {
  const hooksHandler = await createDiscoveredServerHooksHandler({
    cwd: options.cwd,
    onChatHandoff: options.onChatHandoff,
    storage: options.storage
  });

  // Node HTTP server on port 3100 (or configured port)
  // Vite dev server proxies /api/teleforge to this server
}
```

During local development, the Vite dev server proxies `/api/teleforge` to the hooks server so the Mini App can use same-origin requests through the tunnel.

## Read Alongside

- [Flow State Design](./flow-state-design.md) — Storage model and execution architecture
- [Mini App Architecture](./miniapp-architecture.md) — 18 frontend guidelines
- [Framework Model](./framework-model.md) — flow-first authoring model and public imports
