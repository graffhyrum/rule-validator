---
"@graff/rule-validator": minor
---

Add Elysia framework rule and scripts exclusion

- Added `no-raw-response-in-elysia` rule to detect improper Response constructor usage in Elysia applications
- Added `scripts/**` to default file exclusions to prevent scanning build/utility scripts
