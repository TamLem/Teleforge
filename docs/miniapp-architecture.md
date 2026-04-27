# Mini App Architecture Guidelines

This document defines the frontend architecture rules for Teleforge Mini Apps. Every screen, hook, and
client-side integration in a Teleforge project should conform to these principles.

For the runtime model, see [Flow State Architecture](./flow-state-design.md).
For the overall authoring model, see [Framework Model](./framework-model.md).

## 1. Not a Classic Monolithic SPA

Do not structure the Mini App frontend as:

- one large client bundle
- app-wide eager hydration
- a route tree designed like a normal website
- "load the whole app, then navigate inside it"

**Reason:** Telegram Mini Apps run inside a WebView with constrained resources. Large client-first
bundles hurt first render time and make the runtime heavier than necessary.

**Do instead:** treat each screen as an independent unit that can be loaded, rendered, and discarded
on its own lifecycle.

## 2. Standalone Frontend, Screen Runtime Model

The Mini App is a real frontend application, but its primary unit is the **screen**, not the website page.

Use:

- screen registry (`defineScreen`, `createScreenRegistry`)
- screen-level rendering
- screen-level loading states
- screen-level code splitting

Do not use:

- generic website-first page architecture
- arbitrary deep navigation as the primary abstraction

**Core mental model:**

```
flow → action → screen → effects
```

The framework resolves screens by matching the current URL path to a route in the flow's `miniApp.routes`
map. Routes exist to deliver screens, not to define a navigation tree.

## 3. Hybrid Rendering

The frontend should support:

- server-rendered or pre-rendered initial entry when useful
- client-side transitions after boot
- selective hydration for interactive parts
- lazy loading of later screens

Do not force:

- full client-only rendering for first entry
- full page-reload SSR for every interaction

**Goal:** small initial render cost, smooth later interactions.

> **Note:** Examples use Vite and React, but that is delivery machinery, not the product model.
> The public architecture is flow → action → screen → effects. Keep the shell small and use
> screen-level splitting as the main optimization lever.

## 4. Keep the Initial Shell Thin

The persistent Mini App shell (`TeleforgeMiniApp`) should contain only:

- Telegram WebApp bootstrap
- theme and viewport handling
- route/screen resolution
- signed action context parsing
- minimal runtime services

Do not include all screens or large feature code in the shell.

**Rule:** if a screen is not needed for the current entry, it should not be in the initial payload.

## 5. Split Code by Screen

Each major screen should be independently loadable.

Required:

- lazy-load screen components
- keep route/screen chunks small
- preload likely next screens only after the current screen is active

Do not ship catalog, checkout, settings, profile, history, etc. in one entry bundle.

> **Note:** The framework's screen registry registers `defineScreen()` objects eagerly at boot.
> The screen definition file is always imported, but the component inside can be lazy-loaded
> by splitting it into a separate file.

**Practical pattern — lazy component inside eager definition:**

```tsx
// screens/checkout.screen.tsx — eagerly imported, but component is lazy
import { lazy } from "react";
import { defineScreen } from "teleforge/web";

const CheckoutComponent = lazy(() => import("./checkout.component.js"));

export default defineScreen({
  id: "checkout",
  title: "Checkout",
  component: CheckoutComponent
});
```

```tsx
// screens/checkout.component.tsx — lazy-loaded chunk
import type { TeleforgeScreenComponentProps } from "teleforge/web";

export default function CheckoutComponent({
  runAction,
  navigate,
  transitioning
}: TeleforgeScreenComponentProps) {
  return (
    // ... actual UI
  );
}
```

This keeps the screen definition registered at boot while deferring the component code until the
screen is actually rendered.

## 6. Route-Aware, Not Site-Navigation-First

Routes map URL paths to screen IDs via the flow's `miniApp.routes`. They deliver screens, not define
the product model.

Routing should be based on:

- flow's route map (`{ "/cart": "shop.cart", "/checkout": "shop.checkout" }`)
- signed action context from the launch URL
- screen identity

Do not design the Mini App like a normal website with broad independent navigation trees as the primary
structure.

