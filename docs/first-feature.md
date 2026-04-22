# Build Your First Feature

This walkthrough adds a second flow to a generated Teleforge app. It uses the flow-first model: define a flow, add a screen, then let Teleforge discover the runtime wiring.

## Goal

Add:

- an `/orders` bot command
- an `orders` Mini App step
- an `orders` screen module
- a simple submit transition back to chat

## 1. Add The Flow

Create `apps/bot/src/flows/orders.flow.ts`:

```ts
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "orders",
  initialStep: "orders",
  state: {
    selectedOrderId: null as string | null
  },
  bot: {
    command: {
      buttonText: "Open Orders",
      command: "orders",
      description: "Open recent orders",
      text: "Open the Mini App to review recent orders."
    }
  },
  miniApp: {
    route: "/orders"
  },
  steps: {
    orders: {
      screen: "orders",
      type: "miniapp"
    },
    done: {
      message: ({ state }) =>
        state.selectedOrderId ? `Selected order ${state.selectedOrderId}.` : "No order selected.",
      type: "chat"
    }
  }
});
```

`teleforge dev` discovers `.flow.ts` files from the `flows.root` configured in `teleforge.config.ts`.

## 2. Add The Screen

Create `apps/web/src/screens/orders.screen.tsx`:

```tsx
import { defineScreen, useTeleforgeMiniAppRuntime } from "teleforge/web";

function OrdersScreen() {
  const runtime = useTeleforgeMiniAppRuntime();

  return (
    <main className="stack">
      <p className="badge">Screen: orders</p>
      <h2>Recent Orders</h2>
      <button
        onClick={() =>
          runtime.submit({
            selectedOrderId: "order_1001"
          })
        }
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

Screen modules are discovered from `miniApp.screensRoot` when set, or the default screen root used by the scaffold.

## 3. Handle Submit

For a purely local flow, add `onSubmit` to the Mini App step:

```ts
orders: {
  screen: "orders",
  type: "miniapp",
  onSubmit({ data, state }) {
    return {
      state: {
        ...state,
        selectedOrderId:
          typeof data === "object" && data && "selectedOrderId" in data
            ? String(data.selectedOrderId)
            : null
      },
      to: "done"
    };
  }
}
```

If the submit must call a database or trusted service, move that work into a server hook instead of doing it in browser code.

## 4. Run It

```bash
pnpm run dev
```

Then:

1. Send `/orders` in the simulator chat.
2. Open the Mini App from the bot message.
3. Click the screen button.
4. Confirm the flow returns to the `done` chat step.

## 5. Add Tests

Use the generated tests as the pattern:

- flow tests assert command metadata, steps, and transitions
- screen tests render the screen component
- runtime tests exercise the discovered bot runtime or Mini App screen runtime

For the larger reference pattern, inspect `apps/task-shop`.

## Next Step

Read [Flow Coordination](./flow-coordination.md) for cross-surface continuity and [Server Hooks and Backend Internals](./bff-guide.md) for trusted server-side work.
