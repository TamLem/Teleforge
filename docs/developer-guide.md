# Teleforge Developer Guide

This guide is for developers building Telegram Mini Apps and bots with the current shipped Teleforge stack.

It focuses on the implemented workflow in this repository:

- scaffold a project
- start from the default Teleforge app shape
- run locally with Teleforge devtools
- build Mini App, bot, and optional server-hook features with the shipped packages
- validate and test before release

Use this guide as the hub. The new step-by-step companions are:

- [Telegram Mini App Basics](./telegram-basics.md)
- [Flow-First Developer Experience](./flow-first-dx.md)
- [Build Your First Feature](./first-feature.md)
- [Flow Coordination](./flow-coordination.md)
- [Server Hooks and BFF Internals](./bff-guide.md)
- [Shared Phone Auth](./shared-phone-auth.md)
- [Testing](./testing.md)
- [Deployment](./deployment.md)
- [Environment Variables](./environment-variables.md)

If you are looking for where Teleforge should evolve next rather than what V1 already ships, read [Flow-First Developer Experience](./flow-first-dx.md). That document is design direction, not current behavior.

## Who Teleforge Is For

Teleforge is aimed at TypeScript developers who want a Telegram-native stack without assembling separate bot, Mini App, validation, and local-dev tooling by hand.

The framework is most useful when you need some combination of:

- a Telegram Mini App with typed hooks and theme awareness
- a bot that handles commands and `web_app_data`
- secure `initData` validation
- route-level launch-mode and capability guards
- coordinated chat-to-Mini-App flows
- optional trusted server hooks in front of existing services when a flow needs server authority

## Scaffolded App Shape

The current generator now emits one default Teleforge app shape.

Generated apps use:

- `apps/web` with the Teleforge Mini App shell and screen modules
- `apps/bot` for flow definitions and bot runtime execution
- `apps/api` as an optional placeholder when flows later need trusted server hooks or a webhook surface
- `teleforge.config.ts` as the source-of-truth app definition

## Create a Project

Build the local scaffold once:

```bash
pnpm --filter create-teleforge-app build
```

Generate a new app:

```bash
node packages/create-teleforge-app/dist/cli.js my-app
```

The generated workspace includes:

- `apps/web`
- `apps/bot`
- `apps/api`
- `teleforge.config.ts`
- `.env.example`
- root scripts for Teleforge development, diagnostics, and baseline tests

If you want the smallest working example instead of a fresh scaffold, start with [`examples/starter-app`](../examples/starter-app/README.md). If you want the full reference flow, use [`apps/task-shop`](../apps/task-shop/README.md).

## Local Development Workflow

### Install and Build

From the repository root:

```bash
pnpm install
pnpm build
```

For generated or example workspaces:

```bash
pnpm install
cp .env.example .env
```

Generated workspaces expose a polling-first root workflow:

```bash
pnpm run dev
pnpm run dev:public
pnpm run doctor
```

- `pnpm run dev`: local browser development with the mock bridge plus the companion bot process
- `pnpm run dev:public`: public HTTPS tunnel for real Telegram sessions
- `pnpm run doctor`: manifest and environment diagnostics

### Run the Mini App Locally

Use Teleforge devtools for the web surface:

```bash
teleforge dev
teleforge dev --open
teleforge dev --public --live
```

Use `teleforge dev` when:

- you want fast local browser development
- you want the integrated Telegram simulator with chat plus the real Mini App
- you do not need a Telegram-pasteable HTTPS URL yet

If your workspace has a companion `apps/bot` package with a `dev` script, Teleforge starts it alongside the Mini App so the local command covers more of the stack by default. When `apps/bot/src/runtime.ts` exports `createDevBotRuntime()`, the simulator chat also executes that runtime directly for local `/start`, custom commands, `web_app_data`, and inline-keyboard `callback_query` flows. The same simulator can now save and reload full scenarios, including transcript and Telegram state, from `~/.teleforge/scenarios`.

