# Action Server and Backend

This guide explains Teleforge's trusted server-side action execution path.

The public model is:

- define product behavior as flows
- bind Mini App routes to screens
- define action handlers in the flow for server-trusted work

Do not treat backend work as a separate Teleforge app mode. Actions are part of the flow definition.

## When to Use Server Actions

Use action handlers for work the browser must not control:

- checking identity and ownership
- enforcing permissions
- loading user-specific or private data
- validating action payloads on the server
- creating orders, payments, sessions, tickets, or other durable records
- calling downstream services with server-only credentials
- managing session state for draft flows

Keep simple local UI state in the screen. Keep durable product state in domain services or session resources.

## Action Handler Types

Actions are defined in the flow file and executed by the action server through a validated
signed context.

```ts
actions: {
  submitOrder: {
    input: orderSchema,
    handler: async ({ input, ctx, services, session }) => {
      // ctx = validated signed action context
      // input = validated payload from Mini App
      // services = app services container
      // session = session handle (when session.enabled is true)

      const order = await services.orders.create(ctx.userId, input);

      const orderResource = session.resource("lastOrder", { initialValue: { order: null } });
      await orderResource.set({ order });

      return {
        data: { placed: true, orderId: order.id }
      };
    }
  },

  cancel: {
    handler: async ({ ctx }) => {
      return {
        data: { cancelled: true },
        handoff: { message: "Returning to chat...", closeMiniApp: true },
        effects: [{ type: "chatMessage", text: "Order cancelled." }]
      };
    }
  }
}
```

Action handlers receive a context with the validated signed context, input, services,
session handle (when enabled), and `sign` for creating follow-up launch URLs. They return
an `ActionResult` with optional data, handoff, effects, and redirect. See
[Config Reference](./config-reference.md) for exact type shapes.

## Suggested Structure

```
apps/bot/src/flows/
  checkout.flow.ts          ← flow with actions defined inline

apps/api/src/loaders/      ← server loaders for screen display data
  catalog.loader.ts
  product-detail.loader.ts

apps/web/src/screens/
  catalog.screen.tsx        ← screen that uses actions.* and nav.*
  success.screen.tsx
```

Actions live in the flow file. Loaders live in separate files under the loader root.

## Example: Complete Action Flow

```ts
import { defineFlow } from "teleforge";

function schema<T>(s: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown } }) {
  return s;
}

export default defineFlow({
  id: "checkout",

  session: { enabled: true },

  command: {
    command: "checkout",
    description: "Start checkout",
    handler: async ({ ctx, sign }) => {
      const launch = await sign({
        screenId: "catalog",
        subject: {},
        allowedActions: ["addToCart", "checkout"]
      });

      await ctx.reply("Open checkout to continue.", {
        reply_markup: {
          inline_keyboard: [[{ text: "Open", web_app: { url: launch } }]]
        }
      });
    }
  },

  miniApp: {
    routes: { "/": "catalog", "/success": "success" },
    defaultRoute: "/"
  },

  actions: {
    addToCart: {
      input: schema<{ productId: string; qty: number }>({
        safeParse(input) {
          if (typeof input !== "object" || input === null) return { success: false, error: "invalid" };
          const obj = input as Record<string, unknown>;
          if (typeof obj.productId !== "string") return { success: false, error: "productId required" };
          return { success: true, data: { productId: obj.productId, qty: (obj.qty as number) ?? 1 } };
        }
      }),
      handler: async ({ input, ctx, session, services }) => {
        const cart = session.resource<{ items: Array<{ productId: string; qty: number }> }>("cart", {
          initialValue: { items: [] }
        });
        await cart.update((draft) => {
          draft.items.push({ productId: input.productId, qty: input.qty });
        });
        return { data: { added: true } };
      }
    },

    checkout: {
      handler: async ({ ctx, session, services }) => {
        const cart = session.resource("cart");
        const { items } = await cart.get();
        const order = await services.orders.create(ctx.userId, items);
        const orderRes = session.resource("lastOrder", { initialValue: { order: null } });
        await orderRes.set({ order });
        return { data: { placed: true, orderId: order.id } };
      }
    }
  }
});
```

## Security Boundary

The frontend can render UI and collect input. It is not authoritative for:

- identity trust
- permission decisions
- durable state mutation
- service calls with server-only credentials

The action server validates the signed action context (signature, expiry, allowed actions)
before running any handler.

For how actions and loaders are called through the runtime chain, see
[Runtime Wiring](./runtime-wiring.md). For exact request shapes and endpoint details, see
[Config Reference](./config-reference.md).

## Screen Loaders

Server loaders fetch display data when a screen resolves. Loader files live in the configured
loader root (default `apps/api/src/loaders/`) and are named after the screen ID:

```text
apps/api/src/loaders/catalog.loader.ts
apps/api/src/loaders/product-detail.loader.ts
```

Each loader uses `defineLoader`:

```ts
import { defineLoader } from "teleforge";

export default defineLoader({
  handler: async ({ ctx, params, services, session }) => {
    // ctx = validated signed context
    // params = route params from matched route
    // session = session handle (when flow has session enabled)

    const products = await services.catalog.list(ctx.userId);
    return { products };
  }
});
```

Loaders with optional schema validation:

```ts
import { defineLoader } from "teleforge";
import type { TeleforgeInputSchema } from "teleforge";

const schema: TeleforgeInputSchema<{ id: string }> = {
  safeParse(input) {
    if (typeof input !== "object" || input === null) return { success: false, error: { message: "invalid" } };
    const obj = input as Record<string, unknown>;
    if (typeof obj.id !== "string") return { success: false, error: { message: "id required" } };
    return { success: true, data: { id: obj.id } };
  }
};

export default defineLoader({
  input: schema,
  handler: async ({ input, ctx, services }) => {
    const product = await services.catalog.get(input.id, ctx.userId);
    return { product };
  }
});
```

Loaders receive the signed action context, route params, services, and optional session.
See [Config Reference](./config-reference.md) for the exact `ServerLoaderContext` type shape.

Phone auth uses the `onContact` flow handler. See [Shared Phone Auth](./shared-phone-auth.md)
for the complete end-to-end flow.

Loader return types are not inferred from server files. Browser-side typing comes from
app-authored `TeleforgeLoaderDataOverrides` in `teleforge-contract-overrides.ts`. The
generator merges these into per-screen prop aliases so `loaderData` is typed without
casts. See [Generated Mini App Contracts](./generated-miniapp-contracts.md) for the
authoring model.

## Read Next

- [Framework Model](./framework-model.md)
- [Developer Guide](./developer-guide.md)
- [Flow Coordination](./flow-coordination.md)
- [Generated Mini App Contracts](./generated-miniapp-contracts.md)
- [Deployment](./deployment.md)
