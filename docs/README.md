# Teleforge Documentation

Teleforge now has two documentation layers:

- narrative developer docs in this `docs/` directory
- generated API reference in the built docs site under `dist/docs-site/api/`

Use the narrative docs first if you are trying to understand how the framework fits together or how to start building with it.

## Guides

- [Telegram Mini App Basics](./telegram-basics.md): plain-language primer on Mini Apps, `initData`, launch modes, `web_app_data`, and BotFather
- [Getting Started](./getting-started.md): fastest path from clone to a working Teleforge app
- [Developer Guide](./developer-guide.md): setup, runtime modes, daily workflow, and common implementation patterns
- [Build Your First Feature](./first-feature.md): guided command + route tutorial for scaffolded apps
- [Flow Coordination](./flow-coordination.md): annotated walkthrough of Teleforge's chat -> Mini App -> chat lifecycle using Task Shop
- [BFF Mode Guide](./bff-guide.md): practical guide for turning the generated BFF scaffold into a real backend surface
- [Testing](./testing.md): how Teleforge apps are tested and how to add your own bot/web/integration tests
- [Deployment](./deployment.md): production build, hosting, polling vs webhook, and rollout checklist
- [Environment Variables](./environment-variables.md): central reference for app and devtools env vars
- [Architecture](./architecture.md): package boundaries, runtime surfaces, manifest-driven behavior, and coordination flow
- [Manifest Reference](./manifest-reference.md): complete `teleforge.app.json` field reference for the current schema
- [Troubleshooting](./troubleshooting.md): common local-dev, validation, route, and BFF failures

## API Reference

- Build the docs locally with `pnpm docs:build`
- Open the narrative site at `dist/docs-site/index.html`
- Open the generated TypeDoc API reference at `dist/docs-site/api/index.html`

The API docs are useful once you already know which package or hook you need. They are not a substitute for the usage and architecture guides above.
