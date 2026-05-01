# Environment Variables

This guide collects the environment variables used by Teleforge apps and examples.

Teleforge configuration lives in `teleforge.config.ts`. Environment variables should hold deployment secrets and deployment-specific URLs, not replace the framework model.

## Common Variables

| Variable                | Purpose                                       | Typical Usage                                 |
| ----------------------- | --------------------------------------------- | --------------------------------------------- |
| `BOT_TOKEN`             | Telegram bot token                            | live polling, webhook handling, Bot API calls |
| `MINI_APP_URL`          | public Mini App URL override                  | production or public tunnel launch URLs       |
| `WEBHOOK_SECRET`        | Telegram webhook secret                       | webhook deployments                           |
| `TELEFORGE_PUBLIC_URL`  | explicit public URL for doctor/dev validation | local tunnels, staging, and deployment checks |
| `TELEFORGE_DEV_PORT`    | preferred local dev port                      | `teleforge dev` local runtime                 |
| `TELEFORGE_DEV_HTTPS`   | force HTTPS expectation in doctor/dev checks  | local HTTPS or tunnel validation              |
| `TELEFORGE_FLOW_SECRET` | flow context signing secret                   | trusted flow launch/session payloads          |
| `TELEFORGE_ENV`         | runtime environment fallback                  | `development`, `preview`, `staging`, `production` |

## Client Validation Variables

Only expose variables to browser code when they are explicitly safe to publish. Vite requires public client variables to use the `VITE_` prefix.

Task Shop uses these for client-side Ed25519 validation:

| Variable                   | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `VITE_TELEGRAM_BOT_ID`     | Telegram bot ID used in public-key validation |
| `VITE_TELEGRAM_PUBLIC_KEY` | Telegram environment public key               |

Do not expose `BOT_TOKEN` to the browser.

## Scaffold Variables

Generated apps may include:

| Variable                | Purpose                              |
| ----------------------- | ------------------------------------ |
| `TELEGRAM_BOT_USERNAME` | placeholder for local app copy or UX |

The authoritative bot configuration remains in `teleforge.config.ts`. Keep this variable only if your app code consumes it directly.

## Practical Guidance

- leave `MINI_APP_URL` blank during local development unless you need a fixed public URL
- set `BOT_TOKEN` only when using real Telegram polling or webhooks
- set `TELEFORGE_ENV=production` for deployed runtime environments
- having a bot token does not imply the runtime environment
- set `WEBHOOK_SECRET` only when `runtime.bot.delivery` is `"webhook"` and the deployed runtime serves the configured webhook endpoint
- use `VITE_TELEGRAM_BOT_ID` and `VITE_TELEGRAM_PUBLIC_KEY` only when browser code validates `initData`
- use server hooks for trusted work that needs secrets, identity resolution, or durable writes

## Example Setups

### Local Development

```env
BOT_TOKEN=
MINI_APP_URL=
TELEFORGE_ENV=development
```

### Local Telegram-Facing Testing

```env
BOT_TOKEN=123456:real-token
MINI_APP_URL=https://your-tunnel.example.com
TELEFORGE_ENV=development
```

### Webhook Deployment

```env
BOT_TOKEN=123456:real-token
WEBHOOK_SECRET=production-secret
MINI_APP_URL=https://your-app.example.com
TELEFORGE_FLOW_SECRET=long-random-secret
TELEFORGE_ENV=production
```
