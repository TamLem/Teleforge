# Teleforge V1 Integration Audit

## Purpose

Validate the Task Shop sample app and the underlying Teleforge V1 framework in two modes:

- `mock`: default CI-safe mode with no Telegram credentials
- `live`: credentialed mode against a real bot + public Mini App URL

## Prerequisites

- [ ] Repo root packages built with `pnpm build`
- [ ] Sample workspace installed with `cd apps/task-shop && pnpm install`
- [ ] `apps/task-shop/.env` populated for local sample runtime

### Live Mode Inputs

- [ ] `TEST_BOT_TOKEN`
- [ ] `TEST_MINI_APP_URL`
- [ ] `TEST_BOT_ID`
- [ ] `TEST_PUBLIC_KEY`

## Mock Audit Checklist

1. Run `pnpm --dir apps/task-shop test:integration`
2. Confirm `/start` emits a Mini App button payload
3. Confirm `/tasks` lists all six sample tasks
4. Confirm unknown commands return a safe error message
5. Confirm `order_completed` payloads produce summary + acknowledgment replies
6. Confirm cart state can be serialized and restored
7. Confirm checkout is blocked for `inline` and allowed for `compact` / `fullscreen`
8. Confirm Ed25519 validation accepts valid data and rejects tampered / expired data

## Live Audit Checklist

1. Set `BOT_TOKEN` and `MINI_APP_URL` in `apps/task-shop/.env`
2. Set `TEST_*` integration variables for the live audit run
3. Start the sample with `pnpm --dir apps/task-shop dev`
4. Send `/start` to the bot and confirm the Mini App button opens the Task Shop
5. Send `/tasks` and confirm the formatted catalogue
6. Launch the Mini App from Telegram and confirm:
   - theme-aware colors match Telegram light/dark mode
   - cart operations persist between refreshes
   - checkout is blocked in inline mode and allowed after expansion
7. Complete a purchase and confirm:
   - `publishToBot()` sends the payload
   - the bot replies with order summary + confirmation
8. Capture a real `initData` payload and verify:
   - HMAC validation with bot token on the server path
   - Ed25519 validation with public key + bot ID on the client path

## Failure Drills

1. Tamper one character in `initData` and confirm Ed25519 validation fails
2. Use an expired `auth_date` and confirm the payload is rejected
3. Swap in the wrong public key and confirm validation fails
4. Remove `BOT_TOKEN` and confirm the bot falls back to preview mode locally

## Notes

- `@teleforge/core/browser` exists specifically to keep browser bundles free of Node-only manifest and HMAC code.
- The integration suite is mock-first by design so it can run in CI without secret material.
