# `packages/bot`

Internal Teleforge implementation layer for Telegram bot routing and chat primitives.

Most apps should start from discovered flows and the bot runtime exported by `teleforge`:

```ts
import { createDiscoveredBotRuntime } from "teleforge";
```

When an app needs lower-level Telegram primitives, use the public subpath:

```ts
import { BotRouter, createPhoneAuthLink, extractSharedPhoneContact } from "teleforge/bot";
```

This package implements the lower-level router, command handling, `web_app_data` handling, and shared phone auth helpers behind that subpath.