The current simulator-first workflow is:

- land in a chat-first shell with the Mini App closed by default
- use built-in fixtures to jump to known Telegram-like states quickly
- drive commands, callbacks, and `web_app_data` from the chat pane
- inspect the right-side debug panel for active scenario, latest event, and live profile state
- save a scenario when a flow becomes worth keeping
- use Replay Last to rerun the latest command or callback while iterating on the UI or bot output

When you want the old UI-first behavior for fast frontend iteration, use:

```bash
teleforge dev --autoload-app
```

When the embedded Mini App itself fails, Teleforge now treats that as a first-class dev signal:

- upstream app `5xx` responses are logged to the terminal with a `[teleforge:dev]` prefix
- the simulator status panel reports the failing HTTP status for the iframe route
- request-handler failures inside the simulator shell are also logged instead of only returning a bare `500`

Use `teleforge dev --public --live` when:

- you need HTTPS locally
- you need a public tunnel for Telegram
- you want Telegram-facing behavior instead of the mock bridge

Cloudflare Tunnel is the default tunnel provider for `teleforge dev --public --live`. Install `cloudflared` for the most stable Telegram-facing local workflow, or override the provider explicitly with `--tunnel-provider`. `teleforge dev:https` remains available as a compatibility alias.

Polling is the default bot delivery mode for the current scaffold and repo examples. Webhook mode is opt-in and should only be enabled when the primary web runtime actually serves `/api/webhook`.

### Use the Mock Environment

For standalone Telegram context simulation or headless profile/state work:

```bash
teleforge mock
```

`teleforge mock` is useful for:

- switching launch modes
- testing theme changes
- simulating viewport and event changes
- saving and sharing profiles in `~/.teleforge/profiles/`

For most day-to-day local app development, prefer `teleforge dev`; it now hosts the primary simulator surface.

To make the simulator run real bot logic instead of manifest fallbacks, expose this file in your app:

```ts
// apps/bot/src/runtime.ts
export function createDevBotRuntime(options) {
  return createMyBotRuntime(options);
}
```

Without that file, the simulator still provides chat scaffolding, but only at the manifest level.

Current simulator gaps that still remain after the latest local-dev work:

- callback and `web_app_data` are covered, but broader Telegram interaction surfaces still need simulation
- replay is currently single-action rather than full scenario-step playback
- fixture support is generic today; app-specific fixture packs still need to be added where useful
- deeper request/trace inspection is still lighter than a full debugger

### Diagnose Environment Issues

```bash
teleforge doctor
teleforge doctor --verbose
teleforge doctor --json
```

Run `teleforge doctor` before assuming Telegram, HTTPS, or manifest issues are application bugs.

## Package Roles

The default app path is now the unified `teleforge` package plus `teleforge/web`.

Generated apps start from:

- `teleforge` for `defineTeleforgeApp()`, `defineFlow()`, discovered runtime helpers, and config loading
- `teleforge/web` for `TeleforgeMiniApp`, `defineScreen()`, and browser-safe Mini App execution helpers

The lower-level `@teleforgex/*` packages still exist and are useful when you need direct access to the underlying layers.

Teleforge is organized as layered packages with `@teleforgex/core` at the center.

### `@teleforgex/core`

Use core for:

- manifest schema and validation
- launch context parsing
- `initData` validation
- shared flow-state types
- coordination metadata and event primitives

Browser-safe consumers should prefer `@teleforgex/core/browser` when they only need portable launch and validation utilities.

### `@teleforgex/web`

Use web for React-side Telegram integration:

- `useTelegram()` for raw Telegram state and SDK access
- `useLaunch()` for launch mode, auth state, and capabilities
- `useTheme()` for Telegram theme values and CSS variables
- `useMainButton()` and `useBackButton()` for native controls
- route guards such as `useRouteGuard()` and `useManifestGuard()`
- lower-level launch, theme, guard, and Telegram capability hooks under the framework-owned shell

