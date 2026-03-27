# Teleforge Starter App

Minimal onboarding example for Teleforge. It keeps the surface area small:

- one Mini App page built with `@teleforgex/web` and `@teleforgex/ui`
- one `/start` bot command built with `@teleforgex/bot`
- one root `pnpm dev` script that runs the whole local stack

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

- `pnpm dev`: runs `teleforge dev --open` for the whole local stack, including the companion bot process
- `pnpm run dev:public`: runs `teleforge dev --public --live` for a Telegram-openable URL
- `pnpm run dev:bot`: runs the sample bot directly in polling mode when `BOT_TOKEN` is set, or preview mode otherwise
- `pnpm doctor`: runs `teleforge doctor`

The root `pnpm build` step is required once because the example consumes the local workspace packages directly.

## Telegram Setup

1. Create a bot with BotFather.
2. Put the bot token into `.env`.
3. Start `pnpm run dev:public`.
4. Send `/start` to the bot.

## Project Layout

- `teleforge.app.json`: Teleforge manifest used by `teleforge dev` and `teleforge doctor`
- `apps/web`: single-page Mini App
- `apps/bot`: minimal `/start` bot runtime, including `src/runtime.ts` for simulator chat execution

## Annotated Walkthrough

If the sample is already running and you want to understand what you are looking at, read these files in order:

1. [teleforge.app.json](./teleforge.app.json)
   This is the manifest. It declares the bot command metadata, Mini App entry point, and route metadata. In this sample:
   - `bot.commands[0].handler` is `commands/start`
   - `routes[0].component` is `App`

2. [apps/bot/src/commands/start.ts](./apps/bot/src/commands/start.ts)
   This is the real `/start` handler. It sends the `web_app` button that opens the Mini App.

3. [apps/bot/src/runtime.ts](./apps/bot/src/runtime.ts)
   This is where the bot runtime is assembled and the `/start` command is actually registered. The sample also exports `createDevBotRuntime()` here so the simulator can execute bot logic locally.

4. [apps/web/src/App.tsx](./apps/web/src/App.tsx)
   This is the Mini App itself. It reads Telegram state with `useTelegram()` and `useTheme()`, renders the UI shell, and wires the Main Button.

5. [apps/web/src/main.tsx](./apps/web/src/main.tsx)
   This is the normal web entry point that mounts the React app.

The important connection to understand is:

- the manifest documents the intended command and route structure
- the bot runtime imports and registers the command explicitly
- the web entry point imports and renders the app explicitly

So the manifest is the source of truth for app shape, but not a magic resolver.

## What to Change First

If you want your first customization:

- change [apps/web/src/App.tsx](./apps/web/src/App.tsx) to change the visible Mini App
- change [apps/bot/src/commands/start.ts](./apps/bot/src/commands/start.ts) to change the `/start` message or button label
- change [teleforge.app.json](./teleforge.app.json) when you add new commands, capabilities, or routes

Then read [Build Your First Feature](../../docs/first-feature.md).

## Notes

- The local browser flow uses the Teleforge mock bridge, so the theme toggle button works during local development without Telegram.
- `teleforge dev` can execute the local `/start` handler inside the simulator chat because the sample exports `createDevBotRuntime()` from `apps/bot/src/runtime.ts`.
- In real Telegram sessions, theme follows the Telegram client automatically.
- When `MINI_APP_URL` is unset, Teleforge injects the current local or public dev URL into the companion bot process automatically.
