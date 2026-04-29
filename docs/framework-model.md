# Framework Model

Teleforge is a flow-first, action-first framework for Telegram-native products.

The public authoring model is:

- define a Teleforge app in `teleforge.config.ts`
- define flows with bot commands, Mini App routes, and action handlers
- bind Mini App routes to screens
- attach handlers where behavior lives — in commands, contact/location handlers, and actions
- let Teleforge wire bot launch, Mini App runtime, server bridge, and optional session state

The developer should start from the product journey, not from package boundaries or runtime topology.

## Core Concepts

| Concept      | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `Flow`       | Complete user journey such as checkout, onboarding, or phone auth       |
| `Screen`     | Frontend UI bound to a Mini App route                                   |
| `Action`     | Named server-side handler producing results and effects                 |
| `Handler`    | Application logic in commands, contact/location handlers, and actions   |
| `Effect`     | Side effect produced by an action (chat message, navigation, handoff)   |
| `Session`    | Optional server-side state for drafts, multi-step wizards, external waits |

## Example Shape

```ts
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "order",

  session: {
    enabled: true
  },

  command: {
    command: "start",
    description: "Start a new order",
    handler: async ({ ctx, sign }) => {
      const launch = await sign({
        screenId: "catalog",
        subject: {},
        allowedActions: ["selectProduct", "confirmOrder"]
      });

      await ctx.reply("What would you like to order?", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Open catalog", web_app: { url: launch } }
          ]]
        }
      });
    }
  },

  miniApp: {
    routes: {
      "/": "catalog",
      "/confirm": "confirm"
    },
    defaultRoute: "/",
    title: "Order"
  },

  actions: {
    selectProduct: {
      input: schema({ productId: String, quantity: Number }),
      handler: async ({ input, session }) => {
        const cart = session.resource<{ items: Array<{ productId: string; qty: number }> }>("cart", {
          initialValue: { items: [] }
        });
        await cart.update((draft) => {
          draft.items.push({ productId: input.productId, qty: input.quantity });
        });
        return { data: { added: true } };
      }
    },

    confirmOrder: {
      handler: async ({ ctx, session, services }) => {
        const cart = session.resource("cart");
        const { items } = await cart.get();
        const order = await services.orders.create(ctx.userId, items);
        const orderRes = session.resource("lastOrder", { initialValue: { order: null } });
        await orderRes.set({ order });
        return {
          data: { placed: true, orderId: order.id },
          handoff: { message: "Your order has been placed.", closeMiniApp: true },
          effects: [{ type: "chatMessage", text: "Order placed. Use /track to see status." }]
        };
      }
    }
  }
});
```

## What Teleforge Derives

From the app config, flow definitions, and screen definitions, Teleforge derives:

- bot command and callback registration
- Mini App launch buttons with signed action context
- route-to-screen resolution
- optional session state persistence
- Mini App action execution with server-side validation
- return-to-chat and handoff behavior
- default action server execution

The framework owns repetitive cross-surface wiring. App code owns product behavior.

## Chat and Mini App Together

Teleforge treats chat and Mini App interaction as one continuous journey.

A flow can:

- begin from a bot command or phone share
- move into a Mini App screen for richer UI
- navigate between Mini App screens
- return to chat via handoff effects
- optionally use session state for drafts or resumability

When a command handler signs a launch URL, the framework produces a `web_app` button with an
HMAC-signed action context token. The Mini App receives this token, the server validates it
on every action call. See [Flow Coordination](./flow-coordination.md) for details.

## Public Imports

Application code should use the unified package surfaces:

- `teleforge`: app config, flows, discovered runtimes, action server hooks
- `teleforge/bot`: lower-level bot primitives when custom routing is needed
- `teleforge/web`: Mini App shell, screen definitions, Telegram hooks, and runtime helpers
- `teleforge/core/browser`: browser-safe launch and validation helpers

