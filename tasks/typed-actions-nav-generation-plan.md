# Typed Actions And Nav Generation Plan

## Status

In progress.

Phases 1, 2, 3, and 4 are implemented.

Completed:

- generated browser-safe `contracts.ts`
- typed screen ID and action ID unions
- typed `nav.*` helpers and route params
- per-screen prop aliases for GadgetShop screens
- action key safety through generated `actions.*`
- explicit app-authored action payload overrides through
  `teleforge-contract-overrides.ts`
- explicit app-authored loader data overrides removing screen casts

Next work:

- Phase 5: route-aware typed `sign()`

## Current Implementation Context For New Implementors

Read this section before changing code. This task has already gone through
review rounds, and the details below are intentional.

Current framework state:

- `packages/teleforge/src/screens.ts` exposes `TypedNavigationHelpers`,
  `TypedActionHelpers`, `TeleforgeNavigateOptions`, and
  `RuntimeCompatibleScreenProps`.
- `RuntimeCompatibleScreenProps` intentionally omits and replaces
  `screenId`, `routeParams`, `nav`, and `actions` so generated narrowed screen
  prop aliases can satisfy `defineScreen()` without inheriting broad string
  index signatures.
- `packages/devtools/src/utils/generate-contracts.ts` emits
  `contracts.ts` beside `client-flow-manifest.ts`.
- Generated screen prop aliases must use
  `Omit<TeleforgeScreenComponentProps, "screenId" | "routeParams" | "nav" |
  "actions"> & { ... }`. Do not change this back to an intersection with
  `TeleforgeScreenComponentProps`; that leaks broad `nav`, `actions`, and
  `routeParams` types back into screen components.
- The generator must match runtime nav construction: first route per screen
  wins, and helper-name collisions are hard errors.
- Generated action payload object keys must be emitted as quoted string-literal
  properties with `JSON.stringify(actionId)`. Action IDs are user-defined
  strings and may not be valid TypeScript identifiers.
- Generated action payload defaults are `unknown`, but apps can now provide
  concrete payload overrides through an app-owned
  `teleforge-contract-overrides.ts` file. The generator creates a stub once if
  missing and never overwrites author edits.
- Generated `contracts.ts` imports `TeleforgeActionPayloadOverrides` type-only,
  merges overrides per flow/action, and falls back to `unknown` for omitted
  actions.
- Generated `contracts.ts` imports `TeleforgeLoaderDataOverrides` type-only,
  types `loader` and `loaderData` per screen via `TypedLoaderState<TData>` and
  `LoaderDataFor<TFlowId, TScreenId>`, and falls back to `unknown` for omitted
  screens.

Current Task Shop state:

- Task Shop imports generated per-screen props from
  `apps/task-shop/apps/web/src/teleforge-generated/contracts.ts`.
- Task Shop owns
  `apps/task-shop/apps/web/src/teleforge-contract-overrides.ts`, which types:
  action payloads (`addToCart`, `removeFromCart`, `placeOrder`) and loader data
  shapes (`catalog`, `product-detail`, `cart`, `confirmation`, `tracking`).
- `apps/task-shop/apps/web/src/teleforge-generated/contracts.type-tests.ts`
  proves typed nav, typed route params, typed action keys, typed action
  payloads, typed loader data, and `defineScreen()` compatibility through the
  exact prop aliases screens consume.
- GadgetShop screens no longer use local `loaderData as ...` casts.

Important non-goals:

- Do not infer payload types from runtime schemas.
- Do not import server-only flow modules into browser-side generated contracts.
- Do not manually edit generated `contracts.ts` as the customization mechanism.
- Do not rely on redeclaring a generated type alias in another file. Type
  aliases do not merge, and generated prop aliases would keep pointing at the
  generated alias.
- Do not type action helpers from signed-context `allowedActions` yet. Current
  action helper typing is flow-level, matching runtime helper construction.

## Completed: Phase 3 Step 2