### `@teleforgex/ui`

Use UI when you want Telegram-native React components on top of `@teleforgex/web`, including:

- `AppShell`
- `MainButton`
- `LaunchModeBoundary`
- cards, text, lists, settings, and inputs

### `@teleforgex/bot`

Use bot for Telegram update handling:

- `BotRouter`
- `createBotRuntime()`
- command registration
- `web_app_data` parsing and acknowledgment helpers
- webhook handlers and adapters

### `@teleforgex/bff`

This is an advanced implementation package rather than the default public app shape.

Use it when you need direct access to the current Telegram-aware server-side implementation layer:

- `defineBffRoute()`
- `createBffConfig()`
- `ConfiguredBffRouter`
- auth and launch-mode middleware
- service adapters
- request context creation
- provider-based identity resolution
- session and phone-auth exchange helpers

For app authors, the preferred public framing is still:

- flows
- screens
- optional server hooks

### `@teleforgex/devtools`

Use devtools for local iteration and diagnostics:

- `teleforge dev`
- `teleforge dev --public --live`
- `teleforge mock`
- `teleforge doctor`

## Common Implementation Patterns

### Telegram State in the Mini App

```tsx
import { useLaunch, useTelegram, useTheme } from "@teleforgex/web";

export function Screen() {
  const telegram = useTelegram();
  const launch = useLaunch();
  const theme = useTheme();

  return (
    <div style={theme.cssVariables}>
      <h1>{telegram.user?.first_name ?? "Preview"}</h1>
      <p>Mode: {launch.mode}</p>
      <p>Platform: {telegram.platform}</p>
    </div>
  );
}
```

Use `useTelegram()` when you need direct SDK state. Use `useLaunch()` when you need interpreted capability and auth information.

`useLaunch()` also exposes `phoneAuthToken` when the Mini App was opened through Teleforge's shared phone-auth flow.

### Main Button Coordination

```tsx
import { useMainButton } from "@teleforgex/web";

export function CheckoutAction({ disabled }: { disabled: boolean }) {
  useMainButton({
    enabled: !disabled,
    text: "Complete Order"
  });

  return null;
}
```

For component-level rendering, `@teleforgex/ui` also exposes a `MainButton` component built on top of the hook.

### Theme-Aware UI

```tsx
import { AppShell, TgCard, TgText } from "@teleforgex/ui";
import { useTheme } from "@teleforgex/web";

export function ThemedScreen() {
  const theme = useTheme();

  return (
    <AppShell style={theme.cssVariables}>
      <TgCard>
        <TgText variant="headline">Telegram-aware UI</TgText>
      </TgCard>
    </AppShell>
  );
}
```

### Route Guards

When route access depends on launch mode or client capabilities:

- use `useRouteGuard()` for imperative checks
- use `useManifestGuard()` when route requirements already live in derived route config
- use `LaunchModeBoundary` from `@teleforgex/ui` for view-level fallbacks

This is the pattern Teleforge uses for flows like compact/fullscreen checkout protection.

### Secure `initData` Validation

Use the validation path that matches your runtime:

- `validateInitDataBotToken()` for Node-only, bot-token-backed validation
- `validateInitDataEd25519()` for WebCrypto-compatible runtimes using `publicKey + botId`

In Teleforge BFF:

- configure `publicKey + botId` for portable Ed25519 validation
- use `botToken` only in Node runtimes

### Bot to Mini App Data Flow

Bot-side:

```ts
runtime.router.onWebAppData(async (context) => {
  await context.answer(`Received: ${context.data}`);
});
```

Mini App-side:

- use the framework-owned `TeleforgeMiniApp` path when the result should progress the flow or return to chat
- use optional server hooks when the result needs trusted server execution
- use lower-level `@teleforgex/web` hooks only when you need direct control outside the default shell

### Optional Server Hooks

