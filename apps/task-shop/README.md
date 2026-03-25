# Task Shop

Reference Teleforge sample app that exercises the full V1 stack with a simple task marketplace flow.

## What It Covers

- `@teleforge/bot`: `/start`, `/tasks`, and `web_app_data` order handling
- `@teleforge/web`: launch data, theme, and checkout mode protection
- `@teleforge/ui`: Telegram-native cards, buttons, typography, and boundaries
- `@teleforge/core`: `publishToBot()` and Ed25519 initData validation

## Structure

- `apps/bot`: Telegram long-polling bot runtime
- `apps/web`: Vite Mini App with browse, cart, checkout, and success routes
- `packages/types`: shared task and order types
- `teleforge.app.json`: manifest for the sample workspace

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

3. Start the bot and Mini App:

```bash
pnpm dev
```

If `BOT_TOKEN` is not configured, the bot stays in preview mode and logs simulated `/start`, `/tasks`, and order-handling output so the command wiring can still be inspected locally.

## Environment

- `BOT_TOKEN`: Telegram bot token for live polling
- `MINI_APP_URL`: public Mini App URL used in the `/start` button
- `VITE_TELEGRAM_BOT_ID`: bot ID for Ed25519 initData verification in the client
- `VITE_TELEGRAM_PUBLIC_KEY`: Telegram environment public key for Ed25519 verification

Use Telegram's production Ed25519 public key by default unless you are testing against Telegram's test environment.
