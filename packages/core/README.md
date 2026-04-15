# @teleforgex/core

Core manifest schema, validation, and loading utilities for Teleforge.

## Installation

```bash
pnpm add @teleforgex/core
```

## Exports

```ts
import {
  EventTypes,
  parseLaunchContext,
  createEventBus,
  loadManifest,
  manifestSchema,
  validateInitDataBotToken,
  validateInitDataEd25519,
  validateManifest
} from "@teleforgex/core";
```

`@teleforgex/core` validates the current Teleforge manifest shape emitted by the generator and consumed by devtools.

It also exposes launch parsing and server-side initData validation helpers for Telegram Mini Apps:

```ts
const result = validateInitDataBotToken(initData, process.env.BOT_TOKEN ?? "");

if (result.valid) {
  console.log(result.data.user?.id);
}
```

Third-party validation is also available through Telegram's Ed25519 signature flow. This path requires the bot ID and Telegram's environment public key, and uses the current `signature` field from `initData`:

```ts
const result = await validateInitDataEd25519(initData, telegramPublicKeyHex, {
  botId: 12345678,
  maxAge: 3600
});
```

This follows Telegram's current third-party validation format: `signature` is base64url-encoded, the public key is hex, and the signed payload is prefixed with `${botId}:WebAppData` before the sorted `key=value` lines.

For cross-surface messaging, `@teleforgex/core` now includes a shared event bus:

```ts
const bus = createEventBus();

bus.on(EventTypes.ORDER_CREATED, (event) => {
  console.log(event.payload);
});
```

React helpers are available from the isolated `@teleforgex/core/react` subpath so Node consumers do not pull React transitively:

```ts
import { useEvent, useEventBus, useEventPublisher } from "@teleforgex/core/react";
```

Browser-focused consumers can avoid the Node-only manifest and HMAC helpers by importing from the browser-safe subpath:

```ts
import { parseLaunchContext } from "@teleforgex/core/browser";
```

## Validation Runtimes

- `validateInitDataEd25519()` uses WebCrypto and is intended to work anywhere `globalThis.crypto.subtle` supports Ed25519, including modern browsers and edge-style runtimes.
- `validateInitDataBotToken()` is Node-only because it relies on `node:crypto` HMAC helpers and a bot token that should stay server-side.
- Teleforge BFF prefers Ed25519 when `publicKey + botId` are configured. If only `botToken` is configured in a non-Node runtime, the BFF throws `RUNTIME_UNSUPPORTED_VALIDATION` rather than silently skipping validation.

## Flow State Contract

`UserFlowState` is the canonical V1 continuity contract exported by `@teleforgex/core`:

```ts
interface UserFlowState {
  flowId: string;
  userId: string;
  stepId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
  version: number;
  chatId?: string;
}
```

If you are reconciling older planning artifacts, `stepId` is the active step identifier and `payload` holds the resumable flow context.

Teleforge V1 intentionally keeps this contract minimal. The runtime does not yet persist richer continuity fields such as `currentSurface`, `resumable`, `updatedAt`, `summary`, `pendingAction`, `returnRoute`, or `history`. Treat those as future contract extensions rather than part of the current storage API.
