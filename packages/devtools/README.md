# `packages/devtools`

Internal Teleforge implementation layer for CLI, doctor checks, and tunnel support.

App authors use the CLI from the unified `teleforge` package:

```bash
teleforge dev
teleforge dev --public --live
teleforge doctor
```

This workspace package remains separate so framework maintainers can test local tooling independently.