Explicit app-authored action payload overrides are implemented.

The feature lets app authors provide concrete payload types without editing
generated files and without making the browser import server code.

Implemented design:

1. App-owned companion type file:

```text
apps/task-shop/apps/web/src/teleforge-contract-overrides.ts
```

2. The file exports one interface keyed by flow id:

```ts
export interface TeleforgeActionPayloadOverrides {
  gadgetshop: {
    addToCart: { productId: string; qty: number };
    removeFromCart: { productId: string };
    placeOrder: undefined;
  };
}
```

3. The generator creates this file once if it does not exist, but it never
   overwrites author edits. The generated stub is:

```ts
export interface TeleforgeActionPayloadOverrides {}
```

4. Generated `contracts.ts` imports the override interface type-only:

```ts
import type { TeleforgeActionPayloadOverrides } from "../teleforge-contract-overrides";
```

5. Generated default payloads remain browser-safe and derived from the
   client manifest:

```ts
type GadgetshopDefaultActionPayloads = {
  "addToCart": unknown;
  "removeFromCart": unknown;
  "placeOrder": unknown;
};
```

6. Generated final payloads apply app overrides per action key and fall
   back to `unknown` for actions with no explicit override:

```ts
type FlowActionPayloadOverrides<TFlowId extends string> =
  TFlowId extends keyof TeleforgeActionPayloadOverrides
    ? TeleforgeActionPayloadOverrides[TFlowId] extends object
      ? TeleforgeActionPayloadOverrides[TFlowId]
      : {}
    : {};

type ApplyActionPayloadOverrides<
  TDefaults extends Record<string, unknown>,
  TOverrides extends object
> = {
  [TActionId in keyof TDefaults]: TActionId extends keyof TOverrides
    ? TOverrides[TActionId]
    : TDefaults[TActionId];
};

export type GadgetshopActionPayloads = ApplyActionPayloadOverrides<
  GadgetshopDefaultActionPayloads,
  FlowActionPayloadOverrides<"gadgetshop">
>;
```

7. Generated screen prop aliases use:

```ts
actions: GadgetshopActions;
```

where:

```ts
export type GadgetshopActions = TypedActionHelpers<GadgetshopActionPayloads>;
```

8. `runAction` stays broad. The typed happy path is `actions.*`; `runAction`
   remains the low-level escape hatch.

Implemented files:

```text
packages/devtools/src/utils/generate-contracts.ts
apps/task-shop/apps/web/src/teleforge-contract-overrides.ts
apps/task-shop/apps/web/src/teleforge-generated/contracts.ts
apps/task-shop/apps/web/src/teleforge-generated/contracts.type-tests.ts
apps/task-shop/apps/web/src/screens/cart.screen.tsx
```

Related build unblocker:

```text
packages/devtools/src/utils/doctor/checks.ts
```

Acceptance criteria met:

- Known action helpers still exist through generated screen props.
- Unknown action helpers still fail through generated screen props.
- `catalogProps.actions.addToCart({ productId: "iphone-15", qty: 1 })`
  compiles.
- `catalogProps.actions.addToCart({ productId: "iphone-15" })` fails because
  `qty` is missing.
- `catalogProps.actions.addToCart({ productId: "iphone-15", qty: "1" })`
  fails because `qty` must be a number.
- `catalogProps.actions.addToCart({ id: "iphone-15", qty: 1 })` fails because
  `productId` is required.
- `catalogProps.actions.removeFromCart({ productId: "iphone-15" })` compiles.
- `catalogProps.actions.removeFromCart({ id: "iphone-15" })` fails.
- `catalogProps.actions.placeOrder()` compiles.
- `catalogProps.actions.placeOrder({})` fails if the override uses
  `undefined`.
- An action that is present in the flow but omitted from overrides remains
  permissive with `unknown`.
- Generated files remain browser-safe and use type-only imports for override
  types.
