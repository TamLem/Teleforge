# Flow Coordination

Flow coordination is Teleforge's main product model: a user can start in chat, continue in the
Mini App, and return to chat while the framework preserves context via signed action tokens.

Use this guide after [Build Your First Feature](./first-feature.md).

## Mental Model

```txt
flow → action → screen → effects
```

- **Flow**: the complete journey, including id, command, handlers, Mini App routes, and actions.
- **Screen**: a React module registered with `defineScreen()` and mapped to a Mini App route.
- **Action**: a named server-side handler that validates a signed context, does work,
  and returns an `ActionResult` with optional navigation and effects.
- **Effect**: a side effect produced by an action (chat message, Mini App navigation, handoff).
- **Runtime**: framework-owned bot, Mini App, action server, and optional session wiring.

The app author should normally edit flow files and screen files. Teleforge owns command routing,
signed Mini App launch tokens, client manifest generation, action server routing, and bot delivery.

## Default Lifecycle

For a generated app, the normal lifecycle is:

1. User sends a bot command such as `/start`.
2. `startTeleforgeBot()` loads `teleforge.config.ts`, discovers flows, and runs the command handler.
3. The command handler calls `sign()` to create a signed action context and sends a Mini App launch button.
4. `TeleforgeMiniApp` parses the signed context from the launch URL and renders the matching screen.
5. The screen calls `runAction()` with an action id and optional payload.
6. The action server validates the signed context and runs the action handler.
7. The handler returns an `ActionResult` with navigation instructions and optional effects.
8. If `showHandoff` is set, the Mini App shows a return-to-chat screen and closes.
9. If `navigate` is set, the Mini App transitions to another screen.
10. `chatMessage` effects are sent by the bot runtime.

The same flow definition owns both chat and Mini App surfaces. Do not split one journey into separate
"bot flow" and "Mini App flow" files.

## Flow Definition

```ts
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "checkout",

  command: {
    command: "start",
    description: "Start checkout",
    handler: async ({ ctx, sign, services }) => {
      const launch = await sign({
        flowId: "checkout",
        screenId: "catalog",
        allowedActions: ["selectItem", "completeOrder"]
      });

      await ctx.reply("Open checkout to continue.", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Open checkout", web_app: { url: launch } }
          ]]
        }
      });
    }
  },

  miniApp: {
    routes: {
      "/": "catalog",
      "/done": "done"
    },
    defaultRoute: "/",
    title: "Checkout"
  },

  actions: {
    selectItem: {
      handler: async ({ ctx, data }) => {
        const payload = data as { itemId: string };
        return {
          navigate: "done",
          data: { selectedItemId: payload.itemId }
        };
      }
    },

    completeOrder: {
      handler: async ({ ctx, data, services }) => {
        await services.orders.place(data);
        return {
          showHandoff: "Order complete!",
          closeMiniApp: true,
          effects: [{ type: "chatMessage", text: "Your order has been placed." }]
        };
      }
    }
  }
});
```

## Screen Registration

Mini App screens live under the configured screen root, normally `apps/web/src/screens`.

```tsx
import { defineScreen } from "teleforge/web";

function CatalogScreen({ runAction, transitioning }) {
  return (
    <button
      onClick={() => runAction("selectItem", { itemId: "task-001" })}
      disabled={transitioning}
    >
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

The client manifest is browser-safe. Do not import `apps/bot/src/flows/*` from the web entry;
flow files may contain server-only handlers or dependencies. `teleforge dev` refreshes the manifest
when stale, and `teleforge doctor` reports drift.

## Trusted Server Work

Keep simple read-only screen loading in the client. Use action handlers when you need server authority:

- private data loading
- permission checks
- durable writes
- payment/order/session creation
- calls to services with server-only credentials

Actions are defined in the flow file and executed by the action server. Each action request carries a
signed action context token that the server validates before running the handler.

```bash
create-teleforge-app my-app
```

At runtime, `teleforge start` starts the framework-owned action server so the Mini App can invoke
actions with server-side authority.

## Runtime Communication Contract

Bot, Mini App, and action server communicate through framework contracts rather than process-local objects:

- action server requests: `runAction`, `loadScreenContext`, `handoff`
- session storage: optional `SessionManager` over a `SessionStorageAdapter`
- signed action context: HMAC-signed tokens carrying flow id, screen id, user id, allowed actions, and expiry
- Telegram webhook or polling updates as transport input, not application state

In local development these pieces can run in one process. In production they can run as split processes
as long as both sides share the same signing secret.

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

When an action returns `showHandoff` and `closeMiniApp`, the Mini App runtime shows a handoff message
and closes. The bot runtime sends any `chatMessage` effects.

```ts
actions: {
  completeOrder: {
    handler: async ({ ctx, data }) => {
      return {
        showHandoff: "Returning to chat...",
        closeMiniApp: true,
        effects: [{ type: "chatMessage", text: "Order placed." }]
      };
    }
  }
}
```

## Phone Contact Handling

Use the `onContact` handler to receive a validated self-shared phone contact:

```ts
handlers: {
  onContact: async ({ ctx, shared, sign, services }) => {
    // shared.normalizedPhone is already extracted and verified
    const launch = await sign({
      flowId: "my-flow",
      screenId: "profile",
      subject: { phone: shared.normalizedPhone },
      allowedActions: ["editProfile"]
    });

    await ctx.reply("Phone verified. Continue in the Mini App.", {
      reply_markup: {
        inline_keyboard: [[
          { text: "Open App", web_app: { url: launch } }
        ]]
      }
    });
  }
}
```

## Location Handling

```ts
handlers: {
  onLocation: async ({ ctx, location, sign, services }) => {
    const launch = await sign({
      flowId: "nearby",
      screenId: "results",
      subject: { lat: location.latitude, lng: location.longitude },
      allowedActions: ["viewResult"]
    });

    await ctx.reply("Location received. Opening nearby results.");
  }
}
```

**Collision rules:**
- Only one flow may define an `onContact` handler across all flows.
- Only one flow may define an `onLocation` handler across all flows.
- Duplicate command names across flows cause a registration error.

## Escape Hatches

Advanced apps can still assemble lower-level runtime pieces manually:

- `createDiscoveredBotRuntime()` for custom bot process ownership, storage, or service injection
- `createActionServerHooksHandler()` for custom HTTP hosting
- `teleforge/bot` webhook adapters for non-standard server frameworks

Treat these as escape hatches. The default app path is `teleforge.config.ts`, flow files, screen files,
`teleforge dev`, and `teleforge start`.

## Read Alongside

- [Framework Model](./framework-model.md)
- [Action Server](./server-hooks.md)
- [Flow State Architecture](./flow-state-design.md)
- [Deployment](./deployment.md)
