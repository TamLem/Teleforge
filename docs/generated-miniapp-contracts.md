# Generated Mini App Contracts

Teleforge generates browser-safe TypeScript contracts from your flow definitions.
These contracts make `nav.*`, `actions.*`, `routeParams`, and `loaderData` compile-time safe
without importing server-only flow modules into the Mini App bundle.

## What Gets Generated

Running `teleforge generate client-manifest` produces three file layers:

### 1. `client-flow-manifest.ts`

Browser-safe runtime metadata extracted from flow definitions. The Mini App shell imports this
at boot to resolve routes and screen IDs without pulling in server handlers.

```ts
import { flowManifest } from "./teleforge-generated/client-flow-manifest.js";
```

Regenerate this whenever flows or routes change:

```bash
npx teleforge generate client-manifest
```

### 2. `contracts.ts`

Type-only authoring contracts derived from the manifest. This file is generated next to the
manifest and is safe to import from any screen component.

```ts
import type { CatalogScreenProps, GadgetshopNav } from "./teleforge-generated/contracts";
```

Per-flow exports include:

- screen ID unions (`GadgetshopScreenId`)
- action ID unions (`GadgetshopActionId`)
- action helper types (`GadgetshopActions`)
- route param maps (`GadgetshopRouteParams`)
- typed navigation helpers (`GadgetshopNav`)
- typed sign helpers (`GadgetshopSign`)
- per-screen prop aliases (`CatalogScreenProps`, `ProductDetailScreenProps`, ...)

### 3. `teleforge-contract-overrides.ts`

App-owned companion file for concrete payload and loader data types. The generator creates a
stub once if the file is missing, then never overwrites it.

```ts
export interface TeleforgeActionPayloadOverrides {
  gadgetshop: {
    addToCart: { productId: string; qty: number };
    removeFromCart: { productId: string };
    placeOrder: undefined;
  };
}

export interface TeleforgeLoaderDataOverrides {
  gadgetshop: {
    catalog: { products: Product[] };
    "product-detail": { product?: Product; notFound?: boolean };
    cart: { items: CartItem[]; subtotal: number; itemCount: number };
  };
}
```

Keep this file browser-safe:

- import only type-only exports from app packages (`@task-shop/types`)
- do not import server loaders, flow modules, or services
- do not import runtime schema libraries

The generated `contracts.ts` imports this file type-only and merges overrides into the
per-screen prop aliases. Omitted actions or screens fall back to `unknown`.

## Screen Authoring Model

Import generated per-screen props instead of the broad `TeleforgeScreenComponentProps`.

```tsx
import type { CatalogScreenProps } from "./teleforge-generated/contracts";

function CatalogScreen({ loader, loaderData, actions, nav, transitioning }: CatalogScreenProps) {
  if (loader.status === "loading") return <div>Loading...</div>;
  if (loader.status === "error") return <div>Failed</div>;

  const products = loaderData?.products ?? [];

  return (
    <div>
      {products.map((p) => (
        <div key={p.id}>
          <span>{p.name}</span>
          <button onClick={() => actions.addToCart({ productId: p.id, qty: 1 })}>
            Add
          </button>
          <button onClick={() => nav.productDetail({ id: p.id })}>
            Details
          </button>
        </div>
      ))}
    </div>
  );
}
```

Benefits over the broad base type:

- `nav.productDetail({ id })` requires the correct param; missing or wrong params fail at build time
- `actions.addToCart({ productId, qty })` validates the override payload shape
- `loaderData` is typed to the screen's loader data override, removing the need for local casts
- `loader.status === "ready"` narrows `loader.data` to the same typed shape
- unknown actions or nav helpers fail at build time

## Typed Navigation

Generated nav helpers require the same route params the runtime enforces.

