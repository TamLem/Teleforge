# `@teleforge/bff`

Typed BFF route definitions, registry helpers, and middleware primitives for Teleforge.

## Validation Runtime Notes

- Ed25519 `initData` validation uses the portable WebCrypto path from `@teleforge/core/browser`.
- Bot-token `initData` validation uses the Node-only HMAC path from `@teleforge/core`.
- When `validateInitData` is enabled with only `botToken` configured, non-Node runtimes fail explicitly with `RUNTIME_UNSUPPORTED_VALIDATION` instead of falling back to unchecked requests.
