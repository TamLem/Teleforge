# Build Your First Feature

This walkthrough adds a second flow to a generated Teleforge app. It uses the flow-first,
action-first model: define a flow with a command and an action, add a screen, then let
Teleforge discover the runtime wiring.

## Goal

Add:

- an `/orders` bot command
- an `orders` screen
- a `selectOrder` action that navigates to a confirmation screen
- a `done` screen with return-to-chat

## 1. Add The Flow

Create `apps/bot/src/flows/orders.flow.ts`:

```ts
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "orders",

  command: {
    command: "orders",
    description: "Open recent orders",
    handler: async ({ ctx, sign }) => {
      const launch = await sign({
        flowId: "orders",
        screenId: "orders",
        allowedActions: ["selectOrder"]
      });

      await ctx.reply("Open the Mini App to review recent orders.", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Open Orders", web_app: { url: launch } }
          ]]
        }
      });
    }
  },

  miniApp: {
    routes: {
      "/": "orders",
      "/done": "done"
    },
    defaultRoute: "/",
    title: "Orders"
  },

  actions: {
    selectOrder: {
      handler: async ({ ctx, data }) => {
        const payload = data as { selectedOrderId: string };
        return {
          navigate: "done",
          data: { selectedOrderId: payload.selectedOrderId }
        };
      }
    },

    returnToChat: {
      handler: async () => {
        return {
          showHandoff: "Returning to chat...",
          closeMiniApp: true,
          effects: [{
            type: "chatMessage",
            text: "Order review complete."
          }]
        };
      }
    }
  }
});
```

`teleforge dev` discovers `.flow.ts` files from the `flows.root` configured in `teleforge.config.ts`.

## 2. Add The Screen

Create `apps/web/src/screens/orders.screen.tsx`:

```tsx
import { defineScreen } from "teleforge/web";

function OrdersScreen({ runAction, transitioning }) {
  return (
    <main className="stack">
      <p className="badge">Screen: orders</p>
      <h2>Recent Orders</h2>
      <button
        onClick={() => runAction("selectOrder", { selectedOrderId: "order_1001" })}
        disabled={transitioning}
      >
        Select order_1001
      </button>
    </main>
  );
}

export default defineScreen({
  component: OrdersScreen,
  id: "orders",
  title: "Orders"
});
```

Screen modules are discovered from `miniApp.screensRoot` when set, or the default screen root
used by the scaffold.

## 3. Add The Done Screen

Create `apps/web/src/screens/done.screen.tsx`:

```tsx
import { defineScreen } from "teleforge/web";

function DoneScreen({ data, runAction, transitioning }) {
  const orderId = (data as Record<string, string>)?.selectedOrderId ?? "unknown";

  return (
    <main className="stack">
      <p className="badge">Screen: done</p>
      <h2>Order Selected</h2>
      <p>You selected: {orderId}</p>
      <button
        onClick={() => runAction("returnToChat")}
        disabled={transitioning}
      >
        Return to chat
      </button>
    </main>
  );
}

export default defineScreen({
  component: DoneScreen,
  id: "done",
  title: "Done"
});
```

## 4. Run It

```bash
pnpm run dev
```

Then:

1. Send `/orders` in the simulator chat.
2. Open the Mini App from the bot message.
3. Click "Select order_1001".
4. See the confirmation screen with the order ID.
5. Click "Return to chat" to close the Mini App.

## 5. Add Tests

Use the generated tests as the pattern:

- flow tests assert command metadata and action registration
- screen tests render the screen component
- runtime tests exercise the discovered bot runtime or Mini App screen runtime

For the larger reference pattern, inspect `apps/task-shop`.

## Next Step

Read [Flow Coordination](./flow-coordination.md) for cross-surface continuity and
[Action Server and Backend](./server-hooks.md) for trusted server-side work.
