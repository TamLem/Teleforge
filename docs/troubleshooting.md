# Teleforge Troubleshooting

This guide covers common problems developers hit while working with the current Teleforge V1 stack.

It focuses on failures that are actually represented in the repo today. It does not assume hidden debug flags or unpublished tooling.

## Start Here

Before digging into package code, run:

```bash
teleforge doctor
```

Useful variants:

```bash
teleforge doctor --verbose
teleforge doctor --json
teleforge doctor --fix
```

`teleforge doctor` is the fastest way to catch:

- missing or invalid `teleforge.app.json`
- bot token and webhook secret wiring mistakes
- local certificate issues
- missing entry points or route problems
- package version mismatches in the workspace

## `initData` Validation Fails

Symptoms:

- BFF returns `INVALID_INIT_DATA`
- validation fails only in one runtime
- user context is missing even though Telegram opened the app

### Check the Validation Mode

Teleforge supports two validation paths:

- `validateInitDataBotToken()` for Node-only HMAC validation
- `validateInitDataEd25519()` for portable WebCrypto validation using `publicKey + botId`

If your BFF runs outside Node:

- do not rely on bot-token validation alone
- configure `publicKey + botId` for Ed25519 validation

Common failure codes:

- `INVALID_INIT_DATA`: signature or payload is invalid
- `MISSING_BOT_ID`: Ed25519 validation was selected without `botId`
- `RUNTIME_UNSUPPORTED_VALIDATION`: non-Node runtime tried to use bot-token validation

### Fixes

- make sure the app is passing real Telegram `initData`, not only `initDataUnsafe`
- use `botToken` validation only in Node runtimes
- use `publicKey + botId` when you need portable validation
- confirm the request is not using stale `auth_date` values

Related docs:

- [Developer Guide](./developer-guide.md)
- [Manifest Reference](./manifest-reference.md)

## `teleforge dev:https` or Local HTTPS Fails

Symptoms:

- local HTTPS server does not start
- tunnel URL is missing or unreachable
- Telegram refuses to open the Mini App URL

### Checks

1. Run `teleforge doctor`.
2. Confirm your manifest is valid.
3. Confirm local ports are free.
4. Check that your app entry point exists.
5. If you need Telegram-facing access, confirm you are using `teleforge dev:https`, not only `teleforge dev`.

### Fixes

- rerun `teleforge dev:https` to regenerate local certs if needed
- remove broken local cert files and rerun the command if certificate generation is corrupted
- make sure the public URL Telegram opens matches the current HTTPS/tunnel URL
- if the default Cloudflare quick tunnel cannot start, confirm `cloudflared` is installed or switch providers with `--tunnel-provider localtunnel` or `--tunnel-provider ngrok`
- if webhook flows are involved, verify `bot.webhook.path` and `bot.webhook.secretEnv`

If the issue is still unclear:

```bash
teleforge doctor --verbose
```

## Manifest Validation Errors

Symptoms:

- `teleforge dev` or `teleforge doctor` fails immediately
- errors mention `teleforge.app.json`
- routes or entry points are reported missing

### Common Causes

- `runtime.mode: "spa"` used with `webFramework: "nextjs"` or `custom`
- `runtime.mode: "bff"` used with `webFramework: "vite"`
- `miniApp.defaultMode` not included in `miniApp.launchModes`
- missing `bot.username`, `bot.tokenEnv`, or `miniApp.entryPoint`
- route paths not starting with `/`
- route list missing entirely

### Fixes

- compare your manifest against [Manifest Reference](./manifest-reference.md)
- run `teleforge doctor --fix` for safe formatting and `.env` bootstrap fixes
- confirm all referenced files actually exist on disk

## Route Guard or Launch Mode Mismatch

Symptoms:

- a route redirects unexpectedly
- the app works in browser preview but not in Telegram
- checkout or protected flows are blocked in some Telegram surfaces

### Why It Happens

Teleforge route access can depend on:

- `routes[].launchModes`
- `routes[].capabilities`
- `routes[].guards`
- the current launch context interpreted by `useLaunch()` or BFF middleware

### Checks

- confirm the route supports the current launch mode
- confirm the client capability you require actually exists in the current Telegram context
- compare direct browser preview vs Telegram Desktop/Web/Mobile behavior

### Fixes

- use launch modes that match the route's real requirement
- make sure `useManifestGuard()` is reading the route definition you expect
- for UI-only restrictions, confirm `LaunchModeBoundary` and route-level guards are not duplicating conflicting logic

If you need a compact/fullscreen-only route, verify the manifest and the runtime launch mode are aligned.

## Bot Token or Webhook Setup Problems

Symptoms:

- `/start` never reaches the bot
- webhooks reject requests
- `teleforge doctor` reports bot configuration failures

### Checks

- `BOT_TOKEN` is present in `.env`
- the env var name matches `bot.tokenEnv`
- `WEBHOOK_SECRET` is present if `bot.webhook.secretEnv` is configured
- `bot.username` matches the real BotFather username
- the Mini App URL or public URL is reachable from Telegram

### Fixes

- update `.env` to match the manifest instead of hardcoding token names elsewhere
- re-run bot setup after changing URLs
- use preview mode for local validation if live Telegram wiring is not ready yet

## App Does Not Open in Telegram

Symptoms:

- tapping the Mini App button does nothing
- Telegram opens a broken page
- the browser path works but Telegram fails

### Checklist

- is the URL HTTPS and publicly reachable?
- did you use `teleforge dev:https` rather than only `teleforge dev`?
- does the bot send the correct Mini App URL?
- does `MINI_APP_URL` match the URL you expect Telegram to open?
- is the bot command or button actually wired to the current app?

### Fixes

- restart the HTTPS dev server and copy the current public URL
- update environment variables that hold the public Mini App URL
- verify the bot runtime was restarted after env changes

## BFF Config or Session Problems

Symptoms:

- BFF route creation throws `CONFIG_INVALID`
- protected routes fail with `UNAUTHENTICATED`
- session exchange or refresh fails

### Common Causes

- missing `botToken` when creating BFF config
- sessions enabled without a session adapter or JWT secret
- bearer token missing on protected requests
- Telegram auth did not validate, so no session exchange can happen

### Fixes

- verify your `createBffConfig()` inputs before debugging route code
- make sure session routes are only mounted when the required session pieces are configured
- confirm access tokens are sent on protected route calls

## Mock vs Telegram Differences

Symptoms:

- the app works locally in browser preview but not in Telegram
- theme or viewport behavior differs between environments

### Why It Happens

`teleforge dev` injects a Telegram mock overlay for fast local work. That is useful, but it is not identical to live Telegram behavior.

### Fixes

- verify core flows once in a real Telegram client
- use `teleforge dev:https` for client-facing checks
- keep mock-only UI actions clearly separated from Telegram-native behavior

## When to Escalate From Docs to Code

Documentation and doctor checks are enough when:

- configuration values are missing or mismatched
- manifest structure is invalid
- runtime mode and framework selection are wrong

Read code or tests when:

- the manifest is valid but route behavior still surprises you
- Telegram-specific behavior differs by client
- a BFF/session flow fails even with correct configuration

Good code-level starting points:

- `packages/core/src/manifest/schema.ts`
- `packages/core/src/launch/validator.ts`
- `packages/web/src/guards/`
- `packages/bff/src/context/`
- `packages/devtools/src/utils/doctor/checks.ts`
