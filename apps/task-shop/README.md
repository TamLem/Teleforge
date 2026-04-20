# Task Shop

Reference Teleforge sample app that exercises the flow-first runtime with a simple task marketplace flow.

## What It Covers

- `teleforge/bot`: `/start` (Mini App entry), `/shop` (chat catalogue with deep-link buttons), and `web_app_data` order handling
- `teleforge/web`: browser-safe Mini App runtime, launch coordination, theme, and checkout mode protection
- `teleforge/ui`: Telegram-native cards, buttons, typography, and boundaries
- `teleforge/core/browser`: Ed25519 initData validation (browser-safe)
- `teleforge/server-hooks`: server-side flow hooks with trusted bridge enforcement

## Structure

- `apps/bot`: Telegram long-polling bot runtime and hooks server
- `apps/api`: HTTP hooks server for Mini App server bridge requests
- `apps/web`: Vite Mini App with browse, cart, checkout, and success routes
- `packages/types`: shared task and order types
- `teleforge.config.ts`: flow-first app configuration replacing the legacy manifest

## Setup

1. Build the framework packages once from the repo root:

```bash
pnpm build
```

2. Install the sample workspace dependencies:

```bash
cd apps/task-shop
pnpm install
cp .env.example .env
```

3. Start the whole local stack:

```bash
pnpm dev
```

`pnpm dev` now runs `teleforge dev --public --live`, which starts the Vite Mini App, a public tunnel, and the companion bot process together. The Task Shop sample bot uses polling, so webhook auto-configuration stays off by default.

If you only want local browser development without a tunnel, use:

```bash
pnpm run dev:local
```

In local simulator mode, `teleforge dev` also executes `/start`, `/tasks`, and `web_app_data` through `apps/bot/src/runtime.ts`, so most bot-and-Mini-App flow work can happen without Telegram.

If `BOT_TOKEN` is not configured, the bot stays in preview mode and logs simulated `/start`, `/tasks`, and order-handling output so the command wiring can still be inspected locally.

## Environment

- `BOT_TOKEN`: Telegram bot token for live polling
- `MINI_APP_URL`: optional override for the `/start` button URL. When omitted, Teleforge injects the current local or tunneled dev URL.
- `VITE_TELEGRAM_BOT_ID`: bot ID for Ed25519 initData verification in the client
- `VITE_TELEGRAM_PUBLIC_KEY`: Telegram environment public key for Ed25519 verification

Use Telegram's production Ed25519 public key by default unless you are testing against Telegram's test environment.