- Regeneration does not overwrite the app-authored override file.

Compile-time evidence:

- `contracts.type-tests.ts` tests payload correctness through
  `CatalogScreenProps["actions"]` and `ProductDetailScreenProps["actions"]`.
- Existing tests remain for standalone nav, screen prop nav, route params, action
  key safety, and `defineScreen()` constraints.
- Invalid payload examples use `@ts-expect-error` so regressions fail
  type checking.

Verification reported by implementor:

```text
@task-shop/web tsc --noEmit: pass
@task-shop/web eslint: pass
@task-shop/web vite build: pass
teleforge tsup build including DTS: pass
@teleforgex/devtools tsup build: pass
regeneration preserves override file contents: confirmed
```

## Next Implementor Brief: Phase 4

Implement explicit loader data typing for generated screen props.

The goal is to remove local `loaderData as ...` casts from GadgetShop screens
without importing server-only loader modules into the browser bundle and without
attempting complex inference from loader implementations.

Recommended design:

1. Extend the app-owned override file with loader data overrides:

```ts
export interface TeleforgeLoaderDataOverrides {
  gadgetshop: {
    catalog: { products: ProductSummary[] };
    "product-detail": { product?: ProductDetail; notFound?: boolean };
    cart: { items: CartItem[]; subtotal: number; itemCount: number };
    confirmation: { order?: OrderSummary };
    tracking: { order?: OrderSummary };
  };
}
```

2. Keep business/domain display types app-owned and browser-safe. They can live
   in `teleforge-contract-overrides.ts` or be imported type-only from a
   browser-safe app types file. Do not import API services, loaders, flow
   modules, or server-only schemas.

3. Generated `contracts.ts` should import `TeleforgeLoaderDataOverrides`
   type-only and merge per-flow/per-screen overrides with `unknown` fallback.

4. Generated screen prop aliases should override `loader` and `loaderData`
   together so the discriminated lifecycle stays coherent:

```ts
type TypedLoaderState<TData> =
  | { status: "loading" }
  | { status: "ready"; data: TData }
  | { status: "error"; error: Error }
  | { status: "idle" };

type LoaderDataFor<TFlowId extends string, TScreenId extends string> = ...;
```

The generated prop alias should use:

```ts
loader: TypedLoaderState<LoaderDataFor<"gadgetshop", "catalog">>;
loaderData?: LoaderDataFor<"gadgetshop", "catalog">;
```

5. Keep the runtime `LoaderState` broad. The generated prop aliases are the DX
   layer; runtime behavior should not change.

Acceptance criteria:

- GadgetShop screens no longer need local `loaderData as ...` casts.
- `loader.status === "ready"` narrows `loader.data` to the screen's typed loader
  data.
- `loaderData` convenience prop is typed for each screen.
- Missing loader data overrides fall back to `unknown`.
- Generated contracts remain browser-safe and type-only.
- Existing typed nav and action tests continue to pass.

Required compile-time evidence:

- Add type tests that prove each screen prop alias has the expected loader data
  shape.
- Add `@ts-expect-error` cases for wrong loader fields, such as reading
  `product` from `CatalogScreenProps["loaderData"]`.
- Use at least one screen implementation change to prove casts were actually
  removed from app code.

## Concrete Task Definition

Implement a DX-focused generated contracts layer for Mini App screens.

The first implementation must produce a browser-safe generated file:

```text
apps/<app>/src/teleforge-generated/contracts.ts
```

For Task Shop this means:

```text
apps/task-shop/apps/web/src/teleforge-generated/contracts.ts
```

The generated contracts must improve screen authoring by typing:

- valid screen IDs
- valid action IDs
- route params per nav helper
- `nav.*` helper methods
- per-screen prop aliases for GadgetShop screens

The generated contracts must not attempt automatic schema/action payload
inference or loader return inference. Explicit app-owned payload overrides are
supported; loader data typing is a later phase.

## Problem

