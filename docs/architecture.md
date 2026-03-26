# Teleforge Architecture

This document describes the current Teleforge V1 architecture as implemented in this repository.

It is intentionally limited to shipped behavior. It does not describe plugin APIs, future payment abstractions, or other aspirational work that is not part of the current codebase.

## High-Level Model

Teleforge is a layered framework for Telegram-native applications.

At a high level:

```text
Telegram Client
  -> Mini App runtime (@teleforge/web + @teleforge/ui)
  -> Bot runtime (@teleforge/bot)
  -> Optional BFF runtime (@teleforge/bff)
  -> Shared contracts and validation (@teleforge/core)
  -> Local iteration tooling (@teleforge/devtools)
```

The framework is organized so that application code can share one manifest and one set of flow contracts across these surfaces.

## Package Dependency Graph

The implemented package graph is:

```text
@teleforge/core
  <- @teleforge/web
  <- @teleforge/bot
  <- @teleforge/bff

@teleforge/web
  <- @teleforge/ui

create-teleforge-app
  generates workspaces that consume the packages above

@teleforge/devtools
  depends on @teleforge/core for manifest parsing and validation
```

Implications:

- `@teleforge/core` is the source of truth for shared types and cross-surface contracts.
- `@teleforge/web`, `bot`, and `bff` interpret Telegram runtime concerns for their own execution surface.
- `@teleforge/ui` stays presentation-focused and builds on `@teleforge/web` instead of reimplementing Telegram state handling.

## Runtime Surfaces

Teleforge V1 supports three main runtime surfaces.

### Mini App Runtime

The Mini App runtime lives in the browser and is built from:

- `@teleforge/web`
- `@teleforge/ui`
- your app code in `apps/web`

Responsibilities:

- read Telegram WebApp state
- interpret launch mode and capabilities
- react to theme and viewport changes
- drive native controls like Main Button and Back Button
- coordinate chat handoff and flow resume

### Bot Runtime

The bot runtime lives in Node and is built from:

- `@teleforge/bot`
- your bot code in `apps/bot`

Responsibilities:

- handle commands and Telegram updates
- respond to `web_app_data`
- generate chat entry points into Mini Apps
- resume or complete coordinated flows
- run via polling or webhook adapters

### BFF Runtime

The BFF runtime is optional and lives server-side. It is built from:

- `@teleforge/bff`
- your app code in `apps/api`

Responsibilities:

- validate Telegram identity server-side
- expose Telegram-aware backend routes
- enforce launch-mode/auth constraints at the API layer
- resolve app identity from Telegram identity
- exchange/refresh/revoke app sessions
- invoke downstream services through adapters

## The Manifest as Source of Truth

`teleforge.app.json` is the shared manifest used across the stack.

It drives:

- runtime mode (`spa` or `bff`)
- web framework choice
- bot metadata
- Mini App launch modes
- route definitions and guards
- devtools validation

In practice, the manifest is consumed by:

- the scaffold generator
- `teleforge dev` and `teleforge doctor`
- core schema validation
- route/guard logic in app code

This keeps Telegram-specific route and capability metadata out of ad hoc constants spread across the repo.

## SPA vs BFF Modes

### SPA Mode

In SPA mode:

```text
Telegram Client
  -> Mini App (Vite)
  -> your existing APIs or direct backend endpoints
  -> Bot remains separate
```

Use this when you do not need a dedicated Telegram-aware backend layer in the same app workspace.

### BFF Mode

In BFF mode:

```text
Telegram Client
  -> Mini App (Next.js)
  -> Teleforge BFF routes
  -> service adapters / downstream APIs
```

Use this when request context, auth translation, and route middleware belong close to the app.

## Core Contracts

`@teleforge/core` defines the contracts shared across the framework.

### Launch Context

Core parses Telegram launch inputs into a normalized launch context that the Mini App and BFF layers can use consistently.

This includes:

- launch mode
- Telegram platform
- capability flags
- `startapp` or deep-link entry information

### Validation

Core owns `initData` validation primitives:

- bot-token validation for Node runtimes
- Ed25519 validation for portable WebCrypto runtimes

This keeps security-sensitive parsing and signature handling out of app code.

### Flow State

Core also owns the V1 `UserFlowState` contract used for chat/Mini App continuity.

That contract is intentionally minimal in V1 and stores:

