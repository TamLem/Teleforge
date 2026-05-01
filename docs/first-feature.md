# Build Your First Feature

This walkthrough adds a second flow to a generated Teleforge app. It uses the flow-first,
action-first model: define a flow with a command and an action, add a screen, then let
Teleforge discover the runtime wiring.

## Goal

Add:

- an `/orders` bot command
- an `orders` screen with loader
- a `selectOrder` action with schema-validated input
- a `done` screen with return-to-chat

## 1. Add The Flow

Create `apps/bot/src/flows/orders.flow.ts`:

```ts
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "orderflow",

  command: {
    command: "orders",
    description: "Open recent orders",
    handler: async ({ ctx, sign }) => {
      const launch = await sign({
        screenId: "orders",
        subject: {},
        allowedActions: ["selectOrder"]
      });

      await ctx.reply("Open recent orders.", {
        reply_markup: {
          inline_keyboard: [[{ text: "Open Orders", web_app: { url: launch } }]]
        }
      });
    }
  },

  miniApp: {
    routes: { "/": "orders", "/done": "done" },
    defaultRoute: "/",
    title: "Orders"
  },

  actions: {
    selectOrder: {
      handler: async ({ input, session }) => {
        return {
          data: { selected: true }
        };
      }
    }
  }
});
```

## 2. Add The Override Types

Create `apps/web/src/teleforge-contract-overrides.ts` to type the new screen's loader data
and any action payloads:

```ts
export interface TeleforgeActionPayloadOverrides {}

export interface TeleforgeLoaderDataOverrides {
  orderflow: {
    orders: { orders: Array<{ id: string; total: number }> };
  };
}
```

The generator creates the file stub once if missing. Add concrete shapes here instead of
casting `loaderData` inside screens.

## 3. Add The Screens

`apps/web/src/screens/orders.screen.tsx`:

```tsx
import { defineScreen } from "teleforge/web";
import type { OrdersScreenProps } from "./teleforge-generated/contracts";

function OrdersScreen({ loader, loaderData, actions, nav }: OrdersScreenProps) {
  if (loader.status === "loading") return <div>Loading...</div>;
  if (loader.status === "error") return <div>Failed to load orders</div>;

  const orders = loaderData?.orders ?? [];

  return (
    <div>
      <h2>Recent Orders</h2>
      {orders.map((o) => (
        <div key={o.id}>
          <span>
            Order #{o.id} — ${o.total}
          </span>
          <button onClick={() => nav.done()}>View Details</button>
        </div>
      ))}
    </div>
  );
}

export default defineScreen({
  component: OrdersScreen,
  id: "orders",
  title: "Orders"
});
```

`apps/web/src/screens/done.screen.tsx`:

```tsx
import { defineScreen } from "teleforge/web";
import type { DoneScreenProps } from "./teleforge-generated/contracts";

function DoneScreen({ nav }: DoneScreenProps) {
  return (
    <div>
      <h2>Done</h2>
      <button onClick={() => nav.orders()}>Back to Orders</button>
    </div>
  );
}

export default defineScreen({
  component: DoneScreen,
  id: "done",
  title: "Done"
});
```

## 4. Add The Loader

`apps/api/src/loaders/orders.loader.ts`:

```ts
import { defineLoader } from "teleforge";

export default defineLoader({
  handler: async ({ ctx, services }) => {
    const orders = await services.orders.listByUser(ctx.userId);
    return { orders };
  }
});
```

## 5. Register The Screens

Update `apps/web/src/main.tsx`:

```tsx
import ordersScreen from "./screens/orders.screen.js";
import doneScreen from "./screens/done.screen.js";

<TeleforgeMiniApp
  flowManifest={flowManifest}
  screens={[catalogScreen, ordersScreen, doneScreen]}
  serverBridge={serverBridge}
/>;
```

## 6. Regenerate The Manifest

```bash
npx teleforge generate client-manifest
```

Teleforge will discover the new flow, add it to the client-safe manifest, and regenerate
`contracts.ts` with the new screen prop aliases and nav helpers.

## 7. Run It

```bash
pnpm dev
```

The `/orders` command should be registered and the Mini App should load the screen.

## Read Next

- [Flow Coordination](./flow-coordination.md)
- [Generated Mini App Contracts](./generated-miniapp-contracts.md)
- [Config Reference](./config-reference.md)
- [Server Actions](./server-hooks.md)
