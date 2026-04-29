# Runtime Wiring

This page explains the complete Teleforge runtime chain in one place. If you understand this page, you understand how chat, Mini App, server, and generated artifacts fit together.

The chain is:

```text
Bot handler calls sign()
  -> signed Mini App URL opens
  -> client manifest resolves route to screen
  -> Mini App runtime injects screen props
  -> runtime calls server loader
  -> screen renders loaderData
  -> screen calls actions.* / nav.*
```

Each arrow is a framework boundary. App code lives at the ends (bot handlers and screen components). Teleforge owns the wiring in between.

---

## sign()

`sign()` is available in bot command handlers, action handlers, and flow event handlers. It creates a signed Mini App launch URL.

```ts
const launch = await sign({
  screenId: "catalog",
  subject: { resource: { type: "product", id: "iphone-15" } },
  allowedActions: ["addToCart", "removeFromCart"]
});
```

### What it creates

A URL with an HMAC-signed `tfp2` token attached as a start parameter. When Telegram opens the Mini App, the token travels through the WebApp bridge to the client, and the client sends it back on every action and loader request.

### What the token contains

```ts
interface ActionContextToken {
  appId: string;
  flowId: string;
  screenId?: string;
  userId: string;
  subject?: Record<string, unknown>;
  allowedActions?: string[];
  issuedAt: number;
  expiresAt: number;
  nonce?: string;
}
```

### What should go in `subject`

Only IDs and scope. Never full domain payloads.

**Good subject:**

```ts
{ resource: { type: "product", id: "iphone-15" } }
{ resource: { type: "order", id: "ord_123" } }
{ resource: { type: "phone", value: "+14155551234" } }
```

**Bad subject:**

```ts
{ product: { name: "iPhone 15", price: 999, image: "..." } }  // display data
{ cart: ["iphone-15", "airpods-pro"] }                        // mutable state
```

Display data belongs in server loaders. Mutable state belongs in session resources or action handlers. The signed token is immutable scope.

### What `allowedActions` does

The server validates that every action call is in this list. If a screen calls `actions.hack()` and `"hack"` is not in `allowedActions`, the server rejects the request before the handler runs.

---

## Route And Screen Resolution

When the Mini App opens, the runtime needs to know which screen to render.

### Where the route map lives

The client flow manifest (`apps/web/src/teleforge-generated/client-flow-manifest.ts`) contains a browser-safe copy of the flow's `miniApp.routes`:

```ts
{
  flows: [
    {
      id: "gadgetshop",
      miniApp: {
        routes: {
          "/": "catalog",
          "/product/:id": "product-detail",
          "/cart": "cart",
          "/confirmation": "confirmation"
        },
        defaultRoute: "/"
      }
    }
  ]
}
```

This is generated from the flow definition. It contains no server handlers, no secrets, and no business logic. It is safe to import into the browser bundle.

### How resolution works

1. `TeleforgeMiniApp` receives the current URL path (from the Telegram launch or from client navigation).
2. It matches the path against the manifest route patterns.
3. The matching route yields a `screenId` (e.g., `"product-detail"`).
4. The screen registry (built from `defineScreen()` modules) finds the component for that ID.
5. The component receives props.

If no route matches, the runtime shows a not-found screen. If the screen is not registered, it shows a registration error.

---

## Screen Props Are Framework Runtime Context

A Teleforge screen does not receive arbitrary React props. It receives a strict set of framework-injected props that make the trust boundary explicit.

| Prop | Source | Trust | Purpose |
|---|---|---|---|
| `scopeData` | Signed context `subject` | **Server** | Immutable IDs and scope from the signed token |
| `routeParams` | Matched route pattern | **Framework** | URL params like `{ id: "iphone-15" }` from `/product/:id` |
| `routeData` | `navigate({ data })` | **Client** | Ephemeral data passed during screen transition |
| `loader` | Server loader result | **Server** | `{ status, data, error }` discriminated lifecycle |
| `loaderData` | `loader.data` when ready | **Server** | Typed convenience accessor for the loader result |
| `appState` | React context | **Client** | Cross-screen ephemeral state |
| `actions` | Runtime helpers | **Framework** | `actions.addToCart(payload)` sends to action server |
| `nav` | Runtime helpers | **Framework** | `nav.cart()` changes screen client-side |
| `transitioning` | Runtime flag | **Framework** | True while an action or navigation is in flight |

