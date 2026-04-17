# @teleforgex/bot

Telegram bot routing primitives for Teleforge.

## Installation

```bash
pnpm add @teleforgex/bot
```

## Exports

```ts
import {
  BotRouter,
  createBotRuntime,
  createDefaultStartHandler,
  isOrderPayload
} from "@teleforgex/bot";
```

`@teleforgex/bot` provides a middleware-capable router for Telegram updates plus a small runtime bridge that can register the generator's existing command-object shape.

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

## Shared Phone Auth

`@teleforgex/bot` can now start a shared phone-number auth flow with Telegram contact sharing:

```ts
import {
  createPhoneAuthLink,
  createPhoneNumberRequestMarkup,
  extractSharedPhoneContact
} from "@teleforgex/bot";

router.command("login", async (context) => {
  await context.reply("Share the phone number tied to your account.", {
    reply_markup: createPhoneNumberRequestMarkup()
  });
});

router.use(async (context, next) => {
  const sharedContact = extractSharedPhoneContact(context.update);

  if (!sharedContact) {
    await next();
    return;
  }

  const loginUrl = await createPhoneAuthLink({
    phoneNumber: sharedContact.normalizedPhoneNumber,
    secret: process.env.PHONE_AUTH_SECRET!,
    telegramUserId: sharedContact.telegramUserId,
    webAppUrl: process.env.MINI_APP_URL!
  });

  await context.replyWithWebApp("Continue in the Mini App", "Open App", loginUrl);
});
```

`extractSharedPhoneContact()` only accepts self-shared contacts and normalizes the phone number before the Mini App link is signed.
