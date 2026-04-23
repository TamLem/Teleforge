# Deployment Guide

This guide covers the production shape for a Teleforge app built from one framework model: bot flows, Mini App screens, and optional server hooks.

## Production Requirements

Telegram-facing deployments need:

- a public HTTPS URL for the Mini App
- `BOT_TOKEN` in the bot runtime environment
- either a long-running bot worker or an HTTPS webhook endpoint
- `teleforge.config.ts` committed with the production app shape
- server-side storage for any flow state that must survive process restarts

## Build the App

From a generated workspace, build from the workspace root:

```bash
pnpm build
```

The Mini App is a normal frontend build. The bot runtime is a Node process that loads the same Teleforge config and discovered flows.

Typical surface commands are:

```bash
pnpm --dir apps/web build
pnpm --dir apps/bot build
```

Exact commands may vary by host, but the public framework contract stays the same: app authors import from `teleforge`, not from internal implementation packages.

## Host the Mini App

Telegram Mini Apps must be reachable over HTTPS in production.

Deploy the web app to a stable HTTPS origin, then configure the bot/runtime to launch that URL. Use `MINI_APP_URL` when you want an environment-specific override instead of a checked-in URL.

Recommended hosting properties:

- hashed static assets served with long cache headers
- fast HTML or shell response for the first Mini App open
- HTTPS certificate managed by the platform
- environment variables kept server-side except for explicit public `VITE_*` client values

## Run the Bot

The bot can receive updates by polling or webhook.

Use `teleforge start` for the simplest production deployment:

```bash
BOT_TOKEN=123456:token pnpm --dir apps/bot start
```

This calls the framework-owned `startTeleforgeBot()` which:
- loads `teleforge.config.ts` and discovers flows
- resolves secrets from the environment
- starts polling automatically when `BOT_TOKEN` is present
- fails fast if required secrets are missing in live mode

When implementing custom polling, request both `message` and `callback_query` update types. Chat inline-keyboard actions produce `callback_query` updates; Mini App `sendData` handoffs arrive as `message` updates with `web_app_data`. Omitting `callback_query` from `allowed_updates` causes inline keyboard buttons to be silently ignored:

```ts
// ✅ Receive both message and callback_query updates
allowed_updates: ["callback_query", "message"]

// ❌ Only messages — inline keyboard callbacks are dropped
allowed_updates: ["message"]
```

For advanced use cases, the lower-level `createDiscoveredBotRuntime()` escape hatch is available.

Webhook delivery is configurable in `teleforge.config.ts`, but `teleforge start` does not yet implement live webhook bootstrap. Use the lower-level escape hatch if you need webhook delivery today. When webhook mode is fully supported:

- serve the configured webhook path from your bot/server runtime

- serve the configured webhook path from your bot/server runtime
- set Telegram's webhook URL to that public HTTPS endpoint
- set `WEBHOOK_SECRET` when your runtime validates Telegram's secret header
- do not run polling for the same bot at the same time

## Server Hooks

Server hooks are optional trusted runtime endpoints used by flow screens for guard, loader, submit, and action work that cannot be trusted to the browser.

Deploy them with the runtime that owns your backend entrypoint. Treat them as Teleforge runtime endpoints, not as a separate app product that users have to assemble.

Production server hooks should validate:

- Telegram launch/auth context
- flow instance ownership
- current step validity
- submitted payload schemas
- domain permissions before durable writes

## BotFather Setup

BotFather remains the Telegram-side control plane. Use it to:

- create the bot and obtain `BOT_TOKEN`
- configure bot commands
- optionally configure menu buttons or Mini App entry points
- update production descriptions and images

Teleforge owns the app runtime. BotFather owns Telegram account configuration.

## Deployment Checklist

Before launch, verify:

- `teleforge.config.ts` points at the deployed app shape
- `MINI_APP_URL` or runtime config resolves to the production HTTPS Mini App
- `BOT_TOKEN` is set only in server environments
- polling and webhook are not both active for the same bot
- server hooks use trusted runtime validation for durable state changes
- `teleforge doctor` is clean for the target environment
- `/start`, Mini App open, submit/action transitions, and any return-to-chat steps work against production URLs

## Read Next

- [Environment Variables](./environment-variables.md)
- [Flow Coordination](./flow-coordination.md)
- [Troubleshooting](./troubleshooting.md)
