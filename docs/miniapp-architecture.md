# Mini App Architecture

This document defines the frontend architecture rules for Teleforge Mini Apps. Every screen, hook, and
client-side integration in a Teleforge project should conform to these principles.

For the runtime model and state boundaries, see [State Boundaries](./state-boundaries.md).
For the overall authoring model, see [Framework Model](./framework-model.md).

## 1. Not a Classic Monolithic SPA

Do not structure the Mini App frontend as one large client bundle or a route tree designed like a normal website.

**Reason:** Telegram Mini Apps run inside a WebView with constrained resources. Large client-first
bundles hurt first render time.

**Do instead:** treat each screen as an independent unit that can be loaded, rendered, and discarded
on its own lifecycle.

## 2. Screen Runtime Model

The Mini App is a real frontend application, but its primary unit is the **screen**, not the website page.

Use:

- screen registry (`defineScreen`, `createScreenRegistry`)
- screen-level rendering, loading states, and code splitting
- generated per-screen prop aliases for typed `nav`, `actions`, `loader`, and `loaderData`

**Core mental model:**

```
flow definitions → client manifest → generated contracts → typed screen props
                         ↓
                    flow → action → screen → effects
```

The framework resolves screens by matching the current URL path to a route in the flow's `miniApp.routes`
map. Routes exist to deliver screens, not to define a navigation tree. Generated contracts turn that
route map into compile-time safe `nav.*` helpers, `actions.*` payloads, and per-screen `loaderData` types.

For how the runtime constructs `actions.*` and `nav.*` from the manifest, and how loaders receive route
params, see [Runtime Wiring](./runtime-wiring.md).

## 3. Hybrid Rendering

The frontend should support:

- server-rendered or pre-rendered initial entry when useful
- client-side transitions after boot
- selective hydration for interactive parts
- lazy loading of later screens

> Examples use Vite and React, but that is delivery machinery, not the product model.
> Keep the shell small and use screen-level splitting as the main optimization lever.

## 4. Keep the Initial Shell Thin

The persistent Mini App shell (`TeleforgeMiniApp`) should contain only:

- Telegram WebApp bootstrap
- theme and viewport handling
- route/screen resolution
- signed action context parsing
- server bridge for actions and loaders
- `nav.*` and `actions.*` helper construction

Do not include all screens or large feature code in the shell.

**Rule:** if a screen is not needed for the current entry, it should not be in the initial payload.

## 5. Split Code by Screen

Each major screen should be independently loadable.

Required:

- lazy-load screen components
- keep route/screen chunks small
- preload likely next screens only after the current screen is active

**Lazy component pattern:**

```tsx
import { lazy } from "react";
import { defineScreen } from "teleforge/web";

const CheckoutComponent = lazy(() => import("./checkout.component.js"));

export default defineScreen({
  id: "checkout",
  title: "Checkout",
  component: CheckoutComponent
});
```

This keeps the screen definition registered at boot while deferring the component code until the
screen is actually rendered.

## 6. Route-Aware, Not Site-Navigation-First

Routes map URL paths to screen IDs via the flow's `miniApp.routes`. They deliver screens, not define
the product model.

Routing should be based on:

- flow's route map (`{ "/cart": "cart", "/checkout": "checkout" }`)
- signed action context from the launch URL
- screen identity

The primary navigation path is always:
**signed context → route match → screen → loader → actions._ / nav._**

For the full chain, see [Runtime Wiring](./runtime-wiring.md).

## 7. Client-Safe Flow Manifest

The Mini App must not import bot flow source files directly.

Use `flowManifest` when booting the Mini App shell:

```tsx
import { TeleforgeMiniApp } from "teleforge/web";
import { flowManifest } from "./teleforge-generated/client-flow-manifest.js";
import catalogScreen from "./screens/catalog.screen.js";

<TeleforgeMiniApp flowManifest={flowManifest} screens={[catalogScreen]} />;
```

Do not do this in web code:

```tsx
import startFlow from "../../bot/src/flows/start.flow.js";
```

That couples browser builds to server flow implementation details and can accidentally ship server-only code.

## 8. Screen Registry, Not Template Engine

Screens are implemented as React components and registered by screen ID.

```tsx
export default defineScreen({
  id: "catalog",
  title: "Browse Products",
  component: CatalogScreen
});
```

## 9. Flow Definitions Own Behavior; Screens Own Presentation

| Layer      | Defines                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- |
| **Flow**   | routes, actions, action handlers, session config                                                    |
| **Screen** | UI rendering, local interaction behavior, input collection, action invocation, navigation decisions |

Screens use `actions.*` for server-side work and `nav.*` to move between screens.

**Flow defines routes and actions:**

