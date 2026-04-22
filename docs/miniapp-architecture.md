# Mini App Architecture Guidelines

This document defines the frontend architecture rules for Teleforge Mini Apps. Every screen, hook, and client-side integration in a Teleforge project should conform to these principles.

For the storage and runtime model, see [Flow State Architecture](./flow-state-design.md).
For the overall authoring model, see [Framework Model](./framework-model.md).

## 1. Not a Classic Monolithic SPA

Do not structure the Mini App frontend as:

- one large client bundle
- app-wide eager hydration
- a route tree designed like a normal website
- "load the whole app, then navigate inside it"

**Reason:** Telegram Mini Apps run inside a WebView with constrained resources. Large client-first bundles hurt first render time and make the runtime heavier than necessary.

**Do instead:** treat each screen as an independent unit that can be loaded, rendered, and discarded on its own lifecycle.

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
flow → step → screen → transition
```

The framework resolves screens by matching the current flow step to a registered screen ID. Routes exist to deliver screens, not to define a navigation tree.

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

> **Current implementation note:** Today's examples use Vite and React, but that is delivery machinery, not the product model. The public architecture remains flow → step → screen → transition. Until deeper hybrid-rendering support lands, keep the shell small and use screen-level splitting as the main optimization lever.

## 4. Keep the Initial Shell Thin

The persistent Mini App shell (`TeleforgeMiniApp`) should contain only:

- Telegram WebApp bootstrap
- theme and viewport handling
- route/screen resolution
- flow context bootstrap
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

> **Current status:** The framework's screen registry registers `defineScreen()` objects eagerly at boot. The screen definition file is always imported, but the component inside can be lazy-loaded by splitting it into a separate file. Full lazy screen-definition support (where the framework defers importing the screen module until the step is reached) is planned.

**Practical pattern today — lazy component inside eager definition:**

```tsx
// screens/checkout.screen.tsx — eagerly imported, but component is lazy
import { lazy } from "react";
import { defineScreen } from "teleforge/web";

// The actual component code lives in a separate file and loads on demand
const CheckoutComponent = lazy(() => import("./checkout.component.js"));

export default defineScreen<TaskShopFlowState>({
  id: "task-shop.checkout",
  title: "Checkout",
  component: CheckoutComponent
});
```

```tsx
// screens/checkout.component.tsx — lazy-loaded chunk
import type { TaskShopFlowState } from "../types";
import type { TeleforgeScreenComponentProps } from "teleforge/web";

export default function CheckoutComponent({
  state,
  submit,
  transitioning
}: TeleforgeScreenComponentProps<TaskShopFlowState>) {
  return (
    // ... actual UI
  );
}
```

This keeps the screen definition registered at boot while deferring the component code until the screen is actually rendered.

## 6. Flow-Aware Routing, Not Site-Navigation-First

Routes exist to deliver screens, not to define the product model.

Routing should be based on:

- flow instance
- current step
- screen identity
- launch intent

Do not design the Mini App like a normal website with broad independent navigation trees as the primary structure.

Deep routing is allowed, but it is secondary. The primary navigation path is always: **flow step → screen**.

## 7. Client-Safe Flow Manifest

The Mini App must not import bot flow source files directly.

Bot flow modules are allowed to grow server-only concerns:

- submit handlers
- action handlers
- loaders and guards
- environment access
- logistics or payment clients
- Node-only dependencies

The browser only needs client-safe flow metadata:

- flow id
- initial and final step ids
- Mini App route and step route mapping
- step type
- screen ids
- action labels, ids, targets, and Mini App payload metadata
- initial public state shape

Use `flowManifest` when booting the Mini App shell:

```tsx
import { TeleforgeMiniApp } from "teleforge/web";

import { flowManifest } from "./flow-manifest.js";
import homeScreen from "./screens/home.screen.js";

