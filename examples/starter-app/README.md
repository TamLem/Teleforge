# Teleforge Starter App

Minimal flow-first Teleforge example.

It includes:

- one `teleforge.config.ts` app definition
- one `/start` flow in `apps/bot/src/flows/start.flow.ts`
- one Mini App screen in `apps/web/src/screens/home.screen.tsx`
- one root `pnpm dev` script that runs the local simulator and companion bot runtime

## Quick Start

```bash
pnpm build
cd examples/starter-app
pnpm install
cp .env.example .env
pnpm dev
```

If `BOT_TOKEN` is still a placeholder, the bot runs in preview mode so you can inspect the flow wiring without Telegram credentials.

## What Runs

- `pnpm dev`: runs `teleforge dev --open`
- `pnpm run dev:public`: runs `teleforge dev --public --live`
- `pnpm run dev:bot`: runs the sample bot directly in polling mode when `BOT_TOKEN` is set
- `pnpm doctor`: runs `teleforge doctor`

The root `pnpm build` step is required once because the example consumes the local workspace packages directly.

## Project Layout

- `teleforge.config.ts`: app identity, bot settings, Mini App entry, and flow discovery
- `apps/bot/src/flows/start.flow.ts`: the `/start` flow and Mini App launch metadata
- `apps/bot/src/runtime.ts`: discovered bot runtime used by polling and the simulator
- `apps/web/src/flow-manifest.ts`: client-safe flow metadata used by the Mini App shell
- `apps/web/src/main.tsx`: Mini App shell entrypoint
- `apps/web/src/screens/home.screen.tsx`: registered screen implementation

## Walkthrough

1. `teleforge.config.ts` defines the app and points flow discovery at `apps/bot/src/flows`.
2. `apps/bot/src/flows/start.flow.ts` declares the `/start` bot command and maps the `home` step to the `home` screen.
3. `apps/web/src/flow-manifest.ts` exposes browser-safe flow metadata for screen resolution.
4. `apps/web/src/screens/home.screen.tsx` registers the screen with `defineScreen()`.
5. `apps/web/src/App.tsx` renders the visible Mini App UI with `teleforge/web` and `teleforge/ui`.
6. `apps/bot/src/runtime.ts` exports `createDevBotRuntime()`, which lets `teleforge dev` execute the same flow inside the local simulator chat.

The important model is: define flows and screens, then let Teleforge discover and wire the runtime.

## Telegram Setup

1. Create a bot with BotFather.
2. Put the bot token into `.env`.
3. Start `pnpm run dev:public`.
4. Send `/start` to the bot.

## What to Change First

- Edit `apps/web/src/App.tsx` to change the visible Mini App.
- Edit `apps/bot/src/flows/start.flow.ts` to change the first flow, command text, or Mini App route.
- Keep `apps/web/src/flow-manifest.ts` in sync with browser-safe route and screen metadata.
- Add more `.flow.ts` files under `apps/bot/src/flows` and `.screen.tsx` files under `apps/web/src/screens` as the product grows.

Then read [Build Your First Feature](../../docs/first-feature.md).

## Notes

- The local browser flow uses the Teleforge mock bridge, so theme controls work during local development without Telegram.
- `teleforge dev` can execute the local `/start` flow inside the simulator chat because the sample exports `createDevBotRuntime()` from `apps/bot/src/runtime.ts`.
- In real Telegram sessions, theme follows the Telegram client automatically.
- When `MINI_APP_URL` is unset, Teleforge injects the current local or public dev URL into the companion bot process automatically.
