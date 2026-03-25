# @teleforge/devtools

Local developer tooling for Teleforge.

## Commands

```bash
teleforge dev
teleforge dev:https
teleforge mock
teleforge doctor
```

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
