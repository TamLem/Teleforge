# `@teleforge/bff`

Typed BFF route definitions, registry helpers, and middleware primitives for Teleforge.

## Route Definition

```ts
import { createBffConfig, defineBffRoute, executeBffRoute } from "@teleforge/bff";

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

- Ed25519 `initData` validation uses the portable WebCrypto path from `@teleforge/core/browser`.
- Bot-token `initData` validation uses the Node-only HMAC path from `@teleforge/core`.
- When `validateInitData` is enabled with only `botToken` configured, non-Node runtimes fail explicitly with `RUNTIME_UNSUPPORTED_VALIDATION` instead of falling back to unchecked requests.
