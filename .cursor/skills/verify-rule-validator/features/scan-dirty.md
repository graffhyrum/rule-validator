# Scan dirty files

A user points the CLI at TypeScript that breaks rules and gets a non-zero exit with each violation listed by file, line, column, rule, and message.

## Sub-features

- `scan-dirty-human` prints a human report and summary, then exits `1` when errors exist.
- `scan-dirty-json` returns the same findings as JSON with `errorCount > 0`.
- `scan-dirty-rules` surfaces at least template-literals-only, no-static-classes, and no-non-null-assertion from the seeded `dirty.ts`.

## How to get to it (user POV)

- From a project directory: `bun run validate "dirty.ts"` or `bun run src/cli.ts dirty.ts`.
- With JSON: add `--json`.

## Driving it with verify.ts

Preconditions:

- `verify.ts doctor` reports `"ok": true`.
- `verify.ts seed --run-id <RUN_ID>` completed; scratch contains `dirty.ts`.

- **Human report.** Scan the dirty file. Run `bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <RUN_ID> --pattern dirty.ts --label scan-dirty-human`. Artifact `scan-dirty-human.json` has `exitCode` `1`. Stdout names `dirty.ts`, includes `template-literals-only`, and ends with a fix-errors style summary.
- **JSON report.** Scan again with JSON. Run `bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <RUN_ID> --pattern dirty.ts --json --label scan-dirty-json`. Artifact stdout parses as JSON with `errorCount >= 3`, `fileCount` `1`, and `violations` entries whose `rule` values include `template-literals-only`, `no-static-classes`, and `no-non-null-assertion`.
- **Proof.** Keep both artifacts under `.cursor/skills/verify-rule-validator/artifacts/<RUN_ID>/`. Confirm `exitCode` is `1` in each transcript.

## Gotchas

- Seeding into the repo tree is wrong; always use the helper scratch under `%TEMP%/rv-verify-<RUN_ID>`.
- Default excludes hide `__fixtures__` — do not substitute `known-bad.ts` for this proof.
- The helper's process exit is `0` after capturing a CLI exit of `0` or `1`; assert the transcript `exitCode`, not the helper's status.