### Why injected props are good practice here

Teleforge screens run inside a WebView with a specific lifecycle: boot, parse signed context, resolve route, call loader, render. The framework already knows what data the screen needs. Injecting it explicitly prevents three common bugs:

1. **Parsing initData by hand.** The framework parses and validates the signed token. The screen receives the validated result.
2. **Trusting client-side copies.** `scopeData` comes from the server-signed token. The screen cannot forge it.
3. **Fetching display data in the component.** The framework calls the server loader before render. The screen receives `loaderData` as a prop.

This is not React convention for generic apps. It is Teleforge convention for Mini App screens, because the runtime boundary is real and the data sources are strictly separated.

---

## Server Loaders

Loaders fetch display data for a screen. They run server-side and return plain objects.

### File convention

Loaders live in `apps/api/src/loaders/` (or the configured loader root) and are named after the screen ID:

```text
apps/api/src/loaders/
  catalog.loader.ts      -> screenId "catalog"
  product-detail.loader.ts -> screenId "product-detail"
  cart.loader.ts         -> screenId "cart"
```

### How a loader receives route params

When the runtime resolves a screen, it extracts `routeParams` from the matched URL pattern. These params are sent to the loader in the `params` field:

```ts
export default defineLoader({
  handler: async ({ ctx, params, services, session }) => {
    // params = { id: "iphone-15" } for route /product/:id
    const product = await services.catalog.get(params.id, ctx.userId);
    return { product };
  }
});
```

The `ctx` field is the validated signed action context token. The server has already checked its signature, expiry, and allowed actions before the loader runs.

### Loader lifecycle

The runtime exposes loaders to screens through a discriminated type:

```ts
if (loader.status === "loading") return <div>Loading...</div>;
if (loader.status === "error") return <div>Error</div>;
if (loader.status === "ready") {
  // loader.data is available and typed
  const products = loader.data.products;
}
```

`loaderData` is a convenience that equals `loader.data` when `status === "ready"`, otherwise `undefined`.

---

## Actions

Actions are server-side handlers defined in the flow file. The screen calls them through runtime helpers.

### How actions.* delegates to the server

When a screen calls `actions.addToCart({ productId, qty })`:

1. The runtime serializes the payload.
2. The server bridge POSTs to the action server:
   ```ts
   { kind: "runAction", input: { flowId, actionId: "addToCart", signedContext, payload } }
   ```
3. The action server validates the signed context (signature, expiry, `allowedActions` list).
4. If the action defines an `input` schema, the server validates the payload against it.
5. The handler runs with `{ ctx, input, services, session, sign }`.
6. The server returns an `ActionResult`.
7. The runtime applies any effects, handoff, or redirect from the result.

### Where actions.* comes from

The Mini App runtime inspects the flow's `actions` definition (for direct flow boot) or the union of per-screen `actions` arrays in the client manifest (for manifest boot). It constructs a frozen object where each key is an action ID and each value is a closure that sends the action to the server bridge.

This is why typed contracts work: the generator knows the action IDs from the flow definition, and the runtime builds the helper object from the same IDs at boot.

---

## Navigation

`nav.*` helpers are runtime-generated functions that change the Mini App screen client-side.

### How nav.* is built

The runtime reads the route map from the client manifest. For each screen ID, it finds the first route that maps to that ID and builds a helper:

- Static route (`/` -> `"catalog"`): `nav.catalog()` takes no params.
- Dynamic route (`/product/:id` -> `"product-detail"`): `nav.productDetail({ id })` requires the param.

When called, the helper:
1. Substitutes params into the route pattern.
2. Updates the browser URL.
3. Triggers the new screen's loader.
4. Renders the new screen.

