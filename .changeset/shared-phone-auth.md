---
"@teleforgex/core": minor
"@teleforgex/web": minor
"@teleforgex/bot": minor
---

Add shared phone-number auth utilities across Teleforge.

Core now exposes normalized phone-number helpers, signed phone-auth tokens, and launch parsing support for `tfPhoneAuth`. Web exposes the parsed launch token through `useLaunch()`. Bot adds reply-keyboard contact request helpers, self-shared contact extraction, and signed phone-auth Mini App links. Server hooks centralize identity resolution behind a provider-backed identity manager and add a phone-auth exchange handler that issues sessions from the signed phone token flow.
