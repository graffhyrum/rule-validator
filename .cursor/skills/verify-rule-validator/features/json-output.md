# JSON output

`--json` prints one JSON object on stdout and uses exit `1` only when `errorCount > 0`, so tools can parse results without scraping colors.

## Sub-features

- `json-shape` includes `errorCount`, `warningCount`, `fileCount`, and `violations`.
- `json-violation-fields` each violation has `file`, `line`, `column`, `rule`, `message`, `severity` (and usually `match`).
- `json-exit` matches `errorCount`: dirty → exit `1`, clean → exit `0`.

## How to get to it (user POV)

- Append `--json` to any scan: `bun run src/cli.ts <pattern> --json`.

## Driving it with verify.ts

Preconditions:

- Doctor ok; scratch seeded.

- **Dirty JSON.** Run `bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <RUN_ID> --pattern dirty.ts --json --label json-dirty`. Stdout is one JSON object; `exitCode` `1`; `violations.length === errorCount + warningCount` for this seed (warnings may be `0`).
- **Clean JSON.** Run `bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <RUN_ID> --pattern clean.ts --json --label json-clean`. `exitCode` `0`; `violations` is `[]`.
- **Proof.** Parse both artifact stdout bodies. Confirm field names above without relying on human-mode formatting.

## Gotchas

- Human mode still prints when `--json` is absent; do not mix modes in one assertion.
- Combined regex + AST results are deduplicated before JSON emit; counts come from the combined set.
- Stderr may be empty on success; config failures put the message on stderr instead of a violations array.
