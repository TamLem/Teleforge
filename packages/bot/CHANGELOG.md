# @teleforgex/bot

## 0.2.0

### Minor Changes

- 2fa207c: Add shared phone-number auth utilities across Teleforge.

  Core now exposes normalized phone-number helpers, signed phone-auth tokens, and launch parsing support for `tfPhoneAuth`. Web exposes the parsed launch token through `useLaunch()`. Bot adds reply-keyboard contact request helpers, self-shared contact extraction, and signed phone-auth Mini App links. BFF centralizes identity resolution behind a provider-backed identity manager and adds a phone-auth exchange handler that issues sessions from the signed phone token flow.

### Patch Changes

- Updated dependencies [2fa207c]
  - @teleforgex/core@0.2.0

## 0.1.0

### Minor Changes

- 444df20: Prepare the next Teleforge framework release with the current post-1.0 work:
  - add the new `@teleforgex/bff` package to the coordinated framework release line
  - ship the simulator-first local development workflow and improved tunnel support
  - ship callback-query, scenario, replay, and diagnostics improvements in the simulator
  - ship the completed developer documentation set, including Telegram basics, first-feature, coordination, testing, deployment, and env-var guides

### Patch Changes

- Updated dependencies [444df20]
  - @teleforgex/core@0.1.0
