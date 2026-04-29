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
  and returns an `ActionResult` with optional data and effects.
- **Effect**: a side effect produced by an action (chat message, navigation, handoff).
- **Runtime**: framework-owned bot, Mini App, action server, and optional session wiring.

The app author should normally edit flow files and screen files. Teleforge owns command routing,
signed Mini App launch tokens, client manifest generation, action server routing, and bot delivery.

## Default Lifecycle

For a generated app, the normal lifecycle is:

1. User sends a bot command such as `/start`.
2. `startTeleforgeBot()` loads `teleforge.config.ts`, discovers flows, and runs the command handler.
3. The command handler calls `sign()` to create a signed action context and sends a Mini App launch button.
4. `TeleforgeMiniApp` parses the signed context from the launch URL and renders the matching screen.
5. The server loader runs to fetch display data.
6. The screen calls `actions.addToCart()` with validated input.
7. The action server validates the signed context and runs the action handler.
8. The handler returns an `ActionResult` with data and optional effects.
9. If `handoff` is set, the Mini App shows a return-to-chat screen and closes.
10. If `redirect` is set, the Mini App transitions to another screen (triggering its loader).
11. `chatMessage` effects are sent by the bot runtime.

The same flow definition owns both chat and Mini App surfaces. Do not split one journey into separate
"bot flow" and "Mini App flow" files.

## Flow Definition

```ts
import { defineFlow } from "teleforge";

function schema<T>(s: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown } }) {
  return s;
}

export default defineFlow({
  id: "checkout",

  session: {
    enabled: true
  },

  command: {
    command: "start",
    description: "Start checkout",
    handler: async ({ ctx, sign }) => {
      const launch = await sign({
        screenId: "catalog",
        subject: {},
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
      input: schema<{ itemId: string }>({
        safeParse(input) {
          if (typeof input !== "object" || input === null) return { success: false, error: "invalid" };
          const obj = input as Record<string, unknown>;
          if (typeof obj.itemId !== "string") return { success: false, error: "itemId required" };
          return { success: true, data: { itemId: obj.itemId } };
        }
      }),
      handler: async ({ input, session }) => {
        const cart = session.resource<{ items: string[] }>("cart", { initialValue: { items: [] } });
        await cart.update((d) => { d.items.push(input.itemId); });
        return { data: { added: true } };
      }
    },

    completeOrder: {
      handler: async ({ ctx, session, services }) => {
        const cart = session.resource<{ items: string[] }>("cart", { initialValue: { items: [] } });
        const { items } = await cart.get();
        const order = await services.orders.place(ctx.userId, items);
        const orderRes = session.resource("lastOrder", { initialValue: { order: null } });
        await orderRes.set({ order });
        return {
          data: { placed: true, orderId: order.id },
          handoff: { message: "Order complete!", closeMiniApp: true },
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
import type { TeleforgeScreenComponentProps } from "teleforge/web";

function CatalogScreen({ loader, loaderData, actions, nav, transitioning }: TeleforgeScreenComponentProps) {
  if (loader.status === "loading") return <div>Loading...</div>;
  if (loader.status === "error") return <div>Error loading catalog</div>;

  const items = loaderData as Array<{ id: string; name: string }> | undefined;
  if (!items) return null;

  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>
          <span>{item.name}</span>
          <button disabled={transitioning} onClick={() => actions.selectItem({ itemId: item.id })}>
            Select
          </button>
          <button onClick={() => nav.done()}>Skip</button>
        </div>
      ))}
    </div>
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

Use action handlers when you need server authority:

- private data loading
- permission checks
- durable writes
- payment/order/session creation
- calls to services with server-only credentials
- session resource operations (cart, drafts)

Actions are defined in the flow file and executed by the action server. Each action request carries a
signed action context token that the server validates before running the handler.

## Runtime Communication Contract

Bot, Mini App, and action server communicate through framework contracts rather than process-local objects:

- action server requests: `runAction`, `loadScreenContext`, `handoff`
- session storage: `SessionManager` over a `SessionStorageAdapter`
- signed action context: HMAC-signed tokens carrying flow id, screen id, user id, allowed actions, and expiry
- Telegram webhook or polling updates as transport input, not application state

In local development these pieces can run in one process. In production they can run as split processes
as long as both sides share the same signing secret.

## Chat Handoff

When an action returns `handoff: { message, closeMiniApp }`, the Mini App runtime shows a handoff message
and closes. The bot runtime sends any `chatMessage` effects.

```ts
completeOrder: {
  handler: async ({ ctx, session, services }) => {
    return {
      data: { placed: true },
      handoff: { message: "Returning to chat...", closeMiniApp: true },
      effects: [{ type: "chatMessage", text: "Order placed." }]
    };
  }
}
```

## Phone Contact Handling

Use the `onContact` handler to receive a validated self-shared phone contact:

```ts
handlers: {
  onContact: async ({ ctx, shared, sign, services }) => {
    const launch = await sign({
      screenId: "profile",
      subject: { resource: { type: "phone", value: shared.normalizedPhone } },
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
  onLocation: async ({ ctx, location, sign }) => {
    const launch = await sign({
      screenId: "results",
      subject: { resource: { type: "location", lat: location.latitude, lng: location.longitude } },
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
