# Flow Coordination

Flow coordination is Teleforge's main differentiator: a user starts in chat, continues in the Mini App, and returns to chat with structured state instead of a one-off callback.

This guide walks through that lifecycle using `apps/task-shop`.

## The Lifecycle

The coordinated flow in Task Shop is:

1. user sends `/start` in chat
2. bot opens the Mini App with signed flow context
3. Mini App restores or persists flow state while the user moves through routes
4. Mini App completes the flow and returns data
5. bot validates the return payload and replies in chat

## 1. Define the Flow Contract

Start in [coordination.ts](/home/aj/hustle/tmf/apps/task-shop/apps/web/src/coordination.ts).

This file defines:

- the flow ID: `task-shop-browse`
- the steps: `catalog`, `cart`, `checkout`, `completed`
- the default return-to-chat behavior
- which routes and commands enter the flow

This is the best place to learn the shape of a coordinated app before reading UI code.

## 2. Enter the Flow from the Bot

Open [start.ts](/home/aj/hustle/tmf/apps/task-shop/apps/bot/src/commands/start.ts).

The key call is `initiateCoordinatedFlow(...)`.

That command does more than send a plain `web_app` button:

- creates flow metadata
- stores user and step information
- signs the return contract
- sends a Mini App button tied to that flow

This is the bot-side entry point for coordination.

## 3. Wrap the Mini App in Coordination Providers

Open [App.tsx](/home/aj/hustle/tmf/apps/task-shop/apps/web/src/App.tsx).

The outer `CoordinationProvider` is the center of the web-side integration.

It handles:

- current route tracking
- flow snapshot persistence
- resume behavior
- fresh-start behavior when a flow is missing or expired

That file is also where the app maps resumed flow state back into local cart state and route navigation.

## 4. Persist and Resume Flow State

Open [flowResume.ts](/home/aj/hustle/tmf/apps/task-shop/apps/web/src/flowResume.ts).

This file is the local storage adapter for the coordinated flow.

It shows how Task Shop:

- stores a `UserFlowState`
- assigns expiry
- restores snapshots
- maps flow step IDs back to routes

That means the web app can recover useful state even after reloads or navigation changes.

## 5. Complete the Flow from the Mini App

Open [CheckoutPage.tsx](/home/aj/hustle/tmf/apps/task-shop/apps/web/src/pages/CheckoutPage.tsx).

The important call is:

- `completeFlow(...)`

That is the clean Teleforge path for a coordinated return to chat.

Task Shop also keeps a fallback:

- if coordinated return is unavailable, it falls back to `publishOrder(...)`

So you can read that file as both:

- the preferred coordinated path
- the simpler raw-payload fallback path

## 6. Handle the Return in the Bot

Open [orderCompleted.ts](/home/aj/hustle/tmf/apps/task-shop/apps/bot/src/handlers/orderCompleted.ts).

The key call is:

- `handleMiniAppReturnData(...)`

This validates the coordinated return payload, loads the saved flow state, and routes the result into:

- `onCancel`
- `onComplete`
- `onError`

This is the bot-side close of the loop.

## What to Copy Into Your Own App

If you want your own coordinated flow, copy the pattern, not the sample domain model:

1. define a coordination config
2. start the flow from a bot command or button
3. wrap the Mini App in `CoordinationProvider`
4. persist a flow snapshot that matters to your app
5. call `completeFlow()` when the user finishes
6. handle the return payload with `handleMiniAppReturnData()`

## Local Development Path

You do not need real Telegram to build most of this.

Use:

```bash
cd apps/task-shop
pnpm run dev:local
```

Then exercise:

- `/start`
- route changes
- flow reset
- `web_app_data` replay

inside the simulator.

## Read Alongside

- [apps/task-shop/README.md](../apps/task-shop/README.md)
- [Developer Guide](./developer-guide.md)
- [Testing](./testing.md)