- flow identity
- current step
- payload snapshot
- creation/expiry timestamps
- optimistic version
- optional chat ID

Higher-level resume behavior is built on top of this contract rather than embedding application-specific workflow logic into core.

## Mini App Layer

The Mini App layer is split between raw runtime hooks and UI primitives.

### `@teleforge/web`

This package is responsible for:

- Telegram SDK access
- SSR-safe defaults
- launch/capability interpretation
- route guards
- flow resume and return-to-chat helpers

Typical entry points are:

- `useTelegram()`
- `useLaunch()`
- `useTheme()`
- `useMainButton()`
- `useManifestGuard()`
- `CoordinationProvider`

### `@teleforge/ui`

This package sits on top of `@teleforge/web` and converts Telegram state into reusable React UI primitives.

Responsibilities:

- viewport-aware shells
- theme-aware cards, text, inputs, and buttons
- view-level launch-mode boundaries
- settings-style rows and native-feeling controls

It does not own Telegram data or security logic. It consumes them.

## Bot Layer

`@teleforge/bot` owns Telegram update handling and the bot-facing half of coordinated flows.

Key responsibilities:

- middleware-capable routing
- command registration and dispatch
- typed `web_app_data` parsing
- default reply helpers
- webhook handler adapters

The bot layer is where chat-native entry points usually start. It can:

- send users into a Mini App
- receive structured payloads back
- reconnect users to saved flows

## BFF Layer

`@teleforge/bff` provides a Telegram-aware backend-for-frontend surface.

Its architecture has four main parts:

### Route Definition

`defineBffRoute()` captures route metadata such as:

- method
- path
- auth requirements
- launch-mode requirements
- service or handler execution style
- optional completion behavior

### Request Context

`createBffRequestContext()` normalizes inbound request state into one object containing:

- headers and body accessors
- Telegram launch metadata
- parsed `initData`
- auth/session state
- response state helpers

This avoids scattering Telegram request parsing through route code.

### Middleware

Built-in middleware handles:

- auth enforcement
- launch-mode enforcement
- cache wrappers
- execution timeouts
- identity resolution
- session validation

### Adapters and Sessions

Service adapters let BFF routes proxy or orchestrate downstream services, while session helpers manage exchange, refresh, and revoke flows for app sessions derived from Telegram identity.

## Flow Coordination Architecture

One of Teleforge's most specific V1 features is chat-to-Mini-App coordination.

The architecture spans packages:

```text
@teleforge/core
  -> route coordination metadata
  -> signed flow context
  -> flow-state contract

@teleforge/web
  -> CoordinationProvider
  -> FlowResumeProvider
  -> returnToChat / completeFlow / resumeFlow

@teleforge/bot
  -> chat primitives
  -> web_app_data handling
  -> return/completion templates
```

Typical lifecycle:

1. A bot command opens the Mini App.
2. The Mini App receives launch context and optional signed flow metadata.
3. `CoordinationProvider` and `FlowResumeProvider` reconstruct or persist flow state.
4. The user completes a step in the Mini App.
5. The result is returned to chat, transmitted to a BFF endpoint, or sent through `web_app_data` depending on the flow.
6. The bot or app resumes from the saved flow state if needed later.

The reference implementation for this lifecycle is `apps/task-shop`.

## Local Tooling Architecture

`@teleforge/devtools` is not part of application runtime, but it is part of the framework architecture because it understands the manifest and the development workflow.

It provides:

- `teleforge dev` for local web development with Telegram mock injection
- `teleforge dev --public --live` for HTTPS and tunnel-based Telegram testing
- `teleforge mock` for standalone Telegram environment simulation
- `teleforge doctor` for environment and manifest diagnostics

This means local iteration is aligned with the same manifest and launch model as the runtime packages.

## Reference Applications

The repo contains two important reference applications.

### `examples/starter-app`

Use this when you need:

- the smallest working Teleforge app
- one Mini App screen
- one `/start` bot command
- a minimal mock-friendly workflow

### `apps/task-shop`

Use this when you need to understand:

- full chat/Mini App coordination
- resumable flow state
- typed order payloads
- route protection and checkout flow

## What This Architecture Does Not Claim

This document intentionally does not describe:

- a plugin loading system
- a general payments abstraction
- observability infrastructure beyond what is already in the repo
- deployment presets beyond the current build/release setup

Those areas were discussed in planning but are not part of the implemented V1 architecture described here.