`apps/api` is optional until a flow step needs trusted server execution such as:

- authoritative guards
- authoritative loaders
- trusted submit handlers
- trusted action handlers
- webhook delivery

The current framework runtime can now discover flow-scoped server hooks by convention and execute them through a framework-owned bridge. Use the lower-level `@teleforgex/bff` package when you need its request context, identity, or session primitives directly.

### BFF Route Definition

```ts
import { defineBffRoute } from "@teleforgex/bff";

export const profileRoute = defineBffRoute({
  auth: "required",
  launchModes: ["compact", "fullscreen"],
  method: "GET",
  path: "/profile",
  service: {
    adapter: "account",
    operation: "getProfile"
  }
});
```

Use service routes when you are mapping to downstream APIs. Use handler routes when you need orchestration logic in-process.

### Provider-Based Identity

Teleforge BFF identity config is explicit and provider-based.

```ts
import {
  createBffConfig,
  telegramIdIdentityProvider,
  usernameIdentityProvider
} from "@teleforgex/bff";

const config = createBffConfig({
  botToken: process.env.BOT_TOKEN!,
  features: {
    sessions: false
  },
  identity: {
    adapter: identityAdapter,
    providers: [telegramIdIdentityProvider(), usernameIdentityProvider()]
  }
});
```

This keeps identity lookup policy visible in app code instead of hiding it behind implicit defaults.

### Shared Phone Number Auth

When your app needs a Telegram user to prove control of a phone number, use the bot and BFF helpers together.

Bot side:

- request a self-shared contact with `createPhoneNumberRequestMarkup()`
- validate it with `extractSharedPhoneContact()`
- launch the Mini App with `createPhoneAuthLink()`

Mini App side:

- read `phoneAuthToken` from `useLaunch()`
- send it to your BFF route

BFF side:

- use `createPhoneAuthExchangeHandler()` to verify the signed token
- resolve the app user by normalized phone number
- issue the same session envelope used by the standard exchange route

This is the right pattern when phone number is the app's primary login key but Telegram still needs to anchor the trust chain.

## Flow Coordination

The current framework path now owns more of the chat/Mini App lifecycle directly.

That includes:

- discovered flow entry from bot commands
- Mini App screen resolution through `TeleforgeMiniApp`
- Mini App step progression
- persisted Mini App state snapshots
- structured return-to-chat handoff through `web_app_data`
- optional server-hook execution for trusted flow steps

The lower-level coordination primitives still exist, but they are no longer the default first stop for new app code.

The full reference implementation lives in [`apps/task-shop`](../apps/task-shop/README.md).

If you want the annotated lifecycle instead of the short summary, read [Flow Coordination](./flow-coordination.md).

## Testing and Deployment

The short version:

- use simulator-first local testing for most feature work
- add bot and web smoke tests next to the scaffolded examples
- use integration tests when a feature crosses chat and Mini App boundaries
- move to real Telegram only for final behavior checks
- deploy the Mini App on HTTPS and choose polling or webhook explicitly for production

Read the dedicated guides for the practical details:

- [Testing](./testing.md)
- [Deployment](./deployment.md)
- [Environment Variables](./environment-variables.md)

## Verification Commands

From the repository root:

```bash
pnpm test
pnpm build
pnpm check
pnpm docs:build
```

Targeted package verification:

```bash
pnpm --filter @teleforgex/web test
pnpm --filter @teleforgex/bff test
pnpm --filter @teleforgex/bot test
pnpm --dir apps/task-shop test
```

## Where to Go Next

- Read [Architecture](./architecture.md) for the framework layout and runtime boundaries.
- Read [`examples/starter-app/README.md`](../examples/starter-app/README.md) for the smallest working example.
- Read [`apps/task-shop/README.md`](../apps/task-shop/README.md) for the end-to-end reference implementation.
- Use the generated API reference in `dist/docs-site/api/index.html` once you know which package surface you need.
