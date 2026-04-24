# Teleforge Documentation

Teleforge docs are organized around the current flow-first framework path.

Use the app-author path first if you are building a product. Use reference docs when you need exact API, config, runtime, or deployment details.

## App Author Path

- [Telegram Mini App Basics](./telegram-basics.md): plain-language primer on Mini Apps, `initData`, launch modes, `web_app_data`, and BotFather
- [Getting Started](./getting-started.md): fastest path from clone to a working Teleforge app
- [Developer Guide](./developer-guide.md): setup, daily workflow, public imports, and common implementation patterns

## Build Guides

- [Build Your First Feature](./first-feature.md): guided command and screen tutorial for scaffolded apps
- [Flow Coordination](./flow-coordination.md): current chat to Mini App to chat lifecycle and default runtime wiring
- [Server Hooks](./server-hooks.md): trusted server-backed flow hooks and optional `--with-api` structure
- [Shared Phone Auth](./shared-phone-auth.md): phone-number auth using bot contact sharing, Mini App launch tokens, and trusted server exchange
- [Testing](./testing.md): how Teleforge apps are tested and how to add your own bot/web/integration tests

## Operations

- [Deployment](./deployment.md): production build, hosting, polling vs webhook, and rollout checklist
- [Environment Variables](./environment-variables.md): central reference for app and devtools env vars
- [Troubleshooting](./troubleshooting.md): common local-dev, validation, route, and server-hook failures

## Reference

- [Framework Model](./framework-model.md): flow-first authoring model, runtime surfaces, and public imports
- [Config Reference](./config-reference.md): `teleforge.config.ts`, `defineFlow()`, discovery conventions, and environment variables
- [Mini App Architecture](./miniapp-architecture.md): screen runtime, state boundaries, frontend delivery, and Telegram capability rules
- [Flow State Architecture](./flow-state-design.md): storage model, FlowInstance lifecycle, effects, and execution architecture

## Examples

- [Starter App](../examples/starter-app/README.md): smallest runnable example
- [Task Shop](../apps/task-shop/README.md): full reference app with chat/Mini App coordination

## API Reference

- Build the docs locally with `pnpm docs:build`
- Open the narrative site at `dist/docs-site/index.html`
- Open the generated TypeDoc API reference at `dist/docs-site/api/index.html`

The API docs are useful once you already know which public package surface or hook you need. They are not a substitute for the usage and architecture guides above.
