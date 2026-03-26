# Environment Variables

This guide collects the environment variables mentioned across the Teleforge docs and examples.

## Common Variables

| Variable | Purpose | Typical Usage |
|---|---|---|
| `BOT_TOKEN` | Telegram bot token | live polling or webhook bot runtime |
| `MINI_APP_URL` | explicit Mini App URL override | bot-side `web_app` buttons when you do not want Teleforge to inject the current dev URL |
| `WEBHOOK_SECRET` | Telegram webhook secret | webhook mode only |
| `TELEFORGE_PUBLIC_URL` | explicit public URL for doctor/dev validation | deployment or doctor checks |
| `TELEFORGE_DEV_PORT` | preferred local dev port | devtools local setup |
| `TELEFORGE_DEV_HTTPS` | force HTTPS expectation in doctor/dev checks | local HTTPS checks |

## Client Validation Variables

These are used by the Task Shop sample for client-side Ed25519 validation:

| Variable | Purpose |
|---|---|
| `VITE_TELEGRAM_BOT_ID` | Telegram bot ID used in public-key validation |
| `VITE_TELEGRAM_PUBLIC_KEY` | Telegram environment public key |

## Scaffold Variables

The scaffold also includes:

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_USERNAME` | generated placeholder value for the bot username |

In current Teleforge V1, bot username should still be treated as manifest-owned configuration through `teleforge.app.json`. The scaffold variable is informational unless your app code chooses to consume it.

## Practical Guidance

- leave `MINI_APP_URL` blank during local `teleforge dev` unless you need a fixed override
- set `BOT_TOKEN` when you want real Telegram polling or webhook behavior
- set `WEBHOOK_SECRET` only when you are actually serving a webhook endpoint
- use `VITE_TELEGRAM_BOT_ID` and `VITE_TELEGRAM_PUBLIC_KEY` only if your web client performs public-key `initData` validation

## Example Setups

### Local Simulator

```env
BOT_TOKEN=
MINI_APP_URL=
```

### Local Telegram-Facing Testing

```env
BOT_TOKEN=123456:real-token
MINI_APP_URL=
```

### Webhook Deployment

```env
BOT_TOKEN=123456:real-token
WEBHOOK_SECRET=production-secret
MINI_APP_URL=https://your-app.example.com
```