`actions.*` and `nav.*` are the intended happy-path screen API, but today they
are not strongly typed enough.

Current public types are broad:

```ts
export type ActionHelpers<TActionId extends string = string> = Readonly<
  Record<TActionId, (payload?: unknown) => Promise<ActionResult>>
>;

export type NavigationHelpers<TScreenId extends string = string> = Readonly<
  Record<TScreenId, (params?: Record<string, string>, options?: { data?: Record<string, unknown> }) => void>
>;
```

This improves ergonomics over raw strings, but TypeScript still cannot prove:

- `actions.addToCart` exists
- `actions.addToCart` receives `{ productId, qty }`
- `nav.productDetail` exists
- `nav.productDetail` requires `{ id }`
- `nav.catalog` takes no route params
- screen components only use helpers available in the current flow

The runtime validates helper names and route params, but the authoring
experience should catch these at build time.

## Goal

Make `actions.*` and `nav.*` compile-time safe while preserving the current
runtime behavior.

Target screen authoring:

```tsx
function ProductDetailScreen({ loader, loaderData, actions, nav }: ProductDetailScreenProps) {
  if (loader.status !== "ready") return null;

  return (
    <>
      <button onClick={() => actions.addToCart({ productId: loaderData.product.id, qty: 1 })}>
        Add
      </button>
      <button onClick={() => nav.cart()}>
        Cart
      </button>
    </>
  );
}
```

Expected type failures:

```ts
actions.addToCart({ id: "iphone-15" }); // wrong payload
actions.missingAction({});              // missing action
nav.productDetail();                    // missing route param
nav.productDetail({ productId: "x" });  // wrong route param
nav.missingScreen();                    // missing screen helper
```

## In-Scope For First Implementation

1. Add reusable type helpers to Teleforge public web/core surface:

```ts
export type TypedNavigationHelpers<TRoutes> = ...
```

Add `RuntimeCompatibleScreenProps` so generated aliases can narrow broad fields
without leaking base index signatures back into app code.

2. Add generation support that emits `contracts.ts` beside
   `client-flow-manifest.ts`.

3. Generate GadgetShop contracts from the existing flow manifest/routes:

```ts
export type GadgetShopScreenId =
  | "catalog"
  | "product-detail"
  | "cart"
  | "confirmation"
  | "tracking";

export type GadgetShopActionId =
  | "addToCart"
  | "removeFromCart"
  | "placeOrder";

export type GadgetShopActionPayloads = ...;
export type GadgetShopActions = TypedActionHelpers<GadgetShopActionPayloads>;

export type GadgetShopRouteParams = {
  catalog: undefined;
  productDetail: { id: string };
  cart: undefined;
  confirmation: undefined;
  tracking: undefined;
};

export type GadgetShopNav = TypedNavigationHelpers<GadgetShopRouteParams>;
```

4. Generate per-screen props:

```ts
export type CatalogScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions"
> & {
  screenId: "catalog";
  routeParams: Readonly<Record<never, never>>;
  nav: GadgetShopNav;
  actions: GadgetShopActions;
};

export type ProductDetailScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions"
> & {
  screenId: "product-detail";
  routeParams: { id: string };
  nav: GadgetShopNav;
  actions: GadgetShopActions;
};
```

Generate equivalents for:

- `CartScreenProps`
- `ConfirmationScreenProps`
- `TrackingScreenProps`

5. Migrate GadgetShop screens to import these generated prop aliases where they
currently use broad `TeleforgeScreenComponentProps`.

6. Add compile-time type checks or type-test fixtures proving bad nav calls fail:

```ts
nav.productDetail();                    // should fail
nav.productDetail({ productId: "x" });  // should fail
nav.notAScreen();                       // should fail
nav.cart();                             // should pass
nav.productDetail({ id: "iphone-15" }); // should pass
```

Do not rely only on runtime tests.

## DX-Driven First Generation Scope

Generation is not the goal. Better app-authoring DX is the goal.