### Why nav.* is generated

The generator knows the route patterns at build time. It can make `nav.productDetail({ id })` require exactly the params the route pattern needs. The runtime constructs the actual URL path at call time. Both sides agree on the route map because they both read from the same client manifest.

---

## Generated And Discovered Artifacts

Teleforge mixes generated metadata with convention-discovered modules. The boundary between them is important: generated files are overwritten, discovered files are authored.

| Thing | Created by | Lives where | Used by | Regenerate? |
|---|---|---|---|---|
| Flow definitions | App author | `apps/bot/src/flows/*.flow.ts` | Bot runtime, action server, manifest generator | No |
| Screen definitions | App author | `apps/web/src/screens/*.screen.tsx` | Mini App runtime | No |
| Loader definitions | App author | `apps/api/src/loaders/*.loader.ts` | Action server loader bridge | No |
| Client flow manifest | Generator | `apps/web/src/teleforge-generated/client-flow-manifest.ts` | Mini App runtime (browser-safe) | Yes, after flow/route changes |
| Type contracts | Generator | `apps/web/src/teleforge-generated/contracts.ts` | Screen authoring (type-only) | Yes, after flow/route/action changes |
| Override types | App author | `apps/web/src/teleforge-contract-overrides.ts` | Generator (type-only import) | No |
| Signed URL | `sign()` | Runtime value in bot handler | Telegram Mini App launch | Runtime |
| Signed context token | `sign()` / core signer | URL start parameter | Server validation on every request | Runtime |
| `actions.*` helpers | Mini App runtime | Screen props | Screen components calling server actions | Runtime |
| `nav.*` helpers | Mini App runtime | Screen props | Screen components navigating screens | Runtime |
| `loader` / `loaderData` | Mini App runtime + server bridge | Screen props | Screen rendering | Runtime |

### What should be regenerated after flow/action changes

Run this whenever you change flows, routes, or action definitions:

```bash
npx teleforge generate client-manifest
```

This regenerates:
- `client-flow-manifest.ts` (route maps, screen IDs, action lists)
- `contracts.ts` (typed nav, actions, loader data, screen props)

It never overwrites:
- `teleforge-contract-overrides.ts` (app-owned types)

Use `teleforge doctor` to detect when the manifest is stale.

---

## Debugging The Chain

### Screen does not open

1. Check `teleforge doctor` for manifest drift.
2. Confirm the screen ID in the flow's `miniApp.routes` matches the `defineScreen({ id })` export.
3. Confirm the screen is registered in `main.tsx` (`screens={[...]}`).
4. Check the browser console for route-match errors.

### Loader does not run

1. Confirm the loader file name matches the screen ID (`catalog.loader.ts` for screen `"catalog"`).
2. Check the server logs for loader errors.
3. Confirm the loader exports `defineLoader()` as default.
4. Verify the action server endpoint is reachable (`/api/teleforge/actions`).

### actions.addToCart is not a function

1. Confirm `"addToCart"` is in the flow's `actions` definition.
2. Confirm the action is listed in the manifest's per-screen `actions` array.
3. Regenerate the manifest: `npx teleforge generate client-manifest`.
4. Rebuild the web app so the new manifest is bundled.

### Manifest is stale

Symptoms: new routes appear in flows but not in the Mini App, or typed nav helpers are missing.

Fix:

```bash
npx teleforge generate client-manifest
pnpm --filter @my-app/web build
```

Then restart the dev server if needed.

---

## Read Next

- [Build Your First Feature](./first-feature.md): hands-on tutorial using this runtime chain
- [Flow Coordination](./flow-coordination.md): chat -> Mini App -> chat lifecycle details
- [Generated Mini App Contracts](./generated-miniapp-contracts.md): typed nav, actions, and loader data authoring
- [Config Reference](./config-reference.md): exact API shapes for `defineFlow()`, `defineLoader()`, `defineScreen()`
- [State Boundaries](./flow-state-design.md): storage model, session resources, and security properties
