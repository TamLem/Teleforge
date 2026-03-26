# Teleforge Getting Started

This guide is the shortest path from clone to a working Teleforge app.

If you want the broader framework model, read [Developer Guide](./developer-guide.md). If you want package boundaries and data flow, read [Architecture](./architecture.md).

## Goal

By the end of this guide you should have:

- a Teleforge app scaffolded or one of the repo examples running
- a local Mini App open in the browser with the Telegram mock bridge
- an optional live Telegram path through `/start`

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

### Option B: Full Reference App

Use this when you want to see the complete V1 flow:

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
node packages/create-teleforge-app/dist/cli.js my-app --mode spa
node packages/create-teleforge-app/dist/cli.js my-bff-app --mode bff
```

Use `spa` when the Mini App can talk to your existing backend directly.

Use `bff` when you want a Telegram-aware backend layer with route middleware, identity/session helpers, and service adapters.

You should see:

- a new project directory
- `apps/web`, `apps/bot`, and `apps/api`
- `teleforge.app.json`
- `.env.example`

## 3. Run Local Development

Teleforge's main local-dev commands are:

```bash
teleforge dev
teleforge dev:https
teleforge mock
teleforge doctor
```

Use them like this:

- `teleforge dev`: fast local browser development with Teleforge's Telegram mock overlay
- `teleforge dev:https`: HTTPS local development for Telegram-facing testing, using Cloudflare Tunnel by default when public reachability is needed
- `teleforge mock`: standalone Telegram environment simulation
- `teleforge doctor`: environment and manifest diagnostics

For first-time local work:

```bash
teleforge dev --open
```

You should see:

- Teleforge validate `teleforge.app.json`
- the app boot in a normal browser
- Telegram-like theme and viewport state injected by the mock bridge

## 4. Create a Telegram Bot

If you want to open the app in Telegram instead of only in the local browser:

1. Open BotFather in Telegram.
2. Create a bot and copy the token.
3. Put the token in your `.env` as `BOT_TOKEN`.
4. Set the app URL variables your example or app expects, such as `MINI_APP_URL`.

At minimum, the bot configuration in `teleforge.app.json` must line up with your environment:

- `bot.username`
- `bot.tokenEnv`
- `bot.webhook.path`
- `bot.webhook.secretEnv`

## 5. Open in Telegram

Use `teleforge dev:https` when you need a Telegram-openable URL:

```bash
teleforge dev:https
```

Then open the Mini App through your bot entry point.

`teleforge dev:https` prefers Cloudflare Tunnel as the default public tunnel provider. Install `cloudflared` locally for the smoothest path. If you need provider-specific behavior, you can still pass `--tunnel-provider localtunnel` or `--tunnel-provider ngrok`.

Typical flow:

1. Start the bot runtime.
2. Start `teleforge dev:https`.
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

The main packages are:

- `@teleforge/core`: manifest, validation, launch parsing, flow-state contracts
- `@teleforge/web`: Telegram hooks and Mini App coordination
- `@teleforge/ui`: Telegram-native React UI primitives
- `@teleforge/bot`: bot routing, `web_app_data`, webhook helpers
- `@teleforge/bff`: Telegram-aware backend routes, adapters, sessions
- `@teleforge/devtools`: local development and diagnostics

## Next Reading

- [Manifest Reference](./manifest-reference.md)
- [Troubleshooting](./troubleshooting.md)
- [Developer Guide](./developer-guide.md)
- [Architecture](./architecture.md)
- [Documentation Index](./README.md)
