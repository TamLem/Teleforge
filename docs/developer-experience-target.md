# Developer Experience Target

This document defines the desired Teleforge developer experience.

The goal is simple:

- developers describe product journeys
- Teleforge owns framework wiring
- app code stays flow-first instead of runtime-assembly-first

Teleforge should feel like one framework package for Telegram-native products, not a collection of libraries that still require manual composition.

## Core Principle

Developers should express intent, not bootstrap.

That means app authors should spend most of their time in:

- `teleforge.config.ts`
- flow files
- screen files
- optional server hook files

They should not have to reason about framework package boundaries, runtime boot order, or process-level wiring unless they are intentionally using advanced escape hatches.

## Desired App Shape

The default Teleforge app should look like this:

```txt
my-app/
  teleforge.config.ts
  apps/
    bot/
      src/flows/
      src/runtime.ts        optional or framework-owned
    web/
      src/main.tsx
      src/screens/
      src/teleforge-generated/client-flow-manifest.ts
    api/
      src/flow-hooks/
```

The important mental model is:

- define a flow
- define the steps
- bind Mini App steps to screens
- attach trusted hooks where authority is required
- run the app with Teleforge commands

## Better DX Characteristics

### 1. One app definition

The framework should start from one application definition in `teleforge.config.ts`.

That definition should be enough to describe:

- app identity
- flow discovery
- Mini App entry
- bot delivery mode
- optional trusted runtime features
- local development services

The developer should not need to duplicate framework metadata across multiple config layers.

### 2. Zero-manual bot bootstrap by default

Today the developer still creates a bot runtime explicitly:

```ts
const runtime = await createDiscoveredBotRuntime({
  cwd,
  flowSecret,
  miniAppUrl,
  phoneAuthSecret
});
```

That works, but it still exposes framework assembly details.

The target DX is closer to:

```ts
import { startTeleforgeBot } from "teleforge";

await startTeleforgeBot();
```

or a framework-owned convention with no custom bootstrap file at all for the common case.

The framework should own:

- config loading
- environment resolution
- discovered runtime creation
- polling bootstrap
- webhook bootstrap
- hooks-server wiring when needed

### 3. Flow-native Telegram primitives

Common Telegram platform behaviors should exist as flow helpers, not low-level manual implementations.

Examples:

- `openMiniAppAction()`
- `returnToChatAction()`
- `requestPhoneAction()`
- `requestPhoneAuthAction()`

Future helpers should follow the same pattern for other Telegram-specific interaction surfaces when they are common enough to justify a first-class abstraction.

The developer should describe the product behavior in the flow, while Teleforge hides the Telegram transport details.

### 4. Automatic trusted-runtime wiring

If a flow uses:

- Mini App server hooks
- chat handoff
- trusted submit/action handling
- phone-auth handoff

then Teleforge should wire the required bridge/runtime path by convention.

The app author should not have to manually connect multiple framework-owned server endpoints just to use a standard Teleforge flow pattern.

### 5. One command model

The framework command surface should feel complete and coherent:

```bash
teleforge dev
teleforge start
teleforge doctor
teleforge generate client-manifest
```

The normal developer workflow should not require separately thinking in terms of:

- web dev server
- bot process
- API process
- tunnel process

Teleforge should orchestrate those surfaces when the app uses them.

### 6. Simulator-first development

The default local loop should be:

1. edit a flow
2. edit a screen
3. run `teleforge dev`
4. drive the journey in the simulator
5. run `teleforge doctor` if framework wiring is broken

This should cover:

- bot commands
- callbacks
- `web_app_data`
- flow continuity
- active sessions
- trusted handoff diagnostics

### 7. Stable public surfaces

The public framework model should stay centered on:

- `teleforge`
- `teleforge/web`
- `teleforge/bot`
- `teleforge/server-hooks`
- `teleforge/core/browser`

Internal workspace packages may continue to exist for framework implementation, but app authors should not have to understand or import those packages as part of normal Teleforge development.

### 8. Escape hatches remain possible

Better DX does not mean removing advanced control.

The framework should provide strong defaults first, then allow escape hatches for:

- custom bot startup
- custom storage
- custom service injection
- custom webhook hosting
- custom Mini App delivery/runtime setup

The important rule is:

- simple apps should stay simple
- advanced apps should pay complexity only when they actually need it

## Example of the Intended Experience

```ts
import {
  chatStep,
  defineFlow,
  miniAppStep,
  openMiniAppAction,
  requestPhoneAuthAction
} from "teleforge";

export default defineFlow({
  id: "onboarding",
  initialStep: "welcome",
  state: {},
  steps: {
    welcome: chatStep("Welcome", [
      openMiniAppAction("Open app", "catalog")
    ]),
    catalog: miniAppStep("catalog"),
    verifyPhone: chatStep("Verify your phone number", [
      requestPhoneAuthAction("Share phone", "profile")
    ]),
    profile: miniAppStep("profile")
  }
});
```

The developer should not have to separately think about:

- how Telegram contact sharing works
- how the Mini App launch payload is signed
- how state resumes across chat and Mini App
- how the server bridge is wired
- how local development orchestrates all related services

Those are framework concerns.

## DX Summary

Teleforge should feel like:

- one framework
- one package identity
- one flow-first mental model
- one local command surface
- one coherent runtime story

The desired outcome is a framework where developers model product journeys, not framework plumbing.
