# Framework Model

Teleforge is a flow-first framework for Telegram-native products.

The public authoring model is:

- define a Teleforge app in `teleforge.config.ts`
- define flows with chat and Mini App steps
- bind Mini App steps to screens
- attach handlers, guards, loaders, submits, and actions where behavior lives
- let Teleforge wire bot launch, Mini App runtime, state, resume, and optional trusted server hooks

The developer should start from the product journey, not from package boundaries or runtime topology.

## Core Concepts

| Concept      | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `Flow`       | Complete user journey such as checkout, onboarding, or phone auth       |
| `Step`       | One unit of interaction in chat or in the Mini App                      |
| `Screen`     | Frontend UI bound to a Mini App step                                    |
| `Handler`    | Application logic attached to a step, action, submit, guard, or loader  |
| `State`      | Typed data accumulated through the flow                                 |
| `Transition` | Runtime decision that moves the flow to another step, surface, or state |

## Example Shape

```ts
import { defineFlow } from "teleforge";

export const orderFlow = defineFlow({
  id: "order",
  initialStep: "welcome",
  state: {} as {
    productId?: string;
    quantity?: number;
  },
  steps: {
    welcome: {
      type: "chat",
      message: "What would you like to order?",
      actions: [{ label: "Open catalog", to: "catalog" }]
    },
    catalog: {
      type: "miniapp",
      screen: "catalog",
      onSubmit: async ({ state, data }) => ({
        state: {
          ...state,
          productId: data.productId,
          quantity: data.quantity
        },
        to: "confirm"
      })
    },
    confirm: {
      type: "chat",
      message: ({ state }) => `Confirm order for ${state.quantity} item(s)?`,
      actions: [{ label: "Confirm", to: "done" }]
    },
    done: {
      type: "chat",
      message: "Order placed."
    }
  }
});
```

The important center of gravity is the flow definition. The bot runtime, Mini App runtime, screen registry, server-hook bridge, and state manager interpret that definition across surfaces.

## What Teleforge Derives

From the app config, flow definitions, and screen definitions, Teleforge derives:

- bot command and callback registration
- Mini App launch buttons and deep-link payloads
- flow routes and screen resolution
- typed flow state persistence
- Mini App submit/action execution
- return-to-chat and resume behavior
- optional server-hook execution for trusted guards, loaders, submits, and actions

The framework owns repetitive cross-surface wiring. App code owns product behavior.

## Chat and Mini App Together

Teleforge treats chat and Mini App interaction as one continuous journey.

A flow can:

- begin from a bot command or button
- move into a Mini App screen for richer UI
- transition between Mini App screens
- return to chat for confirmation or completion
- pause and resume later from saved state

When a chat step action targets a Mini App step, the framework renders it as a `web_app` button. Actions that carry Mini App launch metadata produce signed deep-link buttons; actions without it remain chat callbacks. See [Flow Coordination](./flow-coordination.md) for routing and handoff details.

## Public Imports

Application code should use the unified package surfaces:

- `teleforge`: app config, flows, discovered runtimes, shared flow state helpers
- `teleforge/bot`: lower-level bot primitives when custom routing is needed
- `teleforge/web`: Mini App shell, screen definitions, Telegram hooks, and runtime helpers
- `teleforge/server-hooks`: trusted server-side load, submit, and action hooks
- `teleforge/core/browser`: browser-safe launch and validation helpers

Internal workspace packages implement these surfaces. They are not the app authoring model.

## Internal Layers

The repository contains internal packages that implement the framework:

- `packages/core`: shared schemas, launch parsing, validation, flow-state storage contracts
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
- registering bot commands from flow metadata
- rendering chat steps
- sending Mini App launch buttons
- accepting `web_app_data` and structured return-to-chat handoffs
- resuming persisted flow instances

Apps normally enter this through `startTeleforgeBot()` from `teleforge`, which loads config, resolves secrets, and starts polling automatically. The lower-level `createDiscoveredBotRuntime()` escape hatch is also available from `teleforge` when custom routing or webhook delivery is needed.

### Mini App Runtime

The Mini App runtime is a screen runtime, not a generic website shell.

It is responsible for:

- bootstrapping Telegram WebApp context
- resolving the active flow instance and step
- loading the registered screen for a Mini App step
- running client-side loaders and bridge calls
- submitting typed payloads back to the flow runtime
- transitioning between Mini App screens without hard reloads where possible
- handing control back to chat when the next flow step is a chat step

Screens are registered with `defineScreen()` from `teleforge/web`. The app shell is normally `TeleforgeMiniApp`.

## Server Hooks

Server hooks are the trusted backend extension point for a flow step.

Use them when the browser cannot be the authority for:

- identity trust
- flow instance ownership
- step validity
- permission decisions
- durable state mutation
- downstream service calls with server-only credentials

The public model is still flow-first: server hooks attach to steps; they are not a separate app mode.

## Local Tooling

The `teleforge` CLI provides:

- `teleforge dev` for local Mini App and simulator development
- `teleforge dev --public --live` for tunnel-backed Telegram testing
- `teleforge mock` for standalone Telegram context simulation
- `teleforge doctor` for config and environment checks

The CLI is shipped through the unified `teleforge` package even though its implementation lives in `packages/devtools`.

## Reference Apps

Use [`examples/starter-app`](../examples/starter-app/README.md) for the smallest working app.

Use [`apps/task-shop`](../apps/task-shop/README.md) for the full reference flow with chat/Mini App coordination, persisted state, server bridge usage, and screen runtime patterns.

## Non-Goals

Teleforge is not:

- a generic website framework
- a low-code page builder
- a public split-package assembly model
- a public backend product mode
- a compatibility layer for removed app-definition formats

## Design Rules

- Start from the flow, not from package topology.
- Keep screen code responsible for presentation and local UI state.
- Keep durable product state in flow state or domain services.
- Keep trusted decisions in server hooks or server runtime code.
- Use the simulator-first local workflow before switching to real Telegram.
- Keep public docs and examples on the unified `teleforge` package.

## Read Next

- [Config Reference](./config-reference.md)
- [Mini App Architecture](./miniapp-architecture.md)
- [Flow Coordination](./flow-coordination.md)
- [Flow State Architecture](./flow-state-design.md)
