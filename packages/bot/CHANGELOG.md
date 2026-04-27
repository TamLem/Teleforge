# @teleforgex/bot

## 0.2.0

### Minor Changes

- **Removed**: `initiateCoordinatedFlow`, `handleMiniAppReturn`, `handleMiniAppReturnData` — step-machine coordination replaced by action-first primitives.

### New

- `createSignedActionContextToken`, `createActionCallbackData`, `verifyActionCallback` — create and verify signed action context callback data for inline keyboards
- `createMiniAppLaunchUrl`, `createMiniAppLaunchButton` — construct Mini App launch URLs with signed action context
- `TelegramReplyKeyboardRemove` added to `TelegramReplyMarkup` union

### Patch Changes

- Updated dependencies

- 2fa207c: Add shared phone-number auth utilities across Teleforge.

  Core now exposes normalized phone-number helpers, signed phone-auth tokens, and launch parsing support for `tfPhoneAuth`. Web exposes the parsed launch token through `useLaunch()`. Bot adds reply-keyboard contact request helpers, self-shared contact extraction, and signed phone-auth Mini App links. Server hooks centralize identity resolution behind a provider-backed identity manager and add a phone-auth exchange handler that issues sessions from the signed phone token flow.

### Patch Changes

- Updated dependencies
- Updated dependencies [2fa207c]
  - @teleforgex/core@0.2.0

## 0.1.0

### Minor Changes

- 444df20: Prepare the next Teleforge framework release with the current post-1.0 work:
  - expand the coordinated framework release line
  - ship the simulator-first local development workflow and improved tunnel support
  - ship callback-query, scenario, replay, and diagnostics improvements in the simulator
  - ship the completed developer documentation set, including Telegram basics, first-feature, coordination, testing, deployment, and env-var guides

### Patch Changes

- Updated dependencies [444df20]
  - @teleforgex/core@0.1.0
