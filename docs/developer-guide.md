# Teleforge Developer Guide

This guide is for developers building Telegram Mini Apps and bots with the current shipped Teleforge stack.

It focuses on the implemented workflow in this repository:

- scaffold a project
- start from the default Teleforge app shape
- run locally with Teleforge devtools
- build Mini App, bot, and action server features with the shipped packages
- validate and test before release

Use this guide as the hub. The step-by-step companions are:

- [Telegram Mini App Basics](./telegram-basics.md)
- [State Boundaries](./state-boundaries.md) — Trust model, state categories, session resources, and storage architecture
- [Mini App Architecture](./miniapp-architecture.md) — 18 frontend guidelines
- [Flow Coordination](./flow-coordination.md) — Chat → Mini App → Chat lifecycle
- [Framework Model](./framework-model.md) — flow-first authoring model and public imports
- [Config Reference](./config-reference.md) — `teleforge.config.ts` schema
- [Server Hooks and Backend Internals](./server-hooks.md)
- [Shared Phone Auth](./shared-phone-auth.md)
- [Testing](./testing.md)
- [Deployment](./deployment.md)
- [Environment Variables](./environment-variables.md)

If you need the high-level conceptual model, read [Framework Model](./framework-model.md).

## Who Teleforge Is For

Teleforge is aimed at TypeScript developers who want a Telegram-native stack without assembling separate bot, Mini App, validation, and local-dev tooling by hand.

The framework is most useful when you need some combination of:

- a Telegram Mini App with typed hooks and theme awareness
- a bot that handles commands and `web_app_data`
- secure `initData` validation
- route-level launch-mode and capability guards
- coordinated chat-to-Mini-App flows
- a default server bridge for coordinated chat-to-Mini-App state
- custom trusted server hooks in front of existing services when a flow needs server authority

## Scaffolded App Shape

The generator emits one default Teleforge app shape.

Generated apps use:

- `apps/web` with the Teleforge Mini App shell and screen modules
- `apps/bot` for flow definitions and bot runtime execution
- `apps/api` for the default Mini App server bridge and trusted server hooks
- `teleforge.config.ts` as the source-of-truth app definition

Use `--without-api` only when you intentionally want a client-only Mini App experiment without coordinated bot-owned state.

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

To generate the smallest client-only scaffold instead, run:

```bash
node packages/create-teleforge-app/dist/cli.js my-app --without-api
```

For the full reference flow, use [`apps/task-shop`](../apps/task-shop/README.md).

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

If your workspace has a companion `apps/bot` package with a `dev` script, Teleforge starts it alongside the Mini App so the local command covers more of the stack by default. When `apps/bot/src/runtime.ts` exports `createDevBotRuntime()` — a thin simulator bridge for `teleforge dev` — the simulator chat also executes that runtime directly for local `/start`, custom commands, `web_app_data`, and inline-keyboard `callback_query` flows.

The simulator-first workflow is:

- land in a chat-first shell with the Mini App closed by default
- use built-in fixtures to jump to known Telegram-like states quickly
- drive commands, callbacks, and `web_app_data` from the chat pane
- inspect the right-side debug panel for active sessions (flow id, screen id, route), discovered flows, simulator actions, and live profile state
- use Replay Last to rerun the latest command or callback while iterating on the UI or bot output

When you want the Mini App iframe to load immediately for fast frontend iteration, use:

```bash
teleforge dev --autoload-app
```

When the embedded Mini App itself fails, Teleforge treats that as a first-class dev signal:

- upstream app `5xx` responses are logged to the terminal with a `[teleforge:dev]` prefix
- the simulator status panel reports the failing HTTP status for the iframe route
- request-handler failures inside the simulator shell are also logged instead of only returning a bare `500`

Use `teleforge dev --public --live` when:

- you need HTTPS locally
- you need a public tunnel for Telegram
- you want Telegram-facing behavior instead of the mock bridge

