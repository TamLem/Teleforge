# Security Policy

## Supported Versions

Security fixes are applied to the current main branch and the latest published package line. Earlier snapshots may receive guidance, but fixes are not guaranteed.

## Reporting a Vulnerability

If you believe you have found a security issue in Teleforge:

1. Do not open a public GitHub issue.
2. Send a private report to the maintainers using the contact process configured for the canonical repository.
3. Include the affected package, version, reproduction details, impact, and any suggested remediation.

If the canonical reporting channel has not been configured yet, treat the repository as not ready for public vulnerability disclosure handling and coordinate privately with the maintainers before publishing details.

## What to Include

- affected package or command
- exact version or commit if known
- attack preconditions
- proof of concept or reproduction steps
- expected impact
- suggested fix, if available

## Response Expectations

Maintainers should acknowledge receipt as quickly as practical, assess severity, work on a fix, and coordinate disclosure timing with the reporter whenever possible.

## Sensitive Data

Never include live bot tokens, webhook secrets, production `initData`, or private user data in issues, pull requests, logs, screenshots, or test fixtures.
