# Shared Phone Auth

This guide shows how to build a Teleforge auth flow where:

1. a bot asks the user to share their own phone number
2. the bot signs a short-lived phone-auth token into the Mini App URL
3. the Mini App forwards that token to the BFF
4. the BFF resolves the app user by phone number and issues a session

Use this when phone number is the application's primary login key, but you still want Telegram to anchor the trust chain.

## What Teleforge Provides

### `@teleforgex/bot`

- `createPhoneNumberRequestMarkup()`
- `createPhoneNumberRequestButton()`
- `extractSharedPhoneContact()`
- `createPhoneAuthLink()`

### `@teleforgex/web`

- `useLaunch().phoneAuthToken`

### `@teleforgex/bff`

- `createPhoneAuthExchangeHandler()`
- `resolvePhoneAuthIdentity()`
- provider-based identity config

### `@teleforgex/core`

- `normalizePhoneNumber()`
- `createSignedPhoneAuthToken()`
- `verifySignedPhoneAuthToken()`

## End-to-End Flow

### 1. Ask for a self-shared contact in the bot

```ts
import {
  createPhoneAuthLink,
  createPhoneNumberRequestMarkup,
  extractSharedPhoneContact
} from "@teleforgex/bot";

router.command("login", async (context) => {
  await context.reply("Share the phone number tied to your account.", {
    reply_markup: createPhoneNumberRequestMarkup({
      text: "Share phone number"
    })
  });
});

router.use(async (context, next) => {
  const sharedContact = extractSharedPhoneContact(context.update);

  if (!sharedContact) {
    await next();
    return;
  }

  const url = await createPhoneAuthLink({
    phoneNumber: sharedContact.normalizedPhoneNumber,
    secret: process.env.PHONE_AUTH_SECRET!,
    telegramUserId: sharedContact.telegramUserId,
    webAppUrl: process.env.MINI_APP_URL!
  });

  await context.replyWithWebApp("Continue in the Mini App", "Open App", url);
});
```

`extractSharedPhoneContact()` rejects contacts that do not belong to the sending Telegram user.

### 2. Read the signed token in the Mini App

```tsx
import { useLaunch } from "@teleforgex/web";

export function LoginGate() {
  const launch = useLaunch();

  async function exchange() {
    if (!launch.phoneAuthToken) {
      return;
    }

    await fetch("/api/phone/exchange", {
      body: JSON.stringify({
        phoneAuthToken: launch.phoneAuthToken
      }),
      headers: {
        "content-type": "application/json",
        "x-telegram-init-data": launch.initData
      },
      method: "POST"
    });
  }

  return <button onClick={exchange}>Finish sign in</button>;
}
```

### 3. Exchange the token in the BFF

```ts
import {
  createPhoneAuthExchangeHandler,
  defineBffRoute,
  telegramIdIdentityProvider
} from "@teleforgex/bff";

export const phoneExchangeRoute = defineBffRoute({
  auth: "required",
  handler: createPhoneAuthExchangeHandler({
    adapter: sessionAdapter,
    identity: {
      adapter: {
        create: userStore.create,
        findByPhoneNumber: userStore.findByPhoneNumber,
        findByTelegramId: userStore.findByTelegramId,
        findByUsername: userStore.findByUsername,
        update: userStore.update
      },
      autoCreate: true,
      providers: [telegramIdIdentityProvider()],
      secret: process.env.PHONE_AUTH_SECRET!
    },
    secret: process.env.JWT_SECRET!
  }),
  method: "POST",
  path: "/phone/exchange"
});
```

The handler:

- verifies the signed phone-auth token
- checks that it matches the current Telegram user
- resolves the app user by normalized phone number
- auto-creates when configured
- returns the same access/refresh session envelope as normal exchange

## Identity Configuration

Teleforge BFF identity is provider-based. That still applies when you add phone auth.

Phone auth is not a separate replacement identity system. It is a provider-backed exchange path layered on top of the same identity manager used by standard Telegram-based session exchange.

## Security Notes

- phone-auth tokens are short-lived and signed
- the BFF still requires Telegram-authenticated request context
- token verification checks that the token's Telegram user id matches the current request's Telegram user
- phone numbers are normalized before lookup so storage and comparison use one format

## Where to Look Next

- [BFF Mode Guide](./bff-guide.md)
- [Developer Guide](./developer-guide.md)
- [Telegram Mini App Basics](./telegram-basics.md)
- [Starter App Walkthrough](../examples/starter-app/README.md)