Cloudflare Tunnel is the default tunnel provider for `teleforge dev --public --live`. Install `cloudflared` for the most stable Telegram-facing local workflow, or override the provider explicitly with `--tunnel-provider`. `teleforge dev:https` is also available.

Polling is the default bot delivery mode for the current scaffold and repo examples. Webhook mode is opt-in and should only be enabled when `runtime.bot.delivery` is `"webhook"` and the deployed `teleforge start` server exposes the configured webhook path over public HTTPS.

### Use the Mock Environment

For standalone Telegram context simulation or headless profile/state work:

```bash
teleforge mock
```

`teleforge mock` is useful for:

- switching launch modes
- testing theme changes
- simulating viewport and event changes
- saving and sharing Telegram-like profiles in `~/.teleforge/profiles/`

For most day-to-day local app development, prefer `teleforge dev`; it hosts the primary simulator surface.

To make the simulator run real bot logic instead of manifest fallbacks, expose this file in your app:

```ts
// apps/bot/src/runtime.ts
export function createDevBotRuntime(options) {
  return createMyBotRuntime(options);
}
```

Without that file, the simulator provides chat scaffolding at the manifest level.

Known simulator limitations:

- callback and `web_app_data` are covered, but broader Telegram interaction surfaces need additional simulation
- replay is single-action rather than full scenario-step playback
- fixture support is generic; app-specific fixture packs need to be added where useful
- deeper request/trace inspection is lighter than a full debugger

### Diagnose Environment Issues

```bash
teleforge doctor
teleforge doctor --verbose
teleforge doctor --json
```

Run `teleforge doctor` before assuming Telegram, HTTPS, or manifest issues are application bugs.

## Public Imports

Generated apps use one framework package.

Use these imports in app code:

- `teleforge` for `defineTeleforgeApp()`, `defineFlow()`, discovered runtimes, config loading, and flow-state helpers
- `teleforge/bot` for lower-level Telegram bot primitives when a custom bot runtime needs them
- `teleforge/web` for `TeleforgeMiniApp`, `defineScreen()`, Telegram hooks, and Mini App runtime helpers
- `teleforge/core/browser` for browser-safe launch and validation helpers
- `teleforge` for the action server handler (`createActionServerHooksHandler`)

Do not import internal implementation packages from app code. Those packages implement the framework inside this repository, but the public developer experience is the unified `teleforge` package.

## Common Implementation Patterns

### Telegram State in the Mini App

```tsx
import { useLaunch, useTelegram, useTheme } from "teleforge/web";

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
import { useMainButton } from "teleforge/web";

export function CheckoutAction({ disabled }: { disabled: boolean }) {
  useMainButton({
    enabled: !disabled,
    text: "Complete Order"
  });

  return null;
}
```

The `useMainButton` hook gives you full control over the Telegram Main Button state and click handlers from any React component.

#### Coordinated Main Button with `submit()`

When a screen needs to call `submit()` on Main Button press, use `useCoordinatedMainButton`. It manages progress state and wires the click handler:

```tsx
import { useCoordinatedMainButton } from "teleforge/web";

export default defineScreen({
  component({ state, submit }) {
    const isValid = !!(state.name && state.phone);

    useCoordinatedMainButton("Save Profile", async () => {
      await submit({ type: "sender_profile", name: state.name, phone: state.phone });
    }, { isVisible: isValid });

    return <form>...</form>;
  }
});
```

The `isVisible` option dynamically shows or hides the button based on form validity. Click handlers survive visibility changes — the framework preserves registered handlers across param updates.

### Theme-Aware UI

```tsx
import { useTheme } from "teleforge/web";

export function ThemedScreen() {
  const theme = useTheme();

  return (
    <main style={{ background: theme.bgColor, color: theme.textColor, minHeight: "100vh" }}>
      <section style={{ background: theme.secondaryBgColor, padding: "1rem", borderRadius: "1rem" }}>
        <h1 style={{ color: theme.textColor }}>Telegram-aware UI</h1>
        <p style={{ color: theme.hintColor }}>Use theme hooks directly for custom styling.</p>
      </section>
    </main>
  );
}
```