```ts
actions: {
  addToCart: {
    input: addToCartSchema,
    handler: async ({ input, session }) => {
      // Store references only, not full display objects
      const cart = session.resource<{ items: Array<{ productId: string; qty: number }> }>("cart", { initialValue: { items: [] } });
      await cart.update((draft) => { draft.items.push({ productId: input.productId, qty: input.qty }); });
      return { data: { added: true } };
    }
  }
}
```

**Screen implements UI and owns navigation via helpers:**

```tsx
import type { CatalogScreenProps } from "./teleforge-generated/contracts";

function CatalogScreen({ actions, nav, loader, loaderData }: CatalogScreenProps) {
  if (loader.status !== "ready") return <div>Loading...</div>;
  const products = loaderData?.products ?? [];

  return (
    <div>
      {products.map((p) => (
        <div key={p.id}>
          <span>{p.name}</span>
          <button onClick={() => actions.addToCart({ productId: p.id, qty: 1 })}>Add</button>
          <button onClick={() => nav.productDetail({ id: p.id })}>Details</button>
        </div>
      ))}
    </div>
  );
}
```

## 10. Screen Data Boundaries

Screens receive framework-injected props that make the trust boundary explicit.
`scopeData` and `loaderData` are server-trusted. `routeParams` is framework-derived.
`routeData` and `appState` are client-owned. Do not parse state from the launch URL,
pass domain payloads through `navigate({ data })`, or use `loaderData as ...` casts —
declare types in `teleforge-contract-overrides.ts` instead.

For the full trust model, the five state-type categories, and session resources, see
[State Boundaries](./state-boundaries.md). For how props travel through the runtime, see
[Runtime Wiring](./runtime-wiring.md).

## 11. Telegram-Specific Behavior Behind Adapter Layer

Wrap Telegram Mini App capabilities behind framework hooks.

| Capability     | Framework Hook                                  |
| -------------- | ----------------------------------------------- |
| Main button    | `useMainButton()`, `useCoordinatedMainButton()` |
| Back button    | `useBackButton()`                               |
| Theme          | `useTheme()`                                    |
| Launch context | `useLaunch()`                                   |
| Raw WebApp     | `useTelegram()`                                 |

## 12. Optimize for First Useful Paint

Every frontend choice should favor:

- small entry payload
- low JS parse/execute cost
- fast screen visibility
- minimal blocking requests

## 13. Client Transitions After Boot

Once the initial screen is active, transitions between Mini App screens should be client-driven.

Server-helped entry, client-driven continuation.

## 14. Framework Transport ≠ Product Abstraction

The frontend delivery/runtime layer is implementation machinery.

**Primary abstraction remains:**

```
flow → action → screen → effects
```

## 15. API Adapter Is Not the UI Owner

| Server/API responsibilities | Client responsibilities |
| --------------------------- | ----------------------- |
| validate signed context     | render                  |
| run action handlers         | navigate screens        |
| produce effects             | show handoff UI         |
| manage session resources    | manage local UI state   |

## 16. Treat the Frontend as Untrusted

The frontend may:

- render
- collect input
- invoke actions

The frontend must **not** be the authority for:

- permissions
- valid operations
- committed data
- lifecycle ownership

## 17. Explicit Runtime Contracts

Frontend integration uses explicit contracts:

- generated per-screen prop aliases (`CatalogScreenProps`, `ProductDetailScreenProps`, ...)
- action result (`ActionResult`)
- action invocation (`actions.*` or `runAction`)
- navigation (`nav.*` or `navigate`)
- typed loader lifecycle (`TypedLoaderState<TData>`)

The base `TeleforgeScreenComponentProps` is the runtime contract. The generated aliases are the
DX layer that narrows `nav`, `actions`, `loader`, and `loaderData` to types safe for the current
flow and screen.

For how the runtime constructs these helpers from the manifest, see [Runtime Wiring](./runtime-wiring.md).
For the generated authoring model, see [Generated Mini App Contracts](./generated-miniapp-contracts.md).

## 18. Design for Deployment Flexibility

The frontend architecture must work whether the system is deployed as:

- same-process dev mode
- split bot/api runtime
- webhook mode
- edge-assisted delivery

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
| 7. Client manifest          | Generated, browser-safe, no server imports       |
| 8. Screen registry          | Real components, registered by ID                |
| 9. Behavior vs presentation | Flow = behavior, screen = UI                     |
| 10. Data boundaries         | scopeData/routeParams/routeData/loader/appState  |
| 11. Telegram adapter        | SDK calls behind hooks, not scattered            |
| 12. First useful paint      | Small entry, low parse cost, fast visibility     |
| 13. Client after boot       | Server entry, client continuation                |
| 14. Transport ≠ abstraction | Build tool delivers; flow defines behavior       |
| 15. API ≠ UI owner          | Server validates; client renders                 |
| 16. Untrusted frontend      | Server is authority for operations               |
| 17. Explicit contracts      | No implicit coupling                             |
| 18. Deployment flexible     | Works in any topology                            |
