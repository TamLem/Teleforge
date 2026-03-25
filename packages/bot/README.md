# @teleforge/bot

Telegram bot routing primitives for Teleforge.

## Installation

```bash
npm install @teleforge/bot
```

## Exports

```ts
import {
  BotRouter,
  createBotRuntime,
  createDefaultStartHandler,
  isOrderPayload
} from "@teleforge/bot";
```

`@teleforge/bot` provides a middleware-capable router for Telegram updates plus a small runtime bridge that can register the generator's existing command-object shape.

It also handles Mini App `web_app_data` messages with parsed JSON payloads and acknowledgment helpers:

```ts
router.onWebAppData(async (context) => {
  if (isOrderPayload(context.payload)) {
    await context.answer(`Order received for ${context.payload.total} ${context.payload.currency}`);
    return;
  }

  await context.reply(`Received: ${context.data}`);
});
```