The first implementation should generate only contracts that remove concrete
developer friction:

- mistyped `nav.*` helper names
- missing route params
- wrong route param names
- uncertainty about which screen IDs and action IDs exist
- broad screen props that require local casts or guessing

Generate only what can be derived safely from the client-safe flow/route
metadata. Do not block this phase on schema inference or TypeScript program
analysis.

Generate these in the first pass because each one directly improves DX:

- screen ID unions, so docs/examples and advanced APIs can reference valid IDs
- action ID unions, so generated contracts expose the flow's available commands
- route param types from `miniApp.routes`, so missing/wrong params fail in TS
- typed `nav.*` helpers, so route movement is discoverable and safe
- per-screen prop aliases with narrowed `screenId`, `routeParams`, and `nav`, so
  screens need fewer local casts
- helper-name collision checks, so ambiguous helpers fail before runtime
- a separate generated `contracts.ts` file beside the client manifest, so
  runtime metadata and authoring contracts stay together

Do not generate contracts just because the metadata exists. If a generated type
does not prevent a real mistake, remove boilerplate, or make the app API more
discoverable, leave it out.

## Proposed Type Model

### Action helpers

Current action helpers use this generic:

```ts
export type TypedActionHelpers<
  TActions extends Record<string, unknown>
> = Readonly<{
  [TActionId in keyof TActions & string]:
    undefined extends TActions[TActionId]
      ? (payload?: TActions[TActionId]) => Promise<ActionResult>
      : (payload: TActions[TActionId]) => Promise<ActionResult>;
}>;
```

Example generated action type after app-owned overrides are applied:

```ts
export type GadgetShopActionPayloads = {
  addToCart: { productId: string; qty: number };
  removeFromCart: { productId: string };
  placeOrder: undefined;
};

export type GadgetShopActions = TypedActionHelpers<GadgetShopActionPayloads>;
```

Keep the existing broad `ActionHelpers` as the runtime-compatible base type.
Screen-specific generated prop aliases override `actions` with the generated
flow action helper type.

### Navigation helpers

Generate helper names from screen IDs using the same `toHelperName()` algorithm
as runtime.

```ts
export type GadgetShopRouteParams = {
  catalog: undefined;
  productDetail: { id: string };
  cart: undefined;
  confirmation: undefined;
  tracking: undefined;
};

export type GadgetShopNav = TypedNavigationHelpers<GadgetShopRouteParams>;
```

Type helper:

```ts
export type TypedNavigationHelpers<
  TRoutes extends Record<string, Record<string, string> | undefined>
> = Readonly<{
  [THelper in keyof TRoutes & string]:
    TRoutes[THelper] extends undefined
      ? (params?: undefined, options?: NavigateOptions) => void
      : (params: TRoutes[THelper], options?: NavigateOptions) => void;
}>;
```

`NavigateOptions.data` remains client-only route handoff data and should stay
typed as `Record<string, unknown>` initially.

### Screen prop aliases

Generated screen aliases narrow `nav`, `routeParams`, `screenId`, and
`actions`:

```ts
export type ProductDetailScreenProps = Omit<
  TeleforgeScreenComponentProps,
  "screenId" | "routeParams" | "nav" | "actions"
> & {
  screenId: "product-detail";
  routeParams: { id: string };
  nav: GadgetShopNav;
  actions: GadgetShopActions;
};
```

Do not use `TeleforgeScreenComponentProps & { ... }` intersections for narrowed
fields. That leaks broad string index signatures from the base props back into
screen components.

## Source Of Truth

### Route params

Route params are derived from `flow.miniApp.routes`.

Example:

```ts
{
  "/": "catalog",
  "/product/:id": "product-detail",
  "/orders/:orderId/items/:itemId": "order-item"
}
```

Generates:

```ts
catalog: undefined;
productDetail: { id: string };
orderItem: { orderId: string; itemId: string };
```