Internal workspace packages implement these surfaces. They are not the app authoring model.

## Internal Layers

The repository contains internal packages that implement the framework:

- `packages/core`: shared schemas, launch parsing, validation, action context signing, session storage
- `packages/bot`: Telegram update routing and chat primitives
- `packages/web`: Mini App hooks, flow bridge, and browser runtime helpers
- `packages/ui`: React UI primitives built on top of the web runtime
- `packages/devtools`: CLI, simulator, doctor checks, and tunnel support
- `packages/teleforge`: the unified public package that composes the layers above

These packages are useful for framework maintainers. App documentation should not ask users to assemble them.

## Runtime Surfaces

### Bot Runtime

The bot runtime is responsible for:

- loading `teleforge.config.ts`
- discovering flow modules
- registering bot commands from flow definitions
- handling contact and location shares via flow handlers
- sending Mini App launch buttons with signed action context
- accepting `web_app_data` and callback queries with action context validation
- dispatching action handlers from verified signed context

Apps normally enter this through `startTeleforgeBot()` from `teleforge`, which loads config, resolves secrets,
and starts polling or webhook delivery automatically.

### Mini App Runtime

The Mini App runtime is a screen runtime.

It is responsible for:

- bootstrapping Telegram WebApp context
- parsing the signed action context from the launch URL
- matching the current URL path to a screen via route registry
- calling server loaders for display data
- invoking server-side actions via `actions.*` helpers
- navigating between screens via `nav.*` helpers
- showing handoff UI and closing the Mini App when actions request it

Screens are registered with `defineScreen()` from `teleforge/web`. The app shell is `TeleforgeMiniApp`.

### Action Server

The action server is the trusted backend execution hub for flow actions.

Use it when the browser cannot be the authority for:

- identity trust
- permission decisions
- durable writes
- downstream service calls with server-only credentials
- session state operations

The public model is flow-first: actions are defined in the flow and executed by the server.
Each action request carries a signed action context token validated by the server.

## Screen Data Boundaries

| Prop | Source | Trust |
|---|---|---|
| `scopeData` | Signed context `subject` — server-issued IDs/capabilities | Server |
| `routeParams` | Extracted from matched route pattern (e.g. `{ id: "42" }` from `/product/:id`) | Framework |
| `routeData` | `navigate({ data })` — ephemeral handoff | Client |
| `loader` | `loadScreenContext` result lifecycle (`loading \| ready \| error \| idle`) | Server |
| `loaderData` | Convenience: `loader.data` when `ready` | Server |
| `appState` | Mini App-wide client session | Client |

## Local Tooling

The `teleforge` CLI provides:

- `teleforge dev` for local Mini App and simulator development
- `teleforge dev --public --live` for tunnel-backed Telegram testing
- `teleforge mock` for standalone Telegram context simulation
- `teleforge doctor` for config and environment checks

The CLI is shipped through the unified `teleforge` package even though its implementation lives in `packages/devtools`.

## Reference Apps

Use [`apps/task-shop`](../apps/task-shop/README.md) for the full reference flow with chat/Mini App coordination,
action handlers, server loaders, session resources, and screen runtime patterns.

## Non-Goals

Teleforge is not:

- a generic website framework
- a low-code page builder
- a public backend product mode
- a runtime for removed formats

## Design Rules

- Start from the flow, not from package topology.
- Signed context carries IDs and scope only; display data comes from loaders.
- Keep screen code responsible for presentation and local UI state.
- Keep durable product state in session resources or domain services.
- Keep trusted decisions in action handlers.
- Use the simulator-first local workflow before switching to real Telegram.
- Keep public docs and examples on the unified `teleforge` package.

## Read Next

- [Config Reference](./config-reference.md)
- [Mini App Architecture](./miniapp-architecture.md)
- [Flow Coordination](./flow-coordination.md)
- [Flow State Architecture](./flow-state-design.md)
