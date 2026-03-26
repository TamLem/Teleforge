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
teleforge dev:https
teleforge mock
teleforge doctor
```

`teleforge dev` now injects the Telegram WebApp mock overlay by default for local browser testing, and `--open` launches the resolved dev URL automatically.

`teleforge dev:https` defaults to Cloudflare Tunnel for Telegram-facing testing. If `cloudflared` is installed, Teleforge will start a quick tunnel against the resolved local HTTPS port. Use `--tunnel-provider localtunnel` or `--tunnel-provider ngrok` to force another provider.

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
