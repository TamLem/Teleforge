# Teleforge Starter App

Minimal onboarding example for Teleforge. It keeps the surface area small:

- one Mini App page built with `@teleforge/web` and `@teleforge/ui`
- one `/start` bot command built with `@teleforge/bot`
- one root `pnpm dev` script that runs the web surface and bot together

## Quick Start

```bash
pnpm build
cd examples/starter-app
pnpm install
cp .env.example .env
pnpm dev
```

If `BOT_TOKEN` is still a placeholder, the bot runs in preview mode and logs the `/start` response locally so you can inspect the command wiring without Telegram credentials.

## What Runs

- `pnpm dev:web`: runs `teleforge dev --no-https --open` for the Mini App
- `pnpm dev:bot`: runs the sample bot in polling mode when `BOT_TOKEN` is set, or preview mode otherwise
- `pnpm dev`: starts both together
- `pnpm doctor`: runs `teleforge doctor`

The root `pnpm build` step is required once because the example consumes the local workspace packages directly.

## Telegram Setup

1. Create a bot with BotFather.
2. Put the bot token into `.env`.
3. Set `MINI_APP_URL` to the public URL Telegram should open.
4. Send `/start` to the bot.

## Project Layout

- `teleforge.app.json`: Teleforge manifest used by `teleforge dev` and `teleforge doctor`
- `apps/web`: single-page Mini App
- `apps/bot`: minimal `/start` bot runtime

## Notes

- The local browser flow uses the Teleforge mock bridge, so the theme toggle button works during local development without Telegram.
- In real Telegram sessions, theme follows the Telegram client automatically.
