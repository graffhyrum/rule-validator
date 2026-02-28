---
"@graff/rule-validator": minor
---

Add no-non-null-assertion rule to ban the ! operator

New ESLint-style rule that disallows non-null assertions. Provides helpful
message suggesting use of assertDefined() utility instead.

Includes:
- Rule implementation in src/rules/no-non-null-assertion.ts
- Test coverage in src/rules/no-non-null-assertion.test.ts
- assertDefined utility in src/assertions.ts for user reference