Deep routing is allowed, but it is secondary. The primary navigation path is always:
**signed context → route match → screen**.

## 7. Client-Safe Flow Manifest

The Mini App must not import bot flow source files directly.

Bot flow modules are allowed to grow server-only concerns:

- action handlers
- environment access
- logistics or payment clients
- Node-only dependencies

The browser only needs client-safe flow metadata:

- flow id
- Mini App route-to-screen mapping
- screen ids, titles, available actions
- session requirements

Use `flowManifest` when booting the Mini App shell:

```tsx
import { TeleforgeMiniApp } from "teleforge/web";

import { flowManifest } from "./teleforge-generated/client-flow-manifest.js";
import homeScreen from "./screens/home.screen.js";

<TeleforgeMiniApp flowManifest={flowManifest} screens={[homeScreen]} />;
```

Generated apps include `apps/web/src/teleforge-generated/client-flow-manifest.ts` as the client
boundary. Run `teleforge generate client-manifest` to regenerate it after flow changes. The generated
file is browser-safe and excludes server-only fields such as action handlers.

Do not do this in web code:

```tsx
import startFlow from "../../bot/src/flows/start.flow.js";
```

That couples browser builds to server flow implementation details and can accidentally ship server-only code.

## 8. Screen Registry, Not Template Engine

Screens are implemented as real React components and registered by screen ID.

Use:

```
shop.catalog
shop.cart
shop.checkout
shop.success
```

Do not make the framework depend on:

- server-side page templates
- rigid UI DSL as the primary rendering model

Templates may exist for simple internal cases, but must not be the main frontend architecture.

**Screen definition:**

```tsx
export default defineScreen({
  id: "shop.catalog",
  title: "Browse Tasks",
  component: CatalogScreen
});
```

## 9. Flow Definitions Own Behavior; Screens Own Presentation

| Layer      | Defines                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| **Flow**   | routes, actions, action handlers, session config                                |
| **Screen** | UI rendering, local interaction behavior, input collection, action invocation   |

Do not duplicate business logic inside screens. Screens call `runAction(actionId, payload)` and let
the server resolve the result.

**Flow defines routes and actions:**

```ts
miniApp: {
  routes: {
    "/catalog": "shop.catalog",
    "/checkout": "shop.checkout"
  }
},
actions: {
  goToCheckout: {
    handler: async ({ data }) => ({ navigate: "shop.checkout" })
  }
}
```

**Screen implements the UI:**

```tsx
function CatalogScreen({ runAction }) {
  return <button onClick={() => runAction("goToCheckout")}>Checkout</button>;
}
```

## 10. Screens Must Not Reconstruct Authoritative State

Screens receive context data from the runtime via the `data` prop and signed context.

Use:

- context data (`props.data`)
- loader data (`props.loaderData`)
- runtime metadata (`props.screenId`, `props.routePath`)

Do not:

- parse state from launch payload
- rebuild state from URL/query data
- treat frontend-local copies as authoritative

The frontend may hold local UI state (modals, form inputs, filters), but **domain state and action
results are authoritative**.

## 11. Separate State Types Clearly

| Type                   | Scope                                    | Examples                                                      |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| **Domain state**       | Persistent, in database or services      | user profile, product catalog, order history                  |
| **Local UI state**     | Ephemeral, screen-only                   | open modals, unsaved inputs, temporary filters, loading flags |
| **Session state**     | Optional, server-side, TTL-bound         | drafts, multi-step wizards, external wait state               |
| **Derived view state** | Computed, usually not persisted          | formatted prices, filtered lists, sort order                  |

Do not blur these together into one global client state store.

**In practice:**

- Domain state → `services` in action handlers
- Local UI state → `useState` inside the screen component
- Session state → `session.patch()` in action handlers (only for session flows)
- Derived view state → `useMemo` inside the screen component

## 12. Telegram-Specific Behavior Behind Adapter Layer

Wrap Telegram Mini App capabilities behind framework hooks and services.

