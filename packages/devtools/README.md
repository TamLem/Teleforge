# @teleforge/devtools

Local developer tooling for Teleforge.

## Installation

```bash
npm install -D @teleforge/devtools
```

## Commands

```bash
teleforge dev
teleforge dev --open
teleforge dev --public --live
teleforge mock
teleforge doctor
```

`teleforge dev` is the primary local-development command. It injects the Telegram WebApp mock overlay by default for local browser testing, launches the companion `apps/bot` service when the workspace exposes a `dev` script, and `--open` launches the resolved dev URL automatically.

Use `teleforge dev --public --live` for Telegram-facing testing. If `cloudflared` is installed, Teleforge starts a quick tunnel against the resolved local HTTPS port and reuses the same companion-service behavior as `teleforge dev`. Use `--tunnel-provider localtunnel` or `--tunnel-provider ngrok` to force another provider. `teleforge dev:https` remains as a legacy alias for the same mode.

Current workflow notes:

- generated workspaces and repo examples are polling-first by default
- `teleforge dev` and `teleforge dev --public --live` are intended to be run from the workspace root as the single local-dev command
- `--webhook` should only be used when the primary web runtime actually serves `/api/webhook`

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
