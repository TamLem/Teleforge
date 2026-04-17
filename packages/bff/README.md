# `@teleforgex/bff`

Typed BFF route definitions, registry helpers, and middleware primitives for Teleforge.

## Route Definition

```ts
import { createBffConfig, defineBffRoute, executeBffRoute } from "@teleforgex/bff";

const profileRoute = defineBffRoute({
  auth: "required",
  launchModes: ["compact", "fullscreen"],
  method: "GET",
  path: "/profile",
  service: {
    adapter: "account",
    operation: "getProfile"
  }
});
```

Routes can be service-backed or handler-backed. The execution pipeline composes Telegram-aware auth, launch-mode enforcement, adapter invocation, completion envelopes, and error normalization.

## Request Context

`createBffRequestContext()` produces the Telegram-aware request context used by BFF handlers and middleware. It includes parsed `initData`, launch metadata, validation state, auth/session information, and normalized request details so route code does not need to re-parse Telegram inputs manually.

## Configured Routers

`createBffConfig()` and `ConfiguredBffRouter` wire together route definitions, service adapters, validation settings, and feature flags into a single reusable BFF surface.

## Validation Runtime Notes

- Ed25519 `initData` validation uses the portable WebCrypto path from `@teleforgex/core/browser`.
- Bot-token `initData` validation uses the Node-only HMAC path from `@teleforgex/core`.
- When `validateInitData` is enabled with only `botToken` configured, non-Node runtimes fail explicitly with `RUNTIME_UNSUPPORTED_VALIDATION` instead of falling back to unchecked requests.

## Centralized Identity Manager

`@teleforgex/bff` resolves identity through a provider-backed identity manager. Provider-based identity config is the only supported API.

The built-in provider helpers are:

- `telegramIdIdentityProvider()`
- `usernameIdentityProvider()`
- `phoneAuthIdentityProvider()`
- `customIdentityProvider()`

Pass them through `identity.providers` in `createBffConfig()` or `createSessionRoutes()`.

## Phone Auth Exchange

Use `createPhoneAuthExchangeHandler()` when the bot has already collected a self-shared phone number and launched the Mini App with a signed `tfPhoneAuth` token.

```ts
import { createPhoneAuthExchangeHandler, defineBffRoute } from "@teleforgex/bff";

const phoneExchangeRoute = defineBffRoute({
  auth: "required",
  handler: createPhoneAuthExchangeHandler({
    adapter: sessionAdapter,
    identity: {
      adapter: identityAdapter,
      autoCreate: true,
      secret: process.env.PHONE_AUTH_SECRET!
    },
    secret: process.env.JWT_SECRET!
  }),
  method: "POST",
  path: "/phone/exchange"
});
```

The request body should include `{ phoneAuthToken }`. The handler verifies the signed phone token, confirms it matches the current Telegram user, resolves identity through the centralized manager, and returns the same access/refresh session envelope as the standard session exchange handler.
