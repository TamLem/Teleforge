# `@teleforgex/bot`

Internal Teleforge implementation layer for Telegram bot routing and chat primitives.

Most apps should start from discovered flows and the bot runtime exported by `teleforge`:

```ts
import { startTeleforgeBot } from "teleforge";
```

When an app needs lower-level Telegram primitives, use the public subpath:

```ts
import { BotRouter, extractSharedPhoneContact } from "teleforge/bot";
```

This package implements the lower-level router, command handling, contact/location extraction, and shared phone auth helpers behind that subpath.
