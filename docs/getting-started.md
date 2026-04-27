# Teleforge Getting Started

This guide is the shortest path from clone to a working Teleforge app.

If you want the broader framework model, read [Developer Guide](./developer-guide.md). If you want package boundaries and data flow, read [Framework Model](./framework-model.md). If you are new to Telegram Mini Apps, read [Telegram Mini App Basics](./telegram-basics.md) first.

## Goal

By the end of this guide you should have:

- a Teleforge app scaffolded or one of the repo examples running
- a local Mini App open in the browser with the Telegram mock bridge
- an optional live Telegram path through `/start`

## Background: How Telegram Mini Apps Work

Teleforge apps always have two connected surfaces:

- a **bot chat**, where users send commands like `/start`
- a **Mini App web view**, where your React app runs inside Telegram

Telegram opens the Mini App inside its web view and passes launch context such as user identity and start parameters through the WebApp bridge. That launch payload is usually called `initData`. Teleforge wraps that bridge with hooks such as `useTelegram()` and `useLaunch()` so your app code can read the current user, platform, launch mode, and validation state without parsing raw Telegram fields by hand.

When a Mini App needs to send something back to the bot, the normal Telegram mechanism is `web_app_data`. Teleforge supports that directly, and it also supports richer coordinated flows where a chat action opens a Mini App, the Mini App persists progress, and the result returns to chat in a structured way. If those terms are new, read [Telegram Mini App Basics](./telegram-basics.md) before continuing.

## Prerequisites

You need:

- Node.js 18 or newer
- `pnpm`
- a Telegram account
- BotFather access if you want to test against live Telegram

Optional but useful:

- Telegram Desktop or Telegram Web for faster local iteration
- a mobile Telegram client to verify the final Mini App behavior on-device

## Fastest Path

If you want the shortest route to something working, use the starter example:

```bash
pnpm install
pnpm build
cd examples/starter-app
pnpm install
cp .env.example .env
pnpm dev
```

You should see:

- a local web dev server start
- a bot process start in preview mode if `BOT_TOKEN` is still unset
- a browser window or local URL showing the Starter App
- theme/user/platform cards rendered even outside Telegram

