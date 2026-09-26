# Scan clean files

A user points the CLI at TypeScript that passes all rules and gets exit `0` with a green pass summary (human) or empty violations (JSON).

## Sub-features

- `scan-clean-human` prints `All N files passed (... rules checked).` and exits `0`.
- `scan-clean-json` returns `errorCount` `0`, `warningCount` `0`, and `violations` `[]`.

## How to get to it (user POV)

- `bun run src/cli.ts clean.ts`
- `bun run src/cli.ts clean.ts --json`

## Driving it with verify.ts

Preconditions:

- Doctor ok; scratch seeded with `clean.ts`.

- **Human pass.** Run `bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <RUN_ID> --pattern clean.ts --label scan-clean-human`. Transcript `exitCode` is `0`. Stdout contains `All 1 files passed`.
- **JSON pass.** Run `bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <RUN_ID> --pattern clean.ts --json --label scan-clean-json`. Parsed stdout has `errorCount` `0`, `fileCount` `1`, `violations` `[]`.
- **Proof.** Both labels under `artifacts/<RUN_ID>/` show exit `0` and no error findings.

## Gotchas

- Warnings alone still exit `0`; this feature requires zero errors **and** zero warnings on `clean.ts`.
- Do not use a broad `**/*.{ts,tsx,js,jsx}` pattern against the repo — that is a different workload and not this feature's proof.
