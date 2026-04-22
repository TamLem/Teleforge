# Telegram Mini App Basics

This guide is the background layer for developers who are new to Telegram Mini Apps.

If you already know Telegram's model, continue with [Getting Started](./getting-started.md).

## The Core Model

A Telegram Mini App is a web app that opens inside Telegram's in-app web view.

There are always two surfaces:

- the **bot chat**, where the user sends commands and taps inline buttons
- the **Mini App web view**, where the user interacts with frontend screens

Teleforge turns that split into one flow runtime. Developers define flow steps and screens, then the framework wires chat launch, Mini App context, submissions, and return-to-chat transitions.

## What Telegram Sends to the Mini App

When Telegram opens your Mini App, it provides launch context through the Telegram WebApp bridge.

The most important field is `initData`:

- it identifies the Telegram user and chat context
- it includes launch metadata such as query IDs and start parameters
- it can be validated so trusted server code knows the request came from Telegram

Teleforge exposes this through:

- `teleforge/web` hooks for Mini App runtime state
- `teleforge/core/browser` for browser-safe validation helpers
- `teleforge/server-hooks` for trusted flow guard, loader, submit, and action endpoints

## Launch Modes

Telegram Mini Apps can open in different visual contexts:

- `inline`: opened from a message or inline button
- `compact`: opened in a constrained app-style surface
- `fullscreen`: opened in a larger dedicated surface

Teleforge treats launch mode as runtime context. Screens and guards can inspect that context and decide whether to render, redirect, or fail with a recovery path.

In the local simulator, launch mode is one of the main controls in the right-hand pane.

## `web_app_data`

`web_app_data` is Telegram's standard mechanism for sending a payload from the Mini App back to the bot chat.

Typical flow:

1. The bot sends a `web_app` button.
2. The user opens the Mini App.
3. The user completes an action.
4. The Mini App sends a payload back to the bot.
5. The bot acknowledges it and replies in chat.

Teleforge supports simple app-to-bot payloads, but the preferred framework path is flow coordination: Mini App progress is persisted, submit/action payloads are validated, and chat continuation happens through the flow runtime.

## Contact Sharing and Phone Auth

Telegram bots can request a user to share their own contact card.

Teleforge uses that capability for optional shared phone-number auth:

1. the bot asks for a self-shared contact
2. the bot validates that the contact belongs to the sending Telegram user
3. the bot signs a short-lived phone-auth token into the Mini App launch URL
4. the Mini App submits that token to a trusted server hook
5. server-side identity code resolves the app user by normalized phone number

This is separate from `web_app_data`:

- `web_app_data` is app-to-bot data transport
- shared phone auth is a bot-to-Mini-App credential handoff

## BotFather

BotFather is Telegram's official bot-management bot.

Use it to:

- create your bot
- get the bot token
- configure bot commands
- optionally configure menu buttons or Mini App entry points

For local Teleforge work, BotFather matters mainly when you want a real Telegram-facing bot instead of simulator-only development.

## How This Maps to Teleforge

The recommended local flow is:

1. Run `teleforge dev`.
2. Work inside the simulator.
3. Trigger `/start`, callbacks, screen submissions, and return-to-chat locally.
4. Move to `teleforge dev --public --live` only when you need real Telegram validation.

You do not need to understand every Telegram detail before starting. You do need the mental model that chat and Mini App are two surfaces in one flow runtime.

## Read Next

- [Getting Started](./getting-started.md)
- [Developer Guide](./developer-guide.md)
- [Flow Coordination](./flow-coordination.md)