| Capability     | Framework Hook                                  |
| -------------- | ----------------------------------------------- |
| Main button    | `useMainButton()`, `useCoordinatedMainButton()` |
| Back button    | `useBackButton()`                               |
| Theme          | `useTheme()`                                    |
| Launch context | `useLaunch()`                                   |
| Raw WebApp     | `useTelegram()`                                 |

Do not scatter raw `window.Telegram.WebApp` calls across screens.

## 13. Optimize for First Useful Paint

Every frontend choice should favor:

- small entry payload
- low JS parse/execute cost
- fast screen visibility
- minimal blocking requests

This takes priority over convenience patterns that grow the boot bundle.

## 14. Client Transitions After Boot

Once the initial screen is active, transitions between Mini App screens should usually be client-driven.

**Rule:** server-helped entry, client-driven continuation.

The `TeleforgeMiniApp` runtime invokes `runAction()` on the server and handles navigation results
(`navigate` in `ActionResult`) without full page reloads.

## 15. Framework Transport ≠ Product Abstraction

The frontend delivery/runtime layer is implementation machinery.

It should not become the primary product abstraction.

**Primary abstraction remains:**

```
flow → action → screen → effects
```

Do not let route files define business flow structure directly. Route files deliver screens;
flow definitions define behavior.

## 16. API Adapter Is Not the UI Owner

Mini App navigation and UI behavior are realized by the Mini App client runtime.

| Server/API responsibilities | Client responsibilities |
| --------------------------- | ----------------------- |
| validate signed context     | render                  |
| run action handlers         | navigate screens        |
| produce effects             | show handoff UI         |
| manage session state        | manage local UI state   |

## 17. Treat the Frontend as Untrusted

The frontend may:

- render
- collect input
- invoke actions

The frontend must **not** be the authority for:

- permissions
- valid operations
- committed data
- lifecycle ownership

All authoritative decisions stay in server-side action handlers. The server validates every action
request via the signed action context token.

## 18. Explicit Runtime Contracts

Frontend integration uses explicit contracts for:

- screen context (`TeleforgeScreenComponentProps`)
- action result (`ActionResult`)
- action invocation (`runAction(actionId, payload)`)
- navigation instruction (`navigate` in `ActionResult`)
- handoff instruction (`showHandoff`, `closeMiniApp` in `ActionResult`)

Do not rely on loose implicit coupling between frontend screens and backend handlers.

## 19. Design for Deployment Flexibility

The frontend architecture must work whether the system is deployed as:

- same-process dev mode
- split bot/api runtime
- webhook mode
- edge-assisted delivery

Do not tie frontend assumptions to one process topology. The screen registry and action server are
all transport-agnostic.

---

## Quick Reference

| Principle                   | One-liner                                        |
| --------------------------- | ------------------------------------------------ |
| 1. Not a monolithic SPA     | Small bundles, no eager whole-app hydration      |
| 2. Screen runtime           | Screen is the primary unit, not the page         |
| 3. Hybrid rendering         | Server entry + client transitions + lazy screens |
| 4. Thin shell               | Shell bootstraps only; screens load on demand    |
| 5. Split by screen          | Each screen independently loadable               |
| 6. Route-aware routing      | Routes deliver screens; flows define behavior    |
| 7. Screen registry          | Real components, registered by ID                |
| 8. Behavior vs presentation | Flow = behavior, screen = UI                     |
| 9. Authoritative context    | Server owns decisions; screens invoke actions    |
| 10. State boundaries        | Domain, local, session, derived — keep separate  |
| 11. Telegram adapter        | SDK calls behind hooks, not scattered            |
| 12. First useful paint      | Small entry, low parse cost, fast visibility     |
| 13. Client after boot       | Server entry, client continuation                |
| 14. Transport ≠ abstraction | Build tool delivers; flow defines behavior       |
| 15. API ≠ UI owner          | Server validates; client renders                 |
| 16. Untrusted frontend      | Server is authority for operations               |
| 17. Explicit contracts      | No implicit coupling                             |
| 18. Deployment flexible     | Works in any topology                            |
