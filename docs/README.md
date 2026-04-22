# Teleforge Documentation

Teleforge now has two documentation layers:

- narrative developer docs in this `docs/` directory
- generated API reference in the built docs site under `dist/docs-site/api/`

Use the narrative docs first if you are trying to understand how the framework fits together or how to start building with it.

## Guides

- [Telegram Mini App Basics](./telegram-basics.md): plain-language primer on Mini Apps, `initData`, launch modes, `web_app_data`, and BotFather
- [Getting Started](./getting-started.md): fastest path from clone to a working Teleforge app
- [Developer Guide](./developer-guide.md): setup, daily workflow, public imports, and common implementation patterns
- [Flow-First Developer Experience](./flow-first-dx.md): product direction for evolving Teleforge toward flow-first authoring and a more unified framework model
- [Flow-First V2 Migration Plan](./flow-first-migration.md): breaking migration plan for replacing the V1 manifest-first, package-first model with a unified flow-first framework
- [Mini App Architecture Guidelines](./miniapp-architecture.md): 18 rules for building Teleforge Mini App frontends — screen runtime, lazy loading, state boundaries, and deployment flexibility
- [Flow-First Execution Handoff Plan](./flow-first-execution-plan.md): takeover-grade execution plan for the remaining V2 implementation gaps after the current continuity and server-hook slices
- [Build Your First Feature](./first-feature.md): guided command + route tutorial for scaffolded apps
- [Flow Coordination](./flow-coordination.md): annotated walkthrough of Teleforge's chat -> Mini App -> chat lifecycle using Task Shop
- [Flow State Design](./flow-state-design.md): storage model, FlowInstance lifecycle, effects, and execution architecture
- [Server Hooks and Backend Internals](./bff-guide.md): advanced guide for trusted server-backed flow hooks
- [Shared Phone Auth](./shared-phone-auth.md): end-to-end phone-number auth flow using bot contact sharing, Mini App launch tokens, and trusted server exchange
- [Testing](./testing.md): how Teleforge apps are tested and how to add your own bot/web/integration tests
- [Deployment](./deployment.md): production build, hosting, polling vs webhook, and rollout checklist
- [Environment Variables](./environment-variables.md): central reference for app and devtools env vars
- [Architecture](./architecture.md): package boundaries, runtime surfaces, flow-first behavior, and coordination flow
- [Config Reference](./manifest-reference.md): complete `teleforge.config.ts` and `defineFlow()` schema reference
- [Troubleshooting](./troubleshooting.md): common local-dev, validation, route, and server-hook failures

## API Reference

- Build the docs locally with `pnpm docs:build`
- Open the narrative site at `dist/docs-site/index.html`
- Open the generated TypeDoc API reference at `dist/docs-site/api/index.html`

The API docs are useful once you already know which package or hook you need. They are not a substitute for the usage and architecture guides above.
