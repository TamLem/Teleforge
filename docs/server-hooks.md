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

Keep simple local UI state in the screen. Keep durable product state in domain services.

## Action Handler Types

Actions are defined in the flow file and executed by the action server through a validated
signed context.

```ts
actions: {
  submitOrder: {
    handler: async ({ ctx, data, services }) => {
      // ctx = validated signed action context
      // data = payload from Mini App
      // services = app services container

      await services.orders.create(data);

      return {
        navigate: "shop.success",
        data: { orderId: "ord_123" }
      };
    }
  },

  cancel: {
    handler: async ({ ctx }) => {
      return {
        showHandoff: "Returning to chat...",
        closeMiniApp: true,
        effects: [{ type: "chatMessage", text: "Order cancelled." }]
      };
    }
  }
}
```

### Action handler context

```ts
interface ActionFlowActionHandlerContext {
  ctx: ActionContextToken;    // Verified signed context
  data: unknown;              // Payload from runAction()
  services: unknown;          // App services container
  session?: SessionHandle;    // Only for session flows or requiresSession
}
```

### Action result

```ts
interface ActionResult {
  data?: Record<string, unknown>;    // Returned to screen
  navigate?: string;                 // Navigate to screenId
  closeMiniApp?: boolean;            // Close the Mini App
  showHandoff?: string | boolean;    // Show handoff and close
  effects?: ActionEffect[];          // Side effects
}
```

## Suggested Structure

```
apps/bot/src/flows/
  checkout.flow.ts          ← flow with actions defined inline

apps/web/src/screens/
  catalog.screen.tsx        ← screen that calls runAction()
  success.screen.tsx
```

Actions live in the flow file — no separate per-step hook directory.

## Example: Complete Action Flow

```ts
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "checkout",

  command: {
    command: "checkout",
    description: "Start checkout",
    handler: async ({ ctx, sign }) => {
      const launch = await sign({
        flowId: "checkout",
        screenId: "catalog",
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
      handler: async ({ ctx, data, services }) => {
        const { productId } = data as { productId: string };
        await services.cart.add(ctx.userId, productId);
        return { data: { added: true } };
      }
    },

    checkout: {
      handler: async ({ ctx, data, services }) => {
        const order = await services.orders.create(ctx.userId);
        return {
          navigate: "success",
          data: { orderId: order.id }
        };
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

## Runtime Wiring

In the default runtime path, `teleforge start` starts the action server at
`/api/teleforge/actions`. The server also hosts the Telegram webhook endpoint when
`runtime.bot.delivery` is `"webhook"`.

For local development, `teleforge dev` runs the simulator and companion services.
Use `teleforge doctor` if an action is not resolving correctly.

## Escape Hatches

App authors should not import internal implementation packages to build a normal Teleforge app.
Use generated conventions and `teleforge start` first.

When a custom server owns HTTP routing, import from `teleforge` and use
`createActionServerHooksHandler()` directly. Keep that as an advanced hosting path,
not the default scaffold model.

## Shared Phone Auth

Phone auth uses the `onContact` flow handler:

1. the flow declares an `onContact` handler
2. the framework validates the self-shared contact
3. the handler signs an action context with the phone as subject
4. the Mini App receives it and can call actions

```ts
handlers: {
  onContact: async ({ ctx, shared, sign, services }) => {
    // shared.normalizedPhone is already extracted and verified
    const launch = await sign({
      flowId: "login",
      screenId: "profile",
      subject: { phone: shared.normalizedPhone },
      allowedActions: ["finishLogin"]
    });

    await ctx.reply("Continue in the Mini App.", {
      reply_markup: {
        inline_keyboard: [[{ text: "Open App", web_app: { url: launch } }]]
      }
    });
  }
}
```

See [Shared Phone Auth](./shared-phone-auth.md) for the end-to-end flow.

## Read Next

- [Framework Model](./framework-model.md)
- [Developer Guide](./developer-guide.md)
- [Flow Coordination](./flow-coordination.md)
- [Deployment](./deployment.md)