<TeleforgeMiniApp flowManifest={flowManifest} screens={[homeScreen]} />;
```

Generated apps include `apps/web/src/flow-manifest.ts` as the client boundary. That file may be handwritten in early apps, but the contract is designed so Teleforge can later replace it with a generated virtual module without changing screen code.

Do not do this in web code:

```tsx
import startFlow from "../../bot/src/flows/start.flow.js";
```

That couples browser builds to server flow implementation details and can accidentally ship server-only code.

## 8. Screen Registry, Not Template Engine

Screens are implemented as real React components and registered by screen ID.

Use:

```
task-shop.catalog
task-shop.cart
task-shop.checkout
task-shop.success
```

Do not make the framework depend on:

- server-side page templates
- rigid UI DSL as the primary rendering model

Templates may exist for simple internal cases, but must not be the main frontend architecture.

**Screen definition:**

```tsx
export default defineScreen<TaskShopFlowState>({
  id: "task-shop.catalog",
  title: "Browse Tasks",
  component: CatalogScreen
});
```

## 9. Flow Definitions Own Behavior; Screens Own Presentation

| Layer      | Defines                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| **Flow**   | step type, screen ID, guard, loader, submit contract, transition logic          |
| **Screen** | UI rendering, local interaction behavior, input collection, action/submit calls |

Do not duplicate transition logic inside screens. Screens call `submit(data)` and let the runtime resolve the next step.

**Flow defines the contract:**

```ts
steps: {
  catalog: {
    screen: "task-shop.catalog",
    type: "miniapp"
  },
  checkout: {
    screen: "task-shop.checkout",
    type: "miniapp"
  }
}
```

**Screen implements the UI:**

```tsx
function CatalogScreen({ state, submit }) {
  return <button onClick={() => submit({ type: "go-to-checkout" })}>Checkout</button>;
}
```

## 10. Screens Must Not Reconstruct Authoritative Flow State

Screens receive authoritative state from the runtime via the `state` prop.

Use:

- resolved state (`props.state`)
- loader data (`props.loaderData`)
- runtime metadata (`props.flowId`, `props.stepId`)

Do not:

- parse state from launch payload
- rebuild state from URL/query data
- treat frontend-local copies as authoritative

The frontend may hold local UI state (modals, form inputs, filters), but **runtime flow state is authoritative**.

## 11. Separate State Types Clearly

| Type                   | Scope                                    | Examples                                                      |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| **Flow state**         | Durable, cross-surface (chat ↔ Mini App) | cart items, order ID, user selections                         |
| **Local UI state**     | Ephemeral, screen-only                   | open modals, unsaved inputs, temporary filters, loading flags |
| **Domain state**       | Persistent, outside flow instance        | user profile, product catalog, settings                       |
| **Derived view state** | Computed, usually not persisted          | formatted prices, filtered lists, sort order                  |

Do not blur these together into one global client state store.

**In practice:**

- Flow state → `props.state` (from `FlowResumeProvider`)
- Local UI state → `useState` inside the screen component
- Domain state → server hooks / BFF queries
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

**Current adapter location:** `packages/web/src/utils/ssr.ts` — `getTelegramWebApp()` is the single point of direct SDK access. All other code uses typed hooks.

## 13. Optimize for First Useful Paint

Every frontend choice should favor:

- small entry payload
- low JS parse/execute cost
- fast screen visibility
- minimal blocking requests

This takes priority over convenience patterns that grow the boot bundle.

**Practical rules:**

- lazy-load every screen that is not the entry screen
- defer non-critical imports until after first render
- avoid large libraries in the shell
- inline critical CSS; defer the rest

## 14. Client Transitions After Boot

Once the initial screen is active, transitions between Mini App steps should usually be client-driven.

This is where app-like smoothness happens.

**Rule:** server-helped entry, client-driven continuation.

The `useFlowNavigation()` hook provides `navigateToStep()` and `navigateToRoute()` for client-side transitions that persist state and update the browser URL.

## 15. Framework Transport ≠ Product Abstraction

The frontend delivery/runtime layer is implementation machinery.

It should not become the primary product abstraction.

**Primary abstraction remains:**

```
flow → step → screen → transition
```

Do not let route files define business flow structure directly. Route files deliver screens; flow definitions define behavior.

## 16. API Adapter Is Not the UI Owner

Mini App navigation and UI behavior are realized by the Mini App client runtime.

| Server/API responsibilities | Client responsibilities |
| --------------------------- | ----------------------- |
| validate                    | render                  |
| load                        | navigate screens        |
| submit                      | show handoff UI         |
| transition                  | manage local UI state   |
| return results              |                         |

## 17. Treat the Frontend as Untrusted

The frontend may:

- render
- collect input
- invoke runtime actions

The frontend must **not** be the authority for:

- permissions
- valid transitions
- committed flow state
- lifecycle ownership

All authoritative transition decisions stay in runtime/server layers. Server hooks enforce this via trusted actor validation, state-key verification, and ownership checks.

## 18. Explicit Runtime Contracts

Frontend integration uses explicit contracts for:

- screen context (`TeleforgeScreenComponentProps<TState>`)
- load result (`TeleforgeMiniAppServerLoadResult`)
- submit result (`FlowTransitionResult`)
- action result (`FlowTransitionResult`)
- navigation instruction (`navigateToStep`, `navigateToRoute`)
- handoff instruction (`returnToChat`, `completeFlow`, `cancelFlow`)

Do not rely on loose implicit coupling between frontend screens and backend handlers.

## 19. Design for Deployment Flexibility

The frontend architecture must work whether the system is deployed as:

- same-process dev mode
- split bot/api runtime
- webhook mode
- edge-assisted delivery

Do not tie frontend assumptions to one process topology. The screen registry, coordination layer, and server hooks are all transport-agnostic.

---

## Quick Reference

| Principle                   | One-liner                                        |
| --------------------------- | ------------------------------------------------ |
| 1. Not a monolithic SPA     | Small bundles, no eager whole-app hydration      |
| 2. Screen runtime           | Screen is the primary unit, not the page         |
| 3. Hybrid rendering         | Server entry + client transitions + lazy screens |
| 4. Thin shell               | Shell bootstraps only; screens load on demand    |
| 5. Split by screen          | Each screen independently loadable               |
| 6. Flow-aware routing       | Routes deliver screens; flows define behavior    |
| 7. Screen registry          | Real components, registered by ID                |
| 8. Behavior vs presentation | Flow = behavior, screen = UI                     |
| 9. Authoritative state      | Runtime owns state; screens receive it           |
| 10. State boundaries        | Flow, local, domain, derived — keep separate     |
| 11. Telegram adapter        | SDK calls behind hooks, not scattered            |
| 12. First useful paint      | Small entry, low parse cost, fast visibility     |
| 13. Client after boot       | Server entry, client continuation                |
| 14. Transport ≠ abstraction | Build tool delivers; flow/screen defines         |
| 15. API ≠ UI owner          | Server validates; client renders                 |
| 16. Untrusted frontend      | Server is authority for transitions              |
| 17. Explicit contracts      | No implicit coupling                             |
| 18. Deployment flexible     | Works in any topology                            |
