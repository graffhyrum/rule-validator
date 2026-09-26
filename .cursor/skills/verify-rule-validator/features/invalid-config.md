# Invalid config

A malformed or schema-invalid `rule-validator.config.json` stops the scan with a clear error and exit `1` instead of silent defaults.

## Sub-features

- `invalid-json` bad JSON text yields `not valid JSON` on stderr and exit `1`.
- `invalid-schema` valid JSON that fails the schema yields `is invalid` on stderr and exit `1`.

## How to get to it (user POV)

- Put a broken `rule-validator.config.json` in the project root.
- Run any scan from that directory.

## Driving it with verify.ts

Preconditions:

- Doctor ok.
- Seed once, then overwrite the scratch config before scanning (seed creates a valid config).

- **Break JSON.** From a small shell step, write `{not json` into `<scratch>/rule-validator.config.json` (path from `verify.ts path --run-id <RUN_ID>`).
- **Scan.** Run `bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <RUN_ID> --pattern clean.ts --json --label invalid-config`. Transcript `exitCode` is `1`. Stderr contains `rule-validator.config.json` and `not valid JSON`.
- **Proof.** Artifact `invalid-config.json` shows empty or unused stdout for the scan body and the error text on stderr — no silent `errorCount: 0` success.

## Gotchas

- After this feature, re-`seed` before proving other features; the scratch config is intentionally corrupted.
- Schema failures use a different message (`is invalid`); do not assert only the JSON-parse wording for schema cases.
- Walking up the tree: a valid config in a parent directory can shadow a missing local file — keep the broken file at the scratch root and drive with cwd = scratch.