The generator must use the same route-param extraction and helper-name rules as
runtime:

- `extractRequiredRouteParams(pattern)`
- `toHelperName(screenId)`
- helper collision detection

### Action payloads

Action payload typing is implemented through explicit app-authored overrides.
Schemas remain runtime values and are not inferred.

Current behavior:

1. Generate action IDs and helper names from flow definitions.
2. Generate default payloads as `unknown`.
3. Import app-authored `TeleforgeActionPayloadOverrides` type-only from
   `teleforge-contract-overrides.ts`.
4. Apply overrides per flow/action and fall back to `unknown` for omitted
   actions.

Do not infer payload types from schemas and do not import server-only flow
modules into generated browser contracts.

### Loader data

Loader data should follow a later staged approach:

1. Generate `unknown` loader data by default.
2. Support explicit exported loader data types when present.
3. Later infer from `defineLoader()` exports if practical.

## Generated Files

Keep the runtime manifest browser-safe:

```text
apps/web/src/teleforge-generated/client-flow-manifest.ts
```

Add a generated types file:

```text
apps/web/src/teleforge-generated/contracts.ts
```

Potential first-pass exports:

```ts
export type GadgetShopScreenId = ...;
export type GadgetShopActionId = ...;
export type GadgetShopActionPayloads = ...;
export type GadgetShopActions = ...;
export type GadgetShopRouteParams = ...;
export type GadgetShopNav = ...;
export type CatalogScreenProps = ...;
export type ProductDetailScreenProps = ...;
```

Keep generated contracts type-only where possible. They must not import
server-only flow modules into the browser bundle.

## Files Likely To Touch

Framework:

```text
packages/teleforge/src/screens.ts
packages/teleforge/src/flow-manifest.ts
packages/teleforge/src/index.ts
packages/teleforge/src/web.ts
packages/devtools/src/utils/manifest.ts
```

Task Shop:

```text
apps/task-shop/apps/web/src/teleforge-generated/contracts.ts
apps/task-shop/apps/web/src/screens/catalog.screen.tsx
apps/task-shop/apps/web/src/screens/product-detail.screen.tsx
apps/task-shop/apps/web/src/screens/cart.screen.tsx
apps/task-shop/apps/web/src/screens/confirmation.screen.tsx
apps/task-shop/apps/web/src/screens/tracking.screen.tsx
```

Tests/type checks:

```text
packages/teleforge/test or packages/teleforge/src test fixture
apps/task-shop/apps/web typecheck
```

Exact test location can follow existing repo conventions.

## Required Implementation Behavior

- Use the same helper naming as runtime `toHelperName(screenId)`.
- Use the same required param extraction as runtime
  `extractRequiredRouteParams(pattern)`.
- Fail generation on helper-name collisions.
- Static routes should generate helpers callable with no params.
- Dynamic routes should generate helpers requiring params.
- The generated file must be type-only/browser-safe and must not import server
  flow modules.
- The generated contracts must stay consistent with
  `client-flow-manifest.ts`.

## Implementation Phases

### Phase 1: Typed navigation contracts

Status: complete.

Implemented the DX-driven first generation scope: screen ID unions, action ID
unions, route-param maps, typed nav helpers, per-screen prop aliases, and helper
collision checks.

Why first:

- route params are statically derivable from route patterns
- no schema inference is needed
- this immediately catches a common class of app-author mistakes
- it reduces the amount of `Record<string, unknown>` casting in screens

Acceptance criteria:

- generated `contracts.ts` sits beside `client-flow-manifest.ts`
- generated `contracts.ts` does not import server-only flow modules
- generated screen/action ID unions match the manifest
- generated `contracts.ts` contains flow route param maps and nav helper types
- required params are enforced for dynamic routes
- static routes allow `nav.catalog()` with no params
- helper collisions fail generation
- GadgetShop screen prop aliases can type `nav`
- GadgetShop screen code gets simpler or safer; generation that does not improve
  app code should not be counted as success

