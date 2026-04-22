# Teleforge Documentation

Teleforge documentation is organized around stable framework concepts:

- **Start**: Telegram basics, getting started, and the main developer workflow
- **Guides**: building features, coordinating chat/Mini App flows, trusted server hooks, testing, and deployment
- **Reference**: architecture, framework model, config, Mini App runtime, flow state, environment variables, and troubleshooting
- **Examples**: Starter App and Task Shop

Use the narrative docs first if you are learning the framework. Use the generated API reference after you know which public import surface you need.

## Start

- [Telegram Mini App Basics](./telegram-basics.md): plain-language primer on Mini Apps, `initData`, launch modes, `web_app_data`, and BotFather
- [Getting Started](./getting-started.md): fastest path from clone to a working Teleforge app
- [Developer Guide](./developer-guide.md): setup, daily workflow, public imports, and common implementation patterns
- [Developer Experience Roadmap](./developer-experience-roadmap.md): planned improvements for manifest generation, diagnostics, scaffold, devtools, testing, and framework thinning

## Guides

- [Build Your First Feature](./first-feature.md): guided command and screen tutorial for scaffolded apps
- [Flow Coordination](./flow-coordination.md): annotated walkthrough of Teleforge's chat → Mini App → chat lifecycle using Task Shop
- [Server Hooks and Backend Internals](./server-hooks.md): trusted server-backed flow hooks
- [Shared Phone Auth](./shared-phone-auth.md): phone-number auth using bot contact sharing, Mini App launch tokens, and trusted server exchange
- [Testing](./testing.md): how Teleforge apps are tested and how to add your own bot/web/integration tests
- [Deployment](./deployment.md): production build, hosting, polling vs webhook, and rollout checklist

## Reference

- [Framework Model](./framework-model.md): flow-first authoring model, runtime surfaces, and public imports
- [Config Reference](./config-reference.md): `teleforge.config.ts`, `defineFlow()`, discovery conventions, and environment variables
- [Mini App Architecture](./miniapp-architecture.md): screen runtime, state boundaries, frontend delivery, and Telegram capability rules
- [Flow State Architecture](./flow-state-design.md): storage model, FlowInstance lifecycle, effects, and execution architecture
- [Environment Variables](./environment-variables.md): central reference for app and devtools env vars
- [Troubleshooting](./troubleshooting.md): common local-dev, validation, route, and server-hook failures

## API Reference

- Build the docs locally with `pnpm docs:build`
- Open the narrative site at `dist/docs-site/index.html`
- Open the generated TypeDoc API reference at `dist/docs-site/api/index.html`

The API docs are useful once you already know which public package surface or hook you need. They are not a substitute for the usage and architecture guides above.
