# Server Hooks and BFF Internals

This guide explains the current server-side implementation layer in Teleforge.

It is an advanced guide. The default public app model is still:

- flows
- screens
- optional server hooks

## What This Layer Is

In the current repo, the server-side layer means:

- the Mini App still lives in `apps/web`
- the project may also own a Telegram-aware backend layer
- that backend can validate Telegram launch context, enforce auth and launch-mode rules, and talk to downstream services

Use this layer when the Mini App should not talk directly to every backend service by itself or when a flow step needs trusted server authority.

## What the Scaffold Gives You

The generated scaffold gives you:

- `apps/api` with placeholder route objects
- `teleforge.config.ts`

Important: the generated `apps/api` routes are **placeholders**, not a fully wired production server.

They show where your backend logic can live, but you still need to connect those routes to a real HTTP runtime.

## The Practical Mental Model

Think of the current server-side implementation as three layers:

1. **web UI** in `apps/web`
2. **BFF route definitions** in your server layer
3. **adapters/services** that talk to your actual backend systems

`@teleforgex/bff` currently helps with layer 2, while the flow-first runtime is moving toward convention-based server hooks on top of it.

## Smallest Useful Route

At the package level, the core pattern is:

```ts
import { createBffConfig, defineBffRoute, telegramIdIdentityProvider } from "@teleforgex/bff";

const config = createBffConfig({
  botToken: process.env.BOT_TOKEN,
  features: {
    sessions: false
  },
  identity: {
    adapter: myIdentityAdapter,
    providers: [telegramIdIdentityProvider()]
  }
});

const router = config.createRouter();

router.add(
  defineBffRoute({
    auth: "public",
    async handler(_context, input: { message: string }) {
      return {
        message: input.message.toUpperCase()
      };
    },
    method: "POST",
    path: "/echo"
  })
);
```

That route can then be exposed through the HTTP adapter you choose.

## Identity Configuration

Teleforge BFF identity is provider-based.

That means `identity` config should always include:

- `adapter`: your app-user storage adapter
- `providers`: one or more identity providers

The built-in providers are:

- `telegramIdIdentityProvider()`
- `usernameIdentityProvider()`
- `phoneAuthIdentityProvider()`
- `customIdentityProvider()`

Use `telegramIdIdentityProvider()` when Telegram user id is your primary app-user key. Use `usernameIdentityProvider()` only when your app deliberately keys users by Telegram username. Use `customIdentityProvider()` when the lookup rules are app-specific.

You can register providers in priority order:

```ts
import {
  createBffConfig,
  telegramIdIdentityProvider,
  usernameIdentityProvider
} from "@teleforgex/bff";

const config = createBffConfig({
  botToken: process.env.BOT_TOKEN!,
  features: {
    sessions: false
  },
  identity: {
    adapter: myIdentityAdapter,
    providers: [telegramIdIdentityProvider(), usernameIdentityProvider()]
  }
});
```

## How `apps/api` Fits In

For generated projects, `apps/api` is the natural place to keep:

- route definitions
- adapter setup
- webhook entry points
- shared backend wiring

A practical structure is:

- `apps/api/src/routes/*.ts` for route definitions
- `apps/api/src/index.ts` for creating the configured router and HTTP handler

The generated `health.ts` and `webhook.ts` files are there to make that structure obvious, not to claim the BFF is already complete.

## Service-Backed Routes

Use service-backed routes when the BFF should call a downstream API instead of implementing business logic inline.

```ts
defineBffRoute({
  auth: "required",
  method: "POST",
  path: "/users/lookup",
  service: {
    name: "users",
    operation: "lookup"
  }
});
```

This is the right fit when your BFF is mainly an integration layer.

## Session Exchange

If you enable sessions and provide the required adapters and JWT config, `createBffConfig()` can mount built-in session routes.

That is how you get routes such as:

- `/exchange`
- `/refresh`
- `/revoke`

These are useful when Telegram identity needs to be turned into an app session.

## Shared Phone Auth

Teleforge also supports a phone-share auth flow when your bot needs the user to confirm the phone number tied to their account.

The flow is:

1. the bot requests a self-shared contact
2. the bot validates the contact and signs a short-lived `tfPhoneAuth` token
3. the Mini App launches with that token in the URL
4. the Mini App sends `phoneAuthToken` to a BFF route
5. the BFF verifies the token, matches it to the active Telegram user, resolves identity, and issues a session

Use `createPhoneAuthExchangeHandler()` for step 5:

```ts
import { createPhoneAuthExchangeHandler, defineBffRoute } from "@teleforgex/bff";

export const phoneExchangeRoute = defineBffRoute({
  auth: "required",
  handler: createPhoneAuthExchangeHandler({
    adapter: sessionAdapter,
    identity: {
      adapter: phoneIdentityAdapter,
      autoCreate: true,
      secret: process.env.PHONE_AUTH_SECRET!
    },
    secret: process.env.JWT_SECRET!
  }),
  method: "POST",
  path: "/phone/exchange"
});
```

The request body should include `{ phoneAuthToken }`. For the bot-side half of the flow, use the contact-request and link-signing helpers from `@teleforgex/bot`.

## What to Build First

The highest-value first steps are:

1. add one handler-backed route
2. expose it through your server runtime
3. validate Telegram launch/auth context on that route
4. add one service-backed route when you need a downstream integration

Do not try to build the whole backend surface at once.

## Read Next

- [Developer Guide](./developer-guide.md)
- [Testing](./testing.md)
- [Deployment](./deployment.md)