### Route and Capability Guards

Guard decisions are now handled by the Mini App runtime and server hook bridge rather than client-side guard components.

- `loadMiniAppScreenRuntime()` evaluates server-side guards through the configured `serverBridge` before rendering a screen
- Screen-level `guard` functions run on the client after server validation passes
- Launch mode and capability checks are part of the flow definition metadata, not imperative client hooks

Use the `renderBlocked` prop on `TeleforgeMiniApp` to provide a custom UI when a guard blocks access.

### Secure `initData` Validation

Use the validation path that matches your runtime:

- `validateInitDataBotToken()` for Node-only, bot-token-backed validation
- `validateInitDataEd25519()` for WebCrypto-compatible runtimes using `publicKey + botId`

Use `teleforge/core/browser` for browser-safe Ed25519 validation. Use bot-token-backed validation only in trusted Node runtimes.

### Bot to Mini App Data Flow

Bot-side:

```ts
runtime.router.onWebAppData(async (context) => {
  await context.answer(`Received: ${context.data}`);
});
```

Mini App-side:

- use the framework-owned `TeleforgeMiniApp` path when the result should progress the flow or return to chat
- use custom server hooks when the result needs trusted server execution beyond the default bridge
- use lower-level `teleforge/web` hooks only when you need direct control outside the default shell

### Custom Server Hooks

The action server is part of the default app path. Define action handlers in your flow when a screen action needs trusted execution such as:

- server-side guard before navigating to a screen
- private data loading
- server-side permission enforcement
- payment, order, or session creation
- calls to services with server-only credentials

The framework discovers actions from flow definitions and executes them through the action server with validated signed context. Keep action handlers scoped to the flow that owns them.

### Provider-Based Identity

Identity lookup policy should stay explicit in trusted server code. Resolve the Telegram-authenticated actor to your application user before issuing sessions or committing durable domain state.

### Shared Phone Number Auth

When your app needs a Telegram user to prove control of a phone number, use bot helpers plus trusted server hook code.

Bot side:

- use `requestPhoneAction()` when the phone request is part of a discovered Teleforge flow
- use the `onContact` flow handler when the phone request should continue into a Mini App with a signed action context
- request a self-shared contact with `createPhoneNumberRequestMarkup()`
- validate it with `extractSharedPhoneContact()`
- launch the Mini App with `createPhoneAuthLink()`

Mini App side:

- read `phoneAuthToken` from `useLaunch()`
- send it to trusted server code

Server side:

- verify the signed token
- resolve the app user by normalized phone number
- issue a session or commit identity state

This is the right pattern when phone number is the app's primary login key but Telegram still needs to anchor the trust chain.

## Flow Coordination

The framework path owns the chat/Mini App lifecycle directly.

That includes:

- discovered flow entry from bot commands
- Mini App screen resolution through `TeleforgeMiniApp`
- action-based screen navigation
- persisted Mini App state snapshots
- structured return-to-chat handoff through `web_app_data`
- action execution for trusted server-side work

Use the higher-level `defineFlow`, `defineScreen`, and `TeleforgeMiniApp` APIs as the default authoring surface. Lower-level coordination primitives are available from `teleforge/bot` and `teleforge/web` when custom routing is needed.

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
pnpm --filter teleforge test
pnpm --filter create-teleforge-app test
pnpm --dir apps/task-shop test
```

## Where to Go Next

- Read [Framework Model](./framework-model.md) for the framework layout and runtime boundaries.
- Read [`apps/task-shop/README.md`](../apps/task-shop/README.md) for the end-to-end reference implementation.
- Use the generated API reference in `dist/docs-site/api/index.html` once you know which package surface you need.
