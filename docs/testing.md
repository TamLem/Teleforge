# Testing Teleforge Apps

Teleforge uses lightweight project-native testing, not a framework-specific abstraction layer.

Most generated and sample tests use:

- Node's built-in test runner
- `tsx` for TypeScript execution
- direct rendering or direct runtime invocation instead of deep mocking stacks

## What to Test

For most apps, split tests into three layers:

### Bot Tests

Put these in `apps/bot/test`.

Test:

- command handlers
- callback handling
- `web_app_data` parsing and replies
- preview-mode behavior when `BOT_TOKEN` is absent

The generated scaffold already includes a `/start` test. Treat that as the baseline pattern.

### Web Tests

Put these in `apps/web/test`.

Test:

- route rendering
- hook-driven launch mode behavior
- guards and fallback views
- `TeleforgeMiniApp` screen resolution and step progression
- state transformations that do not require a real browser

The scaffold's page render test is the simplest example.

### Integration Tests

Use these when the value is in the flow, not just the unit.

In this repo, `apps/task-shop/tests/integration` is the best example:

- command -> Mini App -> return flow
- resume-state behavior
- `web_app_data` handling
- server-backed flow behavior where a step needs trusted execution

## Running Tests

Generated apps expose:

```bash
pnpm test
```

Repository-wide verification uses:

```bash
pnpm test
pnpm build
pnpm check
pnpm docs:build
```

## Testing Against the Simulator

For most day-to-day work:

- use `teleforge dev`
- trigger commands in the simulator chat
- use fixtures and Replay Last to reproduce local flows quickly

This is the fastest way to validate:

- bot replies
- callback behavior
- Mini App route behavior
- coordination entry and return flows
- step progression and handoff/resume behavior

## Testing Against Real Telegram

Use `teleforge dev --public --live` when you need to validate:

- real Telegram launch context
- native WebApp behavior
- device-specific issues
- public HTTPS accessibility

That is validation, not your default test loop.

## Suggested Test Progression for New Features

When adding a feature:

1. add a bot or web smoke test next to the generated examples
2. validate the flow in the simulator
3. add an integration test if the feature crosses chat + Mini App boundaries
4. add a server-hook bridge test if the feature needs trusted guards/loaders/submits/actions
5. use live Telegram only for final behavior checks

## Good First Tests

If you are unsure what to write first, start with:

- bot: "command returns the expected text/button"
- web: "page renders the expected heading"
- coordination: "completion payload leads to the expected chat reply"

That keeps the test surface small while still proving the feature works.
