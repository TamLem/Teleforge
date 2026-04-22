# Shared Phone Auth

This guide shows how to build a Teleforge auth flow where Telegram proves that a user controls a phone number.

Use this when phone number is the application's primary login key, but Telegram should anchor the trust chain.

## End-to-End Flow

1. A bot asks the user to share their own phone number.
2. The bot verifies that the shared contact belongs to the sending Telegram user.
3. The bot signs a short-lived phone-auth token into the Mini App URL.
4. The Mini App reads the token from launch context.
5. A trusted server hook verifies the token and resolves the app user.

## Public Helpers

Use these public Teleforge surfaces:

- `teleforge/bot` for contact request and Mini App launch helpers
- `teleforge/web` for Mini App launch context
- `teleforge/server-hooks` for trusted token exchange and session/domain logic
- `teleforge` for shared flow state helpers when the exchange is part of a flow

## Bot Step

```ts
import {
  createPhoneAuthLink,
  createPhoneNumberRequestMarkup,
  extractSharedPhoneContact
} from "teleforge/bot";

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

## Mini App Step

```tsx
import { useLaunch } from "teleforge/web";

export function LoginGate() {
  const launch = useLaunch();

  async function exchange() {
    if (!launch.phoneAuthToken) {
      return;
    }

    await fetch("/api/teleforge/phone/exchange", {
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

For a full flow screen, prefer calling the Teleforge screen submit/action helper so the exchange can transition the flow after success.

## Server Hook Step

The trusted exchange should:

- verify the signed phone-auth token
- check that the token's Telegram user id matches the authenticated request
- normalize the phone number before lookup
- resolve or create the app user according to application policy
- issue an app session or commit the identity result into flow/domain state

The exchange belongs server-side because the browser cannot be trusted to assert identity ownership.

## Security Notes

- phone-auth tokens should be short-lived and signed
- the trusted endpoint must still validate Telegram launch/auth context
- token verification must bind the token to the current Telegram user
- phone numbers should be normalized before storage or comparison
- session issuance should happen only after the server-side identity lookup succeeds

## Read Next

- [Server Hooks and Backend Internals](./server-hooks.md)
- [Developer Guide](./developer-guide.md)
- [Telegram Mini App Basics](./telegram-basics.md)
