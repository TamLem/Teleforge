# Local Development

Teleforge development is simulator-first. The default loop is to run the app through `teleforge dev`, use the chat simulator, open embedded Mini App screens, and inspect runtime state without needing a live Telegram session.

## New Apps

Create a project from this local repo:

```bash
pnpm --filter create-teleforge-app build
node packages/create-teleforge-app/dist/cli.js my-app --link /home/aj/hustle/tmf
cd my-app
pnpm install
pnpm run dev
```

The generated app depends on the unified `teleforge` package through a `link:` dependency:

```json
{
  "dependencies": {
    "teleforge": "link:/home/aj/hustle/tmf/packages/teleforge"
  }
}
```

## Existing Apps

For an existing app, depend on the unified package:

```json
{
  "dependencies": {
    "teleforge": "link:/home/aj/hustle/tmf/packages/teleforge"
  }
}
```

Then run:

```bash
pnpm install
pnpm run dev
```

## Daily Loop

Use one terminal for the app:

```bash
cd my-app
pnpm run dev
```

Use another terminal for framework work:

```bash
cd /home/aj/hustle/tmf
pnpm --filter teleforge test
pnpm docs:build
```

When package internals change, rebuild the affected package if the app is consuming built output. For simulator/runtime work, the safest verification is:

```bash
pnpm --filter teleforge test
cd packages/devtools
pnpm test
```

The devtools filter is a framework-repo maintenance command. App workspaces use the `teleforge` CLI from the unified package.

## Live Telegram Testing

Use live mode only after the simulator path is working:

```bash
teleforge dev --public --live
```

This starts the local runtime, opens an HTTPS tunnel, and injects the current public URL into companion bot services.

## Requirements

- Node.js 18 or newer
- pnpm
- a valid `teleforge.config.ts`
- `.env` values for live Telegram bot testing
