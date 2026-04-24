# create-teleforge-app

Greenfield Teleforge project generator for new apps and examples.

## Usage

```bash
pnpm install
pnpm run build
node dist/cli.js my-app
```

Pass `--yes` to skip prompts.
Pass `--with-api` when you want optional server-hook and webhook placeholder files.

## Supported Output

- `apps/web` with the Teleforge Mini App shell, first screen module, and Vite delivery runtime
- `apps/bot` starter runtime and `start` flow
- `teleforge.config.ts`
- `.env.example`
- root workspace scripts for `teleforge dev`, `teleforge dev --public --live`, and `teleforge doctor`

With `--with-api`, the scaffold also includes `apps/api` server-hook and webhook placeholders.

## Generated Workflow

The scaffold is polling-first by default:

- `pnpm run dev`: local simulator with chat, embedded Mini App, fixtures, replay controls, debug panel, and the companion bot process
- `pnpm run dev:public`: public HTTPS tunnel for real Telegram testing
- `pnpm test`: baseline bot and screen smoke tests
- `pnpm run doctor`: manifest and environment diagnostics

Generated apps also export `apps/bot/src/runtime.ts`, so `teleforge dev` can execute `/start`, `web_app_data`, and callback flows directly inside the simulator chat without Telegram.

The default scaffold does not include `apps/api` or `WEBHOOK_SECRET`. Generate with `--with-api` when the app needs trusted server hooks or a webhook placeholder. Those files do not make webhook mode active by themselves; webhook mode only makes sense once `runtime.bot.delivery` is `"webhook"` and the deployed `teleforge start` server exposes the configured webhook path over public HTTPS.

## Recommended Reading After Generation

Inside this repo, the best follow-on docs are:

- `docs/telegram-basics.md`
- `docs/first-feature.md`
- `docs/testing.md`
- `docs/deployment.md`

## Verification

```bash
pnpm test
```