```ts
// Static route — takes no params
nav.catalog();
nav.cart();

// Dynamic route — requires the exact param shape from the route pattern
nav.productDetail({ id: "iphone-15" });

// Wrong param name — fails at build time
// @ts-expect-error productDetail expects "id", not "productId"
nav.productDetail({ productId: "iphone-15" });

// Missing param — fails at build time
// @ts-expect-error productDetail requires { id: string }
nav.productDetail();

// Passing params to a static route — fails at build time
// @ts-expect-error catalog takes no params
nav.catalog({ id: "x" });
```

Helper names derive from screen IDs via `toHelperName()`:

- `"product-detail"` → `productDetail`
- `"order-item"` → `orderItem`

The first route per screen wins, matching runtime nav construction. Helper-name collisions
between screen IDs are hard errors at generation time.

## Typed Actions

Action helpers are typed from app-authored payload overrides. Omitted actions remain `unknown`.

```ts
// Valid — matches the override shape
actions.addToCart({ productId: "iphone-15", qty: 1 });

// Invalid — missing required field
// @ts-expect-error qty is required
actions.addToCart({ productId: "iphone-15" });

// Invalid — wrong type
// @ts-expect-error qty must be a number
actions.addToCart({ productId: "iphone-15", qty: "1" });

// Invalid — unknown action
// @ts-expect-error notAnAction does not exist
actions.notAnAction({});
```

For actions that take no payload, use `undefined` in the override:

```ts
export interface TeleforgeActionPayloadOverrides {
  gadgetshop: {
    placeOrder: undefined;
  };
}
```

This makes `actions.placeOrder()` callable with no argument, while `actions.placeOrder({})` fails.

## Typed Loader Data

Generated screen props override `loader` and `loaderData` together so the discriminated lifecycle
stays coherent.

```ts
if (loader.status === "ready") {
  // loader.data is narrowed to the screen's loader data type
  const products = loader.data.products;
}

// loaderData is the same type, available without checking status
const products = loaderData?.products ?? [];
```

Define loader data shapes in `teleforge-contract-overrides.ts`:

```ts
export interface TeleforgeLoaderDataOverrides {
  gadgetshop: {
    catalog: { products: Product[] };
    "product-detail": { product?: Product; notFound?: boolean };
    cart: { items: CartItem[]; subtotal: number; itemCount: number };
  };
}
```

Screens omitted from overrides keep `unknown` loader data, which is the safe fallback.

## Typed Sign Helpers

Bot and action handler code can use the same route contracts when creating signed Mini App URLs.

```ts
import { createTypedSignForActionContext } from "teleforge";
import type { GadgetshopSign } from "./teleforge-generated/contracts";

const typedSign = createTypedSignForActionContext({
  sign,
  routes: {
    "/": "catalog",
    "/product/:id": "product-detail",
    "/cart": "cart"
  }
}) as GadgetshopSign;

// Static route — no params needed
const catalogUrl = await typedSign.catalog({
  subject: {},
  allowedActions: ["addToCart"]
});

// Dynamic route — params required, matching the route pattern
const detailUrl = await typedSign.productDetail({
  params: { id: product.id },
  subject: { resource: { type: "product", id: product.id } },
  allowedActions: ["addToCart"]
});
```

The helper constructs the concrete route path (`/product/iphone-15`) and returns a signed URL
with the token attached. No manual URL pathname mutation is needed.

## Escape Hatches

The generated contracts are the DX layer. The runtime remains unchanged and broad types are
available when needed:

- `runAction(actionId, payload)` — low-level action escape hatch
- `navigate(screenIdOrRoute, options)` — low-level navigation escape hatch
- `TeleforgeScreenComponentProps` — base prop type for runtime wiring and generic components

Use the typed happy path (`nav.*`, `actions.*`, generated screen props) for normal screen code.
Use escape hatches for generic utilities, dynamic behavior, or advanced patterns.

## Regeneration Safety

- `client-flow-manifest.ts` and `contracts.ts` are overwritten on every regeneration
- `teleforge-contract-overrides.ts` is created once and never overwritten
- Keep overrides browser-safe: type-only imports, no server modules