### Phase 2: Screen prop aliases

Status: complete.

Generated per-screen prop aliases using typed nav and generated action helpers.

Acceptance criteria:

- GadgetShop screens can import `CatalogScreenProps`, `ProductDetailScreenProps`,
  `CartScreenProps`, `ConfirmationScreenProps`, and `TrackingScreenProps`
- `routeParams` are narrowed per screen
- `nav` is narrowed per flow
- `loaderData` is still broad and remains Phase 4 work

### Phase 3: Typed action payload contracts

Status: complete.

Added action helper payload typing through app-authored overrides.

Acceptance criteria:

- generated action helper keys match flow action IDs
- missing action helper access is a type error
- explicit payload maps can narrow action payloads
- GadgetShop action payloads are typed for `addToCart`, `removeFromCart`, and
  `placeOrder`

### Phase 4: Loader data typing

Status: complete.

Added explicit loader data type support through app-authored overrides.

Implementation summary:

1. Added `TypedLoaderState<TData>` to `packages/teleforge/src/screens.ts` — a
   discriminated loader lifecycle that narrows `data` to `TData` when
   `status === "ready"`.

2. Extended `generate-contracts.ts` to:
   - import `TeleforgeLoaderDataOverrides` type-only from the override file
   - emit `FlowLoaderDataOverrides<TFlowId>` and `LoaderDataFor<TFlowId, TScreenId>` helpers
   - override `loader` and `loaderData` in per-screen prop aliases

3. Extended `teleforge-contract-overrides.ts` with loader data shapes for all
   GadgetShop screens, importing display types from `@task-shop/types`.

4. Removed all `loaderData as ...` casts from GadgetShop screens.

5. Added type tests proving correct loader data shapes, `loader.data` narrowing
   on `status === "ready"`, and `@ts-expect-error` cases for wrong field access.

Acceptance criteria met:

- generated screen props use exported loader data types
- GadgetShop screens no longer use local `loaderData as ...` casts
- `loader.status === "ready"` narrows `loader.data` to the typed loader data
- `loaderData` convenience prop is typed per screen
- missing loader data overrides fall back to `unknown`
- generated contracts remain browser-safe and type-only

### Phase 5: Route-aware typed `sign()`

Status: next.

Use the same route param contracts for signing:

```ts
sign({
  screenId: "product-detail",
  params: { id: product.id },
  subject: { resource: { type: "product", id: product.id } },
  allowedActions: ["addToCart"]
});
```

Acceptance criteria:

- app code no longer mutates signed URL path manually
- missing params fail at compile time where typed helpers are used
- missing params also fail at runtime with a clear error
- cross-flow screen launches either resolve the owning flow or require explicit
  `flowId`

## Out Of Scope For First Implementation

- inferring action payloads from schemas
- inferring loader return types from loader implementations
- generating business/domain types
- typing `routeData`
- typing signed `subject`
- removing raw `runAction` or raw `navigate`
- changing runtime helper construction unless needed for type alignment
- generating business/domain abstractions such as carts, orders, products,
  services, or session resources

## Non-Goals

- Do not make the browser import server-only flow modules.
- Do not require a schema library.
- Do not block typed nav on typed action payload inference.
- Do not infer full loader result types through complex runtime execution.
- Do not remove raw `runAction` / `navigate` in this work; keep them low-level.
- Do not generate signed subject types unless the app explicitly declares them.
- Do not type `routeData` beyond `Record<string, unknown>` in the first pass.

## Required Verification From Implementor

Provide:

- generated `contracts.ts` contents or summary
- GadgetShop screen migration summary
- typecheck result showing valid screen usage passes
- type-test result showing invalid nav calls fail
- lint/build results

Do not mark complete if `contracts.ts` exists but GadgetShop screen code is not
simpler or safer.

Do not rely only on runtime tests. The primary value of this work is compile-time
feedback.
