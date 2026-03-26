# Deployment Guide

This guide covers the practical path from local Teleforge development to a production-ready setup.

## Production Requirements

Telegram-facing production deployments need:

- a public HTTPS URL for the Mini App
- a bot token in production environment variables
- either polling or webhook delivery for bot updates

## Build the App

For generated or example workspaces, build the app packages from the workspace root:

```bash
pnpm build
```

If you want to build individual surfaces, use the relevant app workspace:

- `pnpm --dir apps/web build`
- your chosen bot packaging/runtime process for `apps/bot`

## Host the Mini App

Telegram Mini Apps must be reachable over HTTPS in production.

That means:

- deploy `apps/web` to a real HTTPS host
- set the production Mini App URL accordingly

Common host choices depend on your web runtime:

- Vite SPA: static hosting or CDN-backed static hosting
- Next.js/BFF: Node hosting, edge hosting, or platform-managed Next hosting

## Configure the Bot

At minimum, production needs:

- `BOT_TOKEN`
- `MINI_APP_URL` if your bot runtime uses it directly for `web_app` buttons

If you use webhook delivery, also configure:

- `WEBHOOK_SECRET`

## Polling vs Webhook in Production

### Polling

Use polling when:

- you want the simplest deployment model
- you are comfortable running a long-lived bot worker

That means:

- run the bot process continuously
- do **not** leave a webhook set on the bot

### Webhook

Use webhook when:

- your production runtime already exposes HTTP endpoints
- you want Telegram to push updates into your app

That means:

- serve `/api/webhook` from your production runtime
- set the webhook URL to your deployed HTTPS origin plus that path
- keep the webhook secret aligned with `bot.webhook.secretEnv`

## BotFather and Menu Buttons

Production also usually involves BotFather configuration:

- bot commands
- optional menu button URL
- optional Mini App entry point UX

Teleforge helps with the app and bot code, but BotFather configuration is still a manual Telegram-side step.

## Deployment Checklist

Before launch, verify:

- `teleforge.app.json` matches the deployed app shape
- `miniApp.url` or your runtime config points to the real HTTPS origin
- bot token and webhook secret are set correctly
- polling and webhook are not fighting each other
- `teleforge doctor` is clean for the relevant environment assumptions

## Recommended Rollout Order

1. deploy the Mini App
2. confirm the HTTPS URL is stable
3. point the bot at the production Mini App URL
4. choose polling or webhook
5. validate `/start`, Mini App open, and any return-to-chat flows

## Read Next

- [Environment Variables](./environment-variables.md)
- [Flow Coordination](./flow-coordination.md)
- [Troubleshooting](./troubleshooting.md)
