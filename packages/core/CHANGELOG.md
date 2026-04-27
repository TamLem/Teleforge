# @teleforgex/core

## 0.2.0

### Minor Changes

- **Removed**: `UserFlowStateManager`, `FlowInstance`, `FlowTransitionResult`, `advanceStep` — the step-machine persistence layer is replaced by the action-first model.
- **Removed**: `MemoryStorageAdapter`, `RedisStorageAdapter`, `createFlowStorage`, `createStorage` — storage APIs are no longer part of the public core surface.
- **Removed**: old storage types (`Effect`, `EffectType`, `EncryptedState`, `RuntimeSignal`, `StorageAdapter`, `StorageBackend`, `StorageOptions`, `TransitionResult`, `ResumeFlowError`, `ResumeFlowResult`, `FlowStateResolver`) — no longer exported.

### New

- **Action context types**: `ActionContextToken`, `ActionResult`, `ActionEffect`, `ActionEffectType`, `ActionHandler`, `ActionHandlerContext`, `ActionHandlerDefinition`, `SignActionContextParams`, `SignContextFn`
- **Action context signing**: `createSignedActionContext`, `verifySignedActionContext`, `validateActionContext`, `decodeActionContextToken` (prefix `tfp2`)
- **Session types**: `TeleforgeSession`, `SessionHandle`, `SessionStorageAdapter`
- **Session manager**: `SessionManager` with `create`, `get`, `cancel` and session key utilities
- **Session storage adapter**: `MemorySessionStorageAdapter`

### Patch Changes

- Updated dependencies

- 2fa207c: Add shared phone-number auth utilities across Teleforge.

  Core now exposes normalized phone-number helpers, signed phone-auth tokens, and launch parsing support for `tfPhoneAuth`. Web exposes the parsed launch token through `useLaunch()`. Bot adds reply-keyboard contact request helpers, self-shared contact extraction, and signed phone-auth Mini App links. Server hooks centralize identity resolution behind a provider-backed identity manager and add a phone-auth exchange handler that issues sessions from the signed phone token flow.

## 0.1.0

### Minor Changes

- 444df20: Prepare the next Teleforge framework release with the current post-1.0 work:
  - expand the coordinated framework release line
  - ship the simulator-first local development workflow and improved tunnel support
  - ship callback-query, scenario, replay, and diagnostics improvements in the simulator
  - ship the completed developer documentation set, including Telegram basics, first-feature, coordination, testing, deployment, and env-var guides
