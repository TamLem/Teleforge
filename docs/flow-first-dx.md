# Flow-First Developer Experience

This document describes a direction for Teleforge's next developer experience. It is not a description of the current Teleforge V1 implementation.

The goal is to make Teleforge feel like a unified framework instead of a collection of packages that developers assemble by hand.

## Core Idea

The primary authoring model should be:

- define a flow
- define the steps in that flow
- attach handlers to user actions and transitions
- let Teleforge wire the bot, Mini App, state, resume, and optional server-backed behavior around it

Instead of starting from package boundaries or runtime topology choices, developers should start from the user journey they want to build.

## Why This Direction

Today, Teleforge V1 is strongest when the developer already understands:

- which package owns which concern
- how chat opens a Mini App
- how Mini App state is resumed
- how `web_app_data`, return-to-chat helpers, and server-backed flow behavior fit together

That is workable for framework authors and advanced users, but it still feels library-first.

A more unified framework model should make the first question:

- "What flow am I building?"

not:

- "Which package do I import first?"

## The Authoring Model

In the flow-first model, a Teleforge app is composed from typed flows.

Each flow has:

- an ID
- typed state
- an initial step
- a set of steps
- transitions between those steps
- handlers for entering, submitting, completing, guarding, or branching the flow

The core concepts are:

- `Flow`: a complete user journey such as onboarding, checkout, profile setup, or phone verification
- `Step`: one unit of interaction in chat or in the Mini App
- `Screen`: the Mini App UI bound to a Mini App step
- `Handler`: the application logic attached to a step or action
- `State`: typed data accumulated through the flow
- `Transition`: the next destination after a user action or handler result

## Example Shape

One intended shape is:

```ts
import { defineFlow } from "teleforge";

export const orderFlow = defineFlow({
  id: "order",
  initialStep: "welcome",
  state: {} as {
    productId?: string;
    quantity?: number;
    note?: string;
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
      onSubmit: async ({ state, data }) => {
        return {
          state: {
            ...state,
            productId: data.productId,
            quantity: data.quantity
          },
          to: "confirm"
        };
      }
    },

    confirm: {
      type: "chat",
      message: ({ state }) => `Confirm order for ${state.quantity} item(s)?`,
      actions: [
        {
          label: "Confirm",
          handler: async ({ state, services }) => {
            await services.orders.create(state);
            return { to: "done" };
          }
        }
      ]
    },

    done: {
      type: "chat",
      message: "Order placed."
    }
  }
});
```

This is not a final API contract. It shows the intended center of gravity: the flow definition, not low-level runtime assembly.

## What Teleforge Should Derive

From that definition, the framework should own the repetitive wiring:

- bot command and callback registration
- Mini App screen entry and runtime resolution
- screen registry and route-to-screen matching
- typed flow state persistence
- return-to-chat behavior
- resume behavior after interruption
- optional server hooks for validation, loaders, submits, or trusted actions where the flow needs them

In other words, the framework should interpret the flow across surfaces instead of forcing developers to manually synchronize chat logic, screen logic, and server logic.

## Handlers as the Main Extension Point

In this model, handlers become the primary customization surface.

Important handler shapes include:

- `onEnter`
- `onMessage`
- `onAction`
- `onSubmit`
- `onComplete`
- `guard`
- `loader`

The important constraint is that these should feel like one flow runtime model, not separate bot/web/backend APIs that the app author has to stitch together manually.

This keeps application logic close to the step where it matters.

## Chat and Mini App Together

Teleforge should treat chat and Mini App interaction as one continuous journey.

That means a flow can:

- begin from a bot command or button
- move into a Mini App screen for richer UI
- return to chat for confirmation or completion
- pause and resume later from saved state

The framework should make that normal, not advanced.

It should also present one default Mini App model to the user.

The app author should not need to choose between:

- a "SPA mode"
- a "Next.js mode"
- a "BFF mode"

Those are implementation details or legacy repo concepts, not the intended V2 authoring model.

## Relationship to V1

Teleforge V1 already contains building blocks for this direction:

- coordinated flow state
- bot-side Mini App launch helpers
- Mini App resume and return-to-chat helpers
- server-side auth, identity, and route helpers that can be reused behind flow hooks

The problem is not that the pieces do not exist. The problem is that developers still experience them as separate pieces.

The flow-first direction reframes those pieces behind one framework model.

Current migration progress already reflects part of this direction:

- shared `defineFlow()` definitions can now be used on bot and Mini App surfaces
- Mini App screens can be registered through `defineScreen()`
- `TeleforgeMiniApp` provides a framework-owned shell for flow-aware screen resolution
- screen modules can now carry framework-owned guard and loader hooks
- Mini App submit and action transitions now have framework-owned execution helpers
- the starter app and generated scaffold are converging on one default Mini App shape instead of separate public mode choices

## Desired Outcome

The desired developer experience is:

- define a flow
- define screens for Mini App steps where needed
- write handlers where the business logic lives
- let Teleforge run that flow across chat, Mini App, and optional server-backed boundaries

That is the shift from Teleforge as a toolkit to Teleforge as a framework.

If you want the concrete V2 cutover path from the current architecture, read [Flow-First V2 Migration Plan](./flow-first-migration.md).
