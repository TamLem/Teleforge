# Telegram Mini App Basics

This guide is the missing background layer for developers who are new to Telegram Mini Apps.

If you already know Telegram's model, skip to [Getting Started](./getting-started.md). If not, read this first.

## The Core Model

A Telegram Mini App is a web app that opens inside Telegram's in-app web view.

In practice, there are always two surfaces:

- the **bot chat**, where the user sends commands like `/start`
- the **Mini App web view**, where the user interacts with HTML, CSS, and JavaScript

Teleforge is built around that split. It gives you:

- a framework-owned bot/runtime path for the chat side
- `teleforge/web` for the current Mini App shell path
- shared coordination, validation, and optional server-hook helpers so those surfaces can work together cleanly

## What Telegram Sends to the Mini App

When Telegram opens your Mini App, it provides launch context through the Telegram WebApp bridge.

The most important part is **`initData`**:

- it identifies the Telegram user and chat context
- it includes launch metadata such as query IDs and start parameters
- it can be validated so your server knows the request really came from Telegram

Teleforge wraps this in:

- `useTelegram()` and `useLaunch()` in `@teleforgex/web`
- launch and validation helpers in `@teleforgex/core`
- Telegram-aware middleware and request context in `@teleforgex/bff`

## Launch Modes

Telegram Mini Apps can open in different visual contexts.

- `inline`: opened from a message or button, usually the lightest-weight entry
- `compact`: opened in a more constrained app-style surface
- `fullscreen`: opened in a larger dedicated surface

Teleforge uses launch modes for both docs and guardrails:

- they are declared in `teleforge.app.json`
- `useLaunch()` exposes the current mode
- route guards and UI boundaries can restrict routes to particular modes

In the local simulator, launch mode is one of the main controls in the right-hand pane.

## `web_app_data`

`web_app_data` is the standard Telegram mechanism for sending data back from the Mini App to the bot chat.

Typical flow:

1. The bot sends a `web_app` button.
2. The user opens the Mini App.
3. The user completes an action.
4. The Mini App sends a payload back to the bot.
5. The bot acknowledges it and replies in chat.

Teleforge supports that in two layers:

- simple app-to-bot payloads through Telegram `sendData`
- richer coordinated flows where Mini App progress is persisted and structured handoff returns to chat through the discovered bot runtime

## Contact Sharing and Phone Auth

Telegram bots can also request a user to share their own contact card.

Teleforge uses that capability for optional shared phone-number auth:

1. the bot asks for a self-shared contact
2. the bot validates that the contact belongs to the sending Telegram user
3. the bot signs a short-lived phone-auth token into the Mini App launch URL
4. the Mini App forwards that token to the server-side exchange route
5. the server-side layer resolves app identity by normalized phone number and can issue an app session

This is separate from `web_app_data`:

- `web_app_data` is app-to-bot data transport
- shared phone auth is a bot-to-Mini-App credential handoff

## BotFather

BotFather is Telegram's official bot-management bot.

You use it to:

- create your bot
- get the bot token
- configure bot commands
- optionally configure menu buttons or Mini App entry points

For local Teleforge work, BotFather matters mainly when you want a real Telegram-facing bot instead of simulator-only development.

## How This Maps to Teleforge

Teleforge's recommended local flow is:

1. Use `teleforge dev`.
2. Work inside the simulator.
3. Trigger `/start`, callbacks, and `web_app_data` locally.
4. Move to `teleforge dev --public --live` only when you need real Telegram validation.

That means:

- you do **not** need to understand every Telegram detail before starting
- but you do need the mental model that there is always a **chat side** and a **web side**

## Read Next

- [Getting Started](./getting-started.md)
- [Developer Guide](./developer-guide.md)
- [Flow Coordination](./flow-coordination.md)
