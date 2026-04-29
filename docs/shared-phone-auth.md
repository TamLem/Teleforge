# Shared Phone Auth

This guide shows how to build a Teleforge auth flow where Telegram proves that a user controls a
phone number.

Use this when phone number is the application's primary login key, but Telegram should anchor the
trust chain.

## End-to-End Flow

1. A bot asks the user to share their own phone number.
2. The bot verifies that the shared contact belongs to the sending Telegram user.
3. The `onContact` handler signs a short-lived context into the Mini App URL.
4. The Mini App reads the context from the launch URL.
5. Server actions use the verified phone from the signed context.

## Using `onContact` Handler

The flow definition:

```ts
import { defineFlow } from "teleforge";

export default defineFlow({
  id: "login",

  handlers: {
    onContact: async ({ ctx, shared, sign, services }) => {
      const user = await services.users.findByPhone(shared.normalizedPhone);

      const launch = await sign({
        screenId: "profile",
        subject: { resource: { type: "phone", value: shared.normalizedPhone } },
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
      "/edit": "profileEdit"
    },
    defaultRoute: "/"
  },

  session: {
    enabled: true
  },

  actions: {
    editProfile: {
      handler: async ({ input, ctx, services, session }) => {
        await services.users.update(ctx.userId, input);
        return { data: { updated: true } };
      }
    }
  }
});
```

The framework handles:
- rendering a reply-keyboard contact request button
- accepting only self-shared contacts from the sending Telegram user
- normalizing the phone number before passing it to the handler
- validating the signed context on every action call

## Collision Rules

Only one flow may define an `onContact` handler across all flows. If multiple flows need
phone auth, scope the handler to a single "gate" flow and use signed context tokens to
pass the verified phone to other flows.

## Raw Bot Adapter Only

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
  const shared = extractSharedPhoneContact(context.update);
  if (!shared) { await next(); return; }

  // For direct bot use, construct the signed URL manually
  const { createSignedActionContext } = await import("@teleforgex/core");
  const now = Math.floor(Date.now() / 1000);
  const token = createSignedActionContext(
    {
      appId: "my-app",
      flowId: "login",
      screenId: "profile",
      userId: String(context.user!.id),
      subject: { resource: { type: "phone", value: shared.normalizedPhoneNumber } },
      allowedActions: ["editProfile"],
      issuedAt: now,
      expiresAt: now + 900
    },
    process.env.TELEFORGE_FLOW_SECRET!
  );
  const url = new URL(process.env.MINI_APP_URL!);
  url.searchParams.set("tgWebAppStartParam", token);

  await context.reply("Continue in the Mini App", {
    reply_markup: {
      inline_keyboard: [[{ text: "Open App", web_app: { url: url.toString() } }]]
    }
  });
});
```

`extractSharedPhoneContact()` rejects contacts that do not belong to the sending Telegram user.

## Security Notes

- Phone auth tokens are signed and short-lived (default 15 minutes)
- The action server validates the signature and expiry on every request
- Phone numbers should be normalized before storage or comparison
- Only self-shared contacts are accepted (framework rejects contacts from other users)

## Read Next

- [Action Server](./server-hooks.md)
- [Flow Coordination](./flow-coordination.md)
- [Telegram Mini App Basics](./telegram-basics.md)
