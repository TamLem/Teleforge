# Deployment Guide

This guide covers the production shape for a Teleforge app built from one framework model: bot flows, Mini App screens, the server bridge, and custom server hooks.

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
BOT_TOKEN=123456:token teleforge start
```

This calls the framework-owned `startTeleforgeBot()` which:
- loads `teleforge.config.ts` and discovers flows
- resolves secrets from the environment
- starts polling automatically when `runtime.bot.delivery` is omitted or set to `"polling"`
- starts webhook delivery without polling when `runtime.bot.delivery` is `"webhook"`
- fails fast if required secrets are missing in live mode

When implementing custom polling, request both `message` and `callback_query` update types. Chat inline-keyboard actions produce `callback_query` updates; Mini App `sendData` handoffs arrive as `message` updates with `web_app_data`. Omitting `callback_query` from `allowed_updates` causes inline keyboard buttons to be silently ignored:

```ts
// ✅ Receive both message and callback_query updates
allowed_updates: ["callback_query", "message"]

// ❌ Only messages — inline keyboard callbacks are dropped
allowed_updates: ["message"]
```

For advanced use cases, the lower-level `createDiscoveredBotRuntime()` escape hatch is available.

Webhook delivery is supported by `teleforge start`. When `runtime.bot.delivery` is `"webhook"`:

- `teleforge start` mounts a Telegram webhook endpoint at `bot.webhook.path` on the hooks server
- set Telegram's webhook URL to your public HTTPS endpoint pointing to that path
- set the environment variable named in `bot.webhook.secretEnv` so the handler validates Telegram's secret header
- do not run polling for the same bot at the same time

Required environment variables for webhook mode: `BOT_TOKEN`, `TELEFORGE_FLOW_SECRET`, `MINI_APP_URL`, and the secret named in `bot.webhook.secretEnv`.

## Split Bot and API Processes

The recommended production topology is split processes with shared storage:

- `apps/bot`: owns Telegram delivery; use webhook mode for a single HTTP ingress in most hosted deployments
- `apps/api`: owns the Mini App server bridge at `/api/teleforge/flow-hooks` and any custom flow hooks
- `apps/web`: builds to static assets served by `apps/api` or a CDN
- Redis or another durable `StorageAdapter`: shared by bot and API so both read/write the same flow instances

Both processes create their own runtime context, but pass a storage manager backed by the same Redis instance:

```ts
import { RedisStorageAdapter, UserFlowStateManager } from "teleforge";
import { createTeleforgeRuntimeContext } from "teleforge";

const storage = new UserFlowStateManager(
  new RedisStorageAdapter({
    client: redis,
    defaultTTL: 900,
    namespace: "my-app"
  })
);

export const context = await createTeleforgeRuntimeContext({
  cwd: process.cwd(),
  storage
});
```

The storage adapter is intentionally small: `get`, `set`, `delete`, `touch`, and optional optimistic `compareAndSet`. Bot, Mini App, and API communication should go through runtime events and server-bridge requests, not direct process memory.

## Production Runtime Matrix

| Runtime need | Default path | Required config | Required environment |
| ------------ | ------------ | --------------- | -------------------- |
| Polling bot | `teleforge start` | `bot.username`, `bot.tokenEnv`; `runtime.bot.delivery` omitted or `"polling"` | `BOT_TOKEN`; `MINI_APP_URL` for live Mini App launches |
| Webhook bot | `teleforge start` | `runtime.bot.delivery: "webhook"` plus `bot.webhook.path` and `bot.webhook.secretEnv` | `BOT_TOKEN`, `MINI_APP_URL`, `TELEFORGE_FLOW_SECRET`, webhook secret env |
| Server hooks | `teleforge start` discovers hooks by convention | `flows.serverHooksRoot` if not using the default derived path | `TELEFORGE_FLOW_SECRET` for trusted flow payloads |
| Static Mini App hosting | Deploy `apps/web` build to HTTPS host | `miniApp.entry` and production launch URL or env override | `MINI_APP_URL` when the runtime should override checked-in URL |

## Server Hooks

The server bridge is the default runtime endpoint for coordinated Mini App state. Custom server hooks extend that endpoint with guard, loader, submit, and action work that cannot be trusted to the browser.

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
