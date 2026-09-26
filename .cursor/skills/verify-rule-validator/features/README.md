# rule-validator verification map

Maintained source for verifying user-facing CLI behavior. Read this index, then the matching feature file.

## Baseline preconditions

- Run all drives from an isolated scratch created by `seed --run-id <RUN_ID>`.
- Put Bun on `PATH`. Use the repo's `src/cli.ts` via the verify helper (do not require a global `rule-validator` install).
- Run `verify.ts doctor` and require `"ok": true` with matching `cliVersion`.
- Never treat the repo working tree as the scan target for proof.
- Never use `src/rules/__fixtures__/**` or `*.test.ts` as the user-path proof: the CLI excludes them by default.

## Driving conventions

- Start every recipe from a fresh `seed` unless the feature says otherwise.
- Prefer `--json` for assertions; use human output when proving the printed report.
- Treat every command as literal. Keep `--run-id`, `--pattern`, and `--label` values unchanged when copying recipes.
- Restore nothing between scans in one feature unless the recipe mutates files; then re-seed or rewrite the file and re-scan.
- Cleanup removes scratch only. Keep artifacts under `.cursor/skills/verify-rule-validator/artifacts/<RUN_ID>/`.

## Proof and skip reporting

- Capture command, stdout, stderr, and exit code for every drive.
- Mutation / config proof includes a second scan that shows the changed result.
- Record the feature ID and `--label` with every artifact.
- Report an unreachable path with the attempted command and unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 and one paragraph of user-visible behavior, then exactly four H2s: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify.ts`, `Gotchas`.

## Features

- [Scan dirty files](./scan-dirty.md) — violations reported, exit `1`.
- [Scan clean files](./scan-clean.md) — pass message, exit `0`.
- [JSON output](./json-output.md) — machine-readable result shape.
- [Config exclude](./config-exclude.md) — global exclude skips matching paths.
- [Invalid config](./invalid-config.md) — malformed config fails with a clear error.
