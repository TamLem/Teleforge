# Shared Phone Auth

This guide shows how to build a Teleforge auth flow where Telegram proves that a user controls a
phone number.

Use this when phone number is the application's primary login key, but Telegram should anchor the
trust chain.

## End-to-End Flow

1. A bot asks the user to share their own phone number.
2. The bot verifies that the shared contact belongs to the sending Telegram user.
3. The bot signs a short-lived signed context into the Mini App URL.
4. The Mini App reads the context from the launch URL.
5. Server actions use the verified phone from the signed context.

## Using `onContact` Handler

The simplest way is the `onContact` handler on a flow:

```ts
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "login",

  handlers: {
    onContact: async ({ ctx, shared, sign, services }) => {
      // shared.normalizedPhone is already extracted and verified as self-shared
      const user = await services.users.findByPhone(shared.normalizedPhone);

      const launch = await sign({
        flowId: "login",
        screenId: "profile",
        subject: { phone: shared.normalizedPhone },
        allowedActions: ["editProfile", "logout"]
      });

      await ctx.reply(
        user
          ? `Welcome back, ${user.name}. Continue in the Mini App.`
          : "Phone verified. Complete your profile in the Mini App.",
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "Open Profile", web_app: { url: launch } }
            ]]
          }
        }
      );
    }
  },

  miniApp: {
    routes: {
      "/": "profile",
      "/edit": "profile.edit"
    },
    defaultRoute: "/"
  },

  actions: {
    editProfile: {
      handler: async ({ ctx, data, services }) => {
        await services.users.update(ctx.userId, data);
        return { data: { updated: true } };
      }
    }
  }
});
```

The framework handles:
- rendering a reply-keyboard contact request button (send a message with
  `reply_markup: { keyboard: [[{ text: "Share phone", request_contact: true }]] }`)
- accepting only self-shared contacts from the sending Telegram user
- normalizing the phone number before passing it to the handler

## Collision Rules

Only one flow may define an `onContact` handler across all flows. If multiple flows need
phone auth, scope the handler to a single "gate" flow and use signed context tokens to
pass the verified phone to other flows.

## Bot-Only Approach (No Flow)

When using `teleforge/bot` directly without a flow definition:

```ts
import {
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

  const token = createSignedActionContextToken({
    appId: "my-app",
    flowId: "login",
    userId: String(context.user!.id),
    subject: { phone: sharedContact.normalizedPhoneNumber },
    secret: process.env.TELEFORGE_FLOW_SECRET!
  });

  await context.reply("Continue in the Mini App", {
    reply_markup: {
      inline_keyboard: [[
        { text: "Open App", web_app: { url: `https://my.app/?tgWebAppStartParam=${token}` } }
      ]]
    }
  });
});
```

`extractSharedPhoneContact()` rejects contacts that do not belong to the sending Telegram user.

## Mini App Side

```tsx
import { useLaunchCoordination } from "teleforge/web";

function ProfileGate() {
  const launch = useLaunchCoordination();

  // The signed context is available as launch.rawFlowContext
  // Pass it to runAction() which sends it to the action server

  return (
    // Screen renders normally — the action server validates the context
  );
}
```

For a flow screen, call `runAction()` with the action id. The action server validates
the signed context (including the phone subject) before running the handler.

## Security Notes

- phone-auth tokens are signed and short-lived (default 15 minutes)
- the action server validates the signature and expiry on every request
- phone numbers should be normalized before storage or comparison
- only self-shared contacts are accepted (framework rejects contacts from other users)

## Read Next

- [Action Server](./server-hooks.md)
- [Flow Coordination](./flow-coordination.md)
- [Telegram Mini App Basics](./telegram-basics.md)