If that works, skip ahead to [Open in Telegram](#open-in-telegram).

## 1. Install and Build the Workspace

From the repository root:

```bash
pnpm install
pnpm build
```

This builds the local packages so the examples and scaffolded apps can consume them.

You should see:

- all framework packages build successfully
- no missing workspace-package errors

If this fails, start with [Troubleshooting](./troubleshooting.md).

## 2. Pick a Starting Point

You have three practical entry points in this repo.

### Option A: Minimal Example

Use this when you want the fastest working setup:

```bash
cd examples/starter-app
pnpm install
cp .env.example .env
pnpm dev
```

This gives you:

- one Mini App page
- one `/start` bot command
- local mock-friendly development

See [`examples/starter-app/README.md`](../examples/starter-app/README.md) for the example-specific details.
When it is running, use the README's walkthrough section to map the working app back to real files.

### Option B: Full Reference App

Use this when you want to see the complete flow-first reference app:

```bash
cd apps/task-shop
pnpm install
cp .env.example .env
pnpm dev
```

This shows:

- bot commands
- `web_app_data` handling
- launch-mode-aware checkout
- resumable flow state
- Mini App return-to-chat coordination

See [`apps/task-shop/README.md`](../apps/task-shop/README.md) for the sample details.

### Option C: Generate a New App

Build the local scaffold:

```bash
pnpm --filter create-teleforge-app build
```

Generate a project:

```bash
node packages/create-teleforge-app/dist/cli.js my-app
```

You should see:

- a new project directory
- `apps/web` and `apps/bot`
- `teleforge.config.ts`
- `.env.example`
- root scripts for `pnpm run dev`, `pnpm run dev:public`, and `pnpm run doctor`
- baseline bot and web smoke tests behind `pnpm test`
- `apps/bot/src/flows/start.flow.ts` as the first flow entry
- `apps/web/src/teleforge-generated/client-flow-manifest.ts` as the framework-generated client-safe Mini App flow metadata
- `apps/web/src/main.tsx` booting `TeleforgeMiniApp`
- `apps/web/src/screens/home.screen.tsx` as the first screen module

## 3. Run Local Development

Teleforge's main local-dev commands are:

```bash
teleforge dev
teleforge dev --public --live
teleforge mock
teleforge doctor
```

Use them like this:

- `teleforge dev`: local Telegram simulator with chat, embedded Mini App, Telegram-like state controls, and any companion `apps/bot` `dev` service
- `teleforge dev --public --live`: HTTPS local development for Telegram-facing testing, using Cloudflare Tunnel by default when public reachability is needed
- `teleforge mock`: standalone profile/state server for manual Telegram context testing
- `teleforge doctor`: environment and manifest diagnostics

For first-time local work:

```bash
teleforge dev --open
```

You should see:

- Teleforge load and validate `teleforge.config.ts`
- the simulator shell boot in a normal browser
- a chat pane and an idle Mini App panel
- real local bot command handling when `apps/bot/src/index.ts` is present and `apps/bot/src/runtime.ts` exports `createDevBotRuntime()`
- inline keyboard callback buttons routed back as local `callback_query` updates
- built-in fixtures for quick fresh-session, dark-mobile, and resume-flow setups
- a Replay Last action for rerunning the most recent chat, callback, or `web_app_data` step
- the companion bot dev process start when the workspace defines it
- Telegram-like theme, viewport, launch, and user state injected into the embedded app
- a debug panel showing the current mode, latest event, and profile snapshot
- flow, screen, and server-hook wiring summaries in the simulator diagnostics for discovered apps

If your workspace does not have `apps/bot/src/runtime.ts` exporting `createDevBotRuntime()`, the simulator still works, but chat falls back to default `/start` and `/help` behavior.

By default, the embedded Mini App stays closed until you send `/start`, click a `web_app` button, or press `Open App`. If you want the iframe to load immediately for UI work, run:

```bash
teleforge dev --open --autoload-app
```

For production-style local testing, run the bot with the same high-level bootstrap the framework provides:

```bash
teleforge start
```

This runs `teleforge start`, which discovers flows, resolves environment, and starts the bot automatically.

Recommended local loop:

1. Start `teleforge dev --open`.
2. Apply a built-in fixture to get close to the state you want.
3. Drive the flow from the chat pane.
4. Use Replay Last to repeat the most recent command, callback, or `web_app_data` payload while iterating.
5. Add bot, web, or integration tests once the behavior should become a durable regression check.

## 4. Create a Telegram Bot

If you want to open the app in Telegram instead of only in the local browser:

1. Open BotFather in Telegram.
2. Create a bot and copy the token.
3. Put the token in your `.env` as `BOT_TOKEN`.
4. Leave `MINI_APP_URL` blank unless you need to force a fixed override. During `teleforge dev`, Teleforge injects the resolved local or public URL into the companion bot automatically.

For default polling scaffolds and repo examples, the minimum bot configuration in `teleforge.config.ts` is:

- `bot.username`
- `bot.tokenEnv`
- `runtime.bot.delivery` (defaults to polling)

`bot.webhook.path` and `bot.webhook.secretEnv` configure webhook delivery. When `runtime.bot.delivery` is set to `"webhook"`, `teleforge start` mounts a Telegram webhook endpoint on the hooks server at the configured path. The current starter and Task Shop flows use polling by default, and the default generated scaffold omits webhook config entirely.

## 5. Open in Telegram

Use `teleforge dev --public --live` when you need a Telegram-openable URL:

```bash
teleforge dev --public --live
```

Then open the Mini App through your bot entry point.

`teleforge dev --public --live` prefers Cloudflare Tunnel as the default public tunnel provider. Install `cloudflared` locally for the smoothest path. If you need provider-specific behavior, pass `--tunnel-provider localtunnel` or `--tunnel-provider ngrok`. `teleforge dev:https` is also available.

Typical flow:

1. From the workspace root, start `pnpm run dev:public` or `teleforge dev --public --live`.
2. Wait for Teleforge to print the public URL and start the companion bot process.
3. Send `/start` to your bot in Telegram.
4. Tap the Mini App button or menu button.

You should see:

- Telegram open the Mini App instead of just the browser preview
- the same route load with Telegram-provided theme and user state
- native controls like Main Button or Back Button respond through the Telegram client

This can be tested from:

- Telegram Desktop
- Telegram Web
- mobile Telegram clients

If the Mini App does not open, go to [Troubleshooting](./troubleshooting.md).

### Webhook Note

Webhook mode is optional and more constrained than the polling flow:

- use it only when your deployed `teleforge start` server exposes the configured webhook path over public HTTPS
- the shipped starter and Task Shop examples do not use webhook mode
- generated webhook placeholders do not make webhook mode active by themselves

## 7. Understand the Generated Shape

The current generated path is intentionally framework-shaped:

- `teleforge.config.ts`: app identity, flow roots, Mini App defaults, and optional server-hook roots
- `apps/bot/src/flows/*.flow.ts`: user journeys, bot entry commands, and Mini App step metadata
- `apps/web/src/teleforge-generated/client-flow-manifest.ts`: framework-owned browser-safe flow metadata; `teleforge dev` refreshes it when stale and `teleforge doctor` reports drift
- `apps/web/src/screens/*.screen.tsx`: Mini App screens registered through `defineScreen()`
- `apps/web/src/main.tsx`: the framework-owned `TeleforgeMiniApp` shell with the default server bridge
- `apps/bot/src/index.ts`: a bootstrap that starts the bot and server bridge; the framework owns polling, preview mode, and signal handling
- `apps/api`: default server-hook and bridge surface for coordinated bot-owned Mini App state

That means you normally start by editing a flow and a screen, not by wiring separate bot/web/backend runtimes manually. The lower-level `createDiscoveredBotRuntime()` remains available as an escape hatch for advanced deployments.

## 6. Verify the First Run

After the first successful run, verify these checkpoints:

- the Mini App renders without runtime crashes
- `useTelegram()` reports a ready state in Telegram or safe defaults outside Telegram
- `/start` opens the expected Mini App
- `teleforge doctor` reports a healthy local setup

Run:

```bash
teleforge doctor
```

If you are working inside this repo, also run:

```bash
pnpm test
pnpm docs:build
```

## Core Surfaces to Learn Next

The public framework surface is the `teleforge` unified package. Most app code imports from these subpaths:

- `teleforge`: app config (`defineTeleforgeApp`), flow definitions (`defineFlow`), and discovered runtime bootstrapping
- `teleforge/web`: Mini App shell (`TeleforgeMiniApp`), screen registration (`defineScreen`), and launch coordination
- `teleforge/bot`: bot runtime types and command handlers for discovered flows
- `teleforge`: action server hooks (`createActionServerHooksHandler`) for trusted server-side action execution
- CLI commands such as `teleforge dev`, `teleforge doctor`, and `teleforge mock` from the unified package

## Next Reading

- [Telegram Mini App Basics](./telegram-basics.md)
- [Build Your First Feature](./first-feature.md)
- [Flow Coordination](./flow-coordination.md)
- [Testing](./testing.md)
- [Deployment](./deployment.md)
- [Environment Variables](./environment-variables.md)
- [Config Reference](./config-reference.md)
- [Troubleshooting](./troubleshooting.md)
- [Developer Guide](./developer-guide.md)
- [Framework Model](./framework-model.md)
- [Documentation Index](./README.md)
