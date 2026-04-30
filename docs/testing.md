# Testing Teleforge Apps

Teleforge uses lightweight project-native testing, not a framework-specific abstraction layer.

Most generated and sample tests use:

- Node's built-in test runner
- `tsx` for TypeScript execution
- direct rendering or direct runtime invocation instead of deep framework-specific abstractions

## What to Test

For most apps, split tests into three layers:

### Bot Tests

Put these in `apps/bot/test`.

Test:

- command handlers
- callback handling
- `web_app_data` parsing and replies
- preview-mode behavior when `BOT_TOKEN` is absent

The generated scaffold already includes a `/start` test. Treat that as the baseline pattern.

### Web Tests

Put these in `apps/web/test`.

Test:

- route rendering
- hook-driven launch mode behavior
- guards and fallback views
- `TeleforgeMiniApp` screen resolution and step progression
- state transformations that do not require a real browser

The scaffold's page render test is the simplest example.

### Integration Tests

Use these when the value is in the flow, not just the unit.

In this repo, `apps/task-shop/tests/integration` is the best example:

- command -> Mini App -> return flow
- resume-state behavior
- `web_app_data` handling
- server-backed flow behavior where a step needs trusted execution

## Running Tests

Generated apps expose:

```bash
pnpm test
```

Repository-wide verification uses:

```bash
pnpm test
pnpm build
pnpm check
pnpm docs:build
```

## Type-Level Contract Testing

The generated `contracts.ts` should be verified at compile time. Add a type-test file
next to the generated contracts:

```ts
// apps/web/src/teleforge-generated/contracts.type-tests.ts
import type { CatalogScreenProps, GadgetshopNav } from "./contracts";

declare const nav: GadgetshopNav;
declare const catalogProps: CatalogScreenProps;

// Valid: static route helpers take no params
nav.catalog();
nav.cart();

// Valid: dynamic route helpers require exact params
nav.productDetail({ id: "iphone-15" });

// Invalid: missing required param — fails typecheck
// @ts-expect-error productDetail requires { id: string }
nav.productDetail();

// Invalid: wrong param name — fails typecheck
// @ts-expect-error productDetail expects "id", not "productId"
nav.productDetail({ productId: "iphone-15" });

// Valid: action with typed payload
void catalogProps.actions.addToCart({ productId: "iphone-15", qty: 1 });

// Invalid: missing payload field — fails typecheck
// @ts-expect-error qty is required
void catalogProps.actions.addToCart({ productId: "iphone-15" });

// Invalid: unknown action — fails typecheck
// @ts-expect-error notAnAction does not exist
void catalogProps.actions.notAnAction();
```

Type tests do not run at runtime. They are checked by `tsc --noEmit`. If a regression
makes a bad call compile, the `@ts-expect-error` directive becomes unused and the
typecheck fails.

## Framework Test Helpers

`teleforge/test` exports utilities for common framework testing:

```ts
import { validateDiscoveredWiring, createMockWebApp } from "teleforge/test";
```

### `validateDiscoveredWiring(cwd)`

Runs the same wiring validation that `teleforge doctor` uses against the current project directory. Asserts that every Mini App step resolves to a screen, every action transitions or has a handler, and no orphaned modules exist.

```ts
import { validateDiscoveredWiring } from "teleforge/test";
import test from "node:test";

await test("wiring is complete", async () => {
  const result = await validateDiscoveredWiring(process.cwd());
  console.log(`Validated ${result.flows} flows, ${result.steps} steps`);
});
```

### `createMockWebApp(overrides?)`

Returns a ready-to-use subset of `Telegram.WebApp` with an event registry, so unit tests that rely on `useTelegram()` or other Telegram hooks can run outside a real Telegram client.

```ts
import { createMockWebApp } from "teleforge/test";

const mock = createMockWebApp({
  platform: "android",
  colorScheme: "dark"
});

// Register a mock event listener
mock.onEvent("themeChanged", () => {
  console.log("theme changed");
});
```

## Local Development Checks

For most day-to-day work:

- use `teleforge dev`
- render screens directly in web tests
- test bot command handlers with Node tests
- add integration tests when a feature crosses chat and Mini App boundaries

This is the fastest way to validate Mini App route behavior, coordination entry points, and server-backed loader/action flows.

## Testing Against Real Telegram

Use `teleforge dev --public --live` when you need to validate:

- real Telegram launch context
- native WebApp behavior
- device-specific issues
- public HTTPS accessibility

That is validation, not your default test loop.

## Suggested Test Progression for New Features

When adding a feature:

1. add a bot or web smoke test next to the generated examples
2. validate the Mini App locally with `teleforge dev`
3. add an integration test if the feature crosses chat + Mini App boundaries
4. add a server-hook bridge test if the feature needs trusted guards/loaders/submits/actions
5. use live Telegram only for final behavior checks

## Good First Tests

If you are unsure what to write first, start with:

- bot: "command returns the expected text/button"
- web: "page renders the expected heading"
- coordination: "completion payload leads to the expected chat reply"

That keeps the test surface small while still proving the feature works.
