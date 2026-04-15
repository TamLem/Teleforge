# @teleforgex/devtools

Local developer tooling for Teleforge.

## Installation

```bash
pnpm add -D @teleforgex/devtools
```

## Commands

```bash
teleforge dev
teleforge dev --open
teleforge dev --public --live
teleforge mock
teleforge doctor
```

`teleforge dev` is the primary local-development command. It now serves a local Telegram simulator shell with:

- a chat pane that executes the local bot runtime when `apps/bot/src/runtime.ts` exports `createDevBotRuntime()`
- an embedded frame running the real Mini App from `apps/web`
- callback-query button simulation for inline keyboard flows
- built-in fixtures for fast state resets such as fresh, dark-mobile, and resume-flow sessions
- replay controls for the last chat, callback, or `web_app_data` action
- a debug panel showing mode, active scenario, latest event, profile snapshot, and scenario storage path
- saved simulator scenarios under `~/.teleforge/scenarios`
- controls for Telegram-like user, launch, theme, viewport, and event state
- the companion `apps/bot` service when the workspace exposes a `dev` script

`--open` launches the simulator automatically.
The Mini App starts closed by default so the chat flow remains the primary entry path; use `/start`, a `web_app` button, or `Open App` to launch it. Pass `--autoload-app` when you want the iframe to boot immediately for UI-only iteration.

If a workspace does not expose `apps/bot/src/runtime.ts`, the simulator falls back to manifest-driven chat behavior for `/start`, `/help`, and transcript-level Mini App opens.

The simulator is meant to cover most day-to-day local work:

- apply a fixture when you want to jump to a known Telegram state quickly
- save a scenario when you want a repeatable local regression case
- use Replay Last to rerun the most recent command, callback, or `web_app_data` payload without retyping it

If the embedded Mini App responds with `500`, Teleforge now logs the upstream request path and a short error-body preview to the terminal with a `[teleforge:dev]` prefix. The simulator status panel also reports the failing HTTP status so iframe-only failures are easier to spot.

Use `teleforge dev --public --live` for Telegram-facing testing. If `cloudflared` is installed, Teleforge starts a quick tunnel against the resolved local HTTPS port and reuses the same companion-service behavior as `teleforge dev`. Use `--tunnel-provider localtunnel` or `--tunnel-provider ngrok` to force another provider. `teleforge dev:https` remains as a legacy alias for the same mode.

Current workflow notes:

- generated workspaces and repo examples are polling-first by default
- `teleforge dev` and `teleforge dev --public --live` are intended to be run from the workspace root as the single local-dev command
- `--webhook` should only be used when the primary web runtime actually serves `/api/webhook`
- `teleforge mock` remains available as a standalone profile/state server, but `teleforge dev` is now the main day-to-day simulator surface

## Remaining Simulator Items

The current simulator covers the main local loop, but a few areas are still intentionally incomplete:

- richer Telegram interaction coverage beyond commands, callbacks, and `web_app_data`
- deeper trace tooling for bot/runtime messages and app-level network activity
- app-specific named fixture packs beyond the built-in generic presets
- more polished replay tooling for multi-step scripted flows instead of only the last action

## Mock Profiles

`teleforge mock` stores saved profiles in `~/.teleforge/profiles/`.

Team-sharing workflow:

```bash
teleforge mock --export ./team-profile.json
teleforge mock --import ./team-profile.json
```

Profiles export as JSON with schema version metadata so teams can share stable mock environments.

## Doctor

```bash
teleforge doctor
teleforge doctor --verbose
teleforge doctor --json
teleforge doctor --fix
```

`teleforge doctor` checks environment setup, manifest consistency, HTTPS readiness, webhook reachability, and BotFather configuration readiness.
