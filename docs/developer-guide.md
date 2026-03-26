# Teleforge Developer Guide

This guide is for developers building Telegram Mini Apps and bots with the current Teleforge V1 stack.

It focuses on the implemented workflow in this repository:

- scaffold a project
- choose the right runtime mode
- run locally with Teleforge devtools
- build Mini App, bot, and BFF features with the shipped packages
- validate and test before release

## Who Teleforge Is For

Teleforge is aimed at TypeScript developers who want a Telegram-native stack without assembling separate bot, Mini App, validation, and local-dev tooling by hand.

The framework is most useful when you need some combination of:

- a Telegram Mini App with typed hooks and theme awareness
- a bot that handles commands and `web_app_data`
- secure `initData` validation
- route-level launch-mode and capability guards
- coordinated chat-to-Mini-App flows
- a Telegram-aware BFF layer in front of existing services

## Choose a Runtime Mode

Teleforge currently supports two app shapes from the scaffold generator.

### SPA Mode

Use `spa` mode when:

- your Mini App can talk directly to your existing APIs
- you do not need a dedicated BFF layer in the same workspace
- Vite is the simplest fit for your frontend

Generated SPA apps use:

- `apps/web` with Vite
- `apps/bot` for Telegram command handling
- `apps/api` as a placeholder surface when you need backend endpoints later
- `teleforge.app.json` as the source-of-truth manifest

### BFF Mode

Use `bff` mode when:

- you want a Telegram-aware server edge in front of downstream APIs
- you need session exchange, identity resolution, or service adapters
- you want request validation and launch metadata available server-side

Generated BFF apps use:

- `apps/web` with Next.js
- `apps/bot` for Telegram command handling
- `apps/api` for framework-aware backend routes
- `teleforge.app.json` as the source-of-truth manifest

## Create a Project

Build the local scaffold once:

```bash
pnpm --filter create-teleforge-app build
```

Generate a new app:

```bash
node packages/create-teleforge-app/dist/cli.js my-app --mode spa
node packages/create-teleforge-app/dist/cli.js my-bff-app --mode bff
```

The generated workspace includes:

- `apps/web`
- `apps/bot`
- `apps/api`
- `teleforge.app.json`
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

Teleforge is organized as layered packages with `@teleforge/core` at the center.

### `@teleforge/core`

Use core for:

- manifest schema and validation
- launch context parsing
- `initData` validation
- shared flow-state types
- coordination metadata and event primitives

Browser-safe consumers should prefer `@teleforge/core/browser` when they only need portable launch and validation utilities.

### `@teleforge/web`

Use web for React-side Telegram integration:

- `useTelegram()` for raw Telegram state and SDK access
- `useLaunch()` for launch mode, auth state, and capabilities
- `useTheme()` for Telegram theme values and CSS variables
- `useMainButton()` and `useBackButton()` for native controls
- route guards such as `useRouteGuard()` and `useManifestGuard()`
- coordination helpers such as `CoordinationProvider`, `FlowResumeProvider`, `returnToChat()`, and `resumeFlow()`

### `@teleforge/ui`

Use UI when you want Telegram-native React components on top of `@teleforge/web`, including:

- `AppShell`
- `MainButton`
- `LaunchModeBoundary`
- cards, text, lists, settings, and inputs

### `@teleforge/bot`

Use bot for Telegram update handling:

- `BotRouter`
- `createBotRuntime()`
- command registration
- `web_app_data` parsing and acknowledgment helpers
- webhook handlers and adapters

### `@teleforge/bff`

Use BFF for Telegram-aware backend routes:

- `defineBffRoute()`
- `createBffConfig()`
- `ConfiguredBffRouter`
- auth and launch-mode middleware
- service adapters
- request context creation
- session and identity helpers

### `@teleforge/devtools`

Use devtools for local iteration and diagnostics:

- `teleforge dev`
- `teleforge dev --public --live`
- `teleforge mock`
- `teleforge doctor`

## Common Implementation Patterns

### Telegram State in the Mini App

```tsx
import { useLaunch, useTelegram, useTheme } from "@teleforge/web";

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

### Main Button Coordination

```tsx
import { useMainButton } from "@teleforge/web";

export function CheckoutAction({ disabled }: { disabled: boolean }) {
  useMainButton({
    enabled: !disabled,
    text: "Complete Order"
  });

  return null;
}
```

For component-level rendering, `@teleforge/ui` also exposes a `MainButton` component built on top of the hook.

### Theme-Aware UI

```tsx
import { AppShell, TgCard, TgText } from "@teleforge/ui";
import { useTheme } from "@teleforge/web";

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
- use `useManifestGuard()` when route requirements already live in `teleforge.app.json`
- use `LaunchModeBoundary` from `@teleforge/ui` for view-level fallbacks

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

- use the coordination helpers from `@teleforge/web` when the result should go back to chat
- use the BFF or your own API when the result should stay in the app session

### BFF Route Definition

```ts
import { defineBffRoute } from "@teleforge/bff";

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

## Flow Coordination

Teleforge V1 includes chat/Mini App coordination primitives for flows that begin in chat, continue in a Mini App, and return to chat later.

Use these pieces together:

- `@teleforge/core` for route coordination metadata and flow-state contracts
- `@teleforge/web` for `CoordinationProvider`, `FlowResumeProvider`, `ResumeIndicator`, `returnToChat()`, and `resumeFlow()`
- `@teleforge/bot` for reply primitives and `web_app_data` handling

The full reference implementation lives in [`apps/task-shop`](../apps/task-shop/README.md).

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
pnpm --filter @teleforge/web test
pnpm --filter @teleforge/bff test
pnpm --filter @teleforge/bot test
pnpm --dir apps/task-shop test
```

## Where to Go Next

- Read [Architecture](./architecture.md) for the framework layout and runtime boundaries.
- Read [`examples/starter-app/README.md`](../examples/starter-app/README.md) for the smallest working example.
- Read [`apps/task-shop/README.md`](../apps/task-shop/README.md) for the end-to-end reference implementation.
- Use the [API reference](./api/index.html) once you know which package surface you need.
