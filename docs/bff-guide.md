# BFF Mode Guide

This guide explains what BFF mode means in Teleforge and how to turn the generated scaffold into something useful.

## What BFF Mode Is

In Teleforge, BFF mode means:

- the Mini App still lives in `apps/web`
- the project also owns a Telegram-aware backend layer
- that backend can validate Telegram launch context, enforce auth and launch-mode rules, and talk to downstream services

Use BFF mode when the Mini App should not talk directly to every backend service by itself.

## What the Scaffold Gives You

The generated BFF scaffold gives you:

- `apps/web` with Next.js
- `apps/api` with placeholder route objects
- `teleforge.app.json` with `runtime.mode: "bff"` and `runtime.apiRoutes`

Important: the generated `apps/api` routes are **placeholders**, not a fully wired production server.

They show where your backend logic can live, but you still need to connect those routes to a real HTTP runtime.

## The Practical Mental Model

Think of BFF mode as three layers:

1. **web UI** in `apps/web`
2. **BFF route definitions** in your server layer
3. **adapters/services** that talk to your actual backend systems

Teleforge's BFF package helps with layer 2.

## Smallest Useful Route

At the package level, the core pattern is:

```ts
import { createBffConfig, defineBffRoute } from "@teleforgex/bff";

const config = createBffConfig({
  botToken: process.env.BOT_TOKEN,
  features: {
    sessions: false
  },
  identity: {
    adapter: myIdentityAdapter
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

## What to Build First in BFF Mode

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
