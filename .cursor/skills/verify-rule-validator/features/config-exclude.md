# Config exclude

A `rule-validator.config.json` with global `exclude` patterns skips matching files while still scanning the rest of the workspace.

## Sub-features

- `exclude-skips` files under an excluded glob do not appear in results.
- `exclude-keeps` non-excluded sibling files still report violations.
- `exclude-discover` config is found by walking up from the CLI cwd.

## How to get to it (user POV)

- Place `rule-validator.config.json` at the project root (or an ancestor of cwd) with `"exclude": ["skip/**"]`.
- Run `bun run src/cli.ts "**/*.ts" --json` from that project.

## Driving it with verify.ts

Preconditions:

- Doctor ok.
- Seed completed: scratch has `rule-validator.config.json` with `exclude: ["skip/**"]`, plus `keep/shown.ts` and `skip/hidden.ts` both containing the same concatenation violation.

- **Scoped scan.** Run `bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <RUN_ID> --pattern "**/*.ts" --json --label config-exclude`. Parsed stdout has `fileCount` `1` (or otherwise only `keep/shown.ts` among violated files). `violations` reference `keep/shown.ts` and must not reference `skip/hidden.ts`.
- **Proof.** Artifact shows `errorCount` `1` and path `keep/shown.ts` only for this pair.

## Gotchas

- Seed already writes the exclude config; rewriting it mid-run without a re-scan is not proof.
- Built-in excludes (`node_modules`, `dist`, `__fixtures__`, `*.test.ts`, …) still apply; global config **appends**, it does not remove them.
- If cwd is not the scratch root, discovery may miss the seeded config — always drive via the helper (cwd = scratch).
