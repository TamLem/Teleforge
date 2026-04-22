# Troubleshooting

This guide covers the current flow-first Teleforge runtime.

## Start Here

Run:

```bash
teleforge doctor
```

Useful variants:

```bash
teleforge doctor --verbose
teleforge doctor --json
teleforge doctor --fix
```

`teleforge doctor` checks:

- `teleforge.config.ts`
- required environment variables
- Mini App entry files
- discovered routes and screens
- local HTTPS setup
- dependency alignment around the unified `teleforge` package

## Config Fails To Load

Symptoms:

- `teleforge dev` fails immediately
- doctor reports an invalid app config
- routes or screens are missing from diagnostics

Checks:

- confirm `teleforge.config.ts` exists at the app root
- confirm `flows.root` points to the directory containing `.flow.ts` files
- confirm `miniApp.entry` points to the web entry file
- confirm screen files export `defineScreen()`
- confirm flows export `defineFlow()`

Fixes:

- run `teleforge doctor --fix` for safe `.env` and formatting fixes
- inspect the generated scaffold for the expected shape
- run the app from the workspace root that contains `teleforge.config.ts`

## Mini App Screen Does Not Resolve

Symptoms:

- the Mini App shell opens but shows a missing screen or blocked screen
- a Mini App step exists but no component renders
- simulator diagnostics show unresolved screen metadata

Checks:

- the flow step has `type: "miniapp"`
- the step has a `screen` id
- a matching `.screen.tsx` module exports `defineScreen({ id })`
- the screen root matches the configured Mini App conventions

Fixes:

- align `steps.<step>.screen` with the screen module id
- restart `teleforge dev` after adding new files if the watcher did not pick them up
- use Task Shop as the reference for multi-screen flows

## `initData` Validation Fails

Symptoms:

- user context is missing
- Ed25519 validation fails
- validation passes in one runtime but not another

Checks:

- browser code imports validation helpers from `teleforge/core/browser`
- server-only bot-token validation stays on the server
- real Telegram `initData` is being forwarded, not only `initDataUnsafe`
- `botId` and public key values match the Telegram app setup

Fixes:

- use Ed25519 validation for browser-safe validation paths
- keep bot-token HMAC validation in Node/server code
- verify the request is not using stale Telegram auth data

## `teleforge dev --public --live` Fails

Symptoms:

- tunnel URL is missing
- Telegram refuses to open the Mini App URL
- companion bot services do not receive the current public URL

Checks:

- run `teleforge doctor`
- confirm local ports are free
- confirm `.env` contains the expected bot token
- confirm `bot.webhook.path` is correct if webhook mode is being tested

Fixes:

- rerun `teleforge dev --public --live`
- switch tunnel providers if the default provider is unavailable
- confirm the URL sent to Telegram matches the latest tunnel URL

## Simulator Shows A Mini App 500

Symptoms:

- simulator chrome loads
- the embedded Mini App route fails
- terminal logs show upstream `5xx` responses

Checks:

- open the embedded app route directly
- inspect `[teleforge:dev]` logs
- inspect the underlying Vite output

Fixes:

- fix the upstream app error first
- reload after changing environment or config values
- restart the dev command after changing entry files

## Bot Command Does Not Run

Symptoms:

- simulator chat does not respond to a command
- a live Telegram bot ignores the command

Checks:

- the flow has `bot.command.command`
- `apps/bot/src/runtime.ts` exports the discovered bot runtime used by the scaffold
- `BOT_TOKEN` is present for live polling
- the companion bot process started in `teleforge dev`

Fixes:

- run `/start` first in the simulator to confirm the runtime is active
- inspect `teleforge dev` output for companion service startup
- run the bot package tests or the app's bot tests

## Known Test Caveat

The full devtools suite has a known flaky timeout in:

```text
dev logs upstream app 500 responses for simulator app requests
```

When validating unrelated work, run the focused devtools subset documented in the cleanup task and keep this timeout as a separate follow-up.
