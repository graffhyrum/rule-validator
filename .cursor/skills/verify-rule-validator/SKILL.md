---
name: verify-rule-validator
description: Drive the rule-validator CLI the way a user does — scan files, JSON output, config excludes, and config errors — and capture transcript evidence. Use when proving CLI behavior after changes to scanning, rules, config, or exit codes.
---

# Verify rule-validator

Primary surface: **CLI** (`bun run src/cli.ts` / `bun run validate`). Secondary: library API (`scanFiles` / `scanFile`) — not covered here; use unit tests for that.

This skill drives the real CLI from an **isolated scratch directory**. Never scan the repo tree as the proof target: default excludes skip `__fixtures__` and `*.test.ts`, and a shared cwd can pick up unrelated files.

## Launch

No long-lived server. Each drive is one CLI process.

1. From repo root, require Bun and a working CLI:

```shell
bun .cursor/skills/verify-rule-validator/scripts/verify.ts doctor
```

Ready when stdout JSON has `"ok": true` and `cliVersion` matches `package.json` `version`.

2. Seed a disposable workspace (creates files + default exclude config):

```shell
bun .cursor/skills/verify-rule-validator/scripts/verify.ts seed --run-id <RUN_ID>
```

Scratch path: `%TEMP%/rv-verify-<RUN_ID>` (printed in seed JSON as `scratch`).

Teardown after the run: see **Cleanup**. Do not leave scratch dirs behind.

## Doctor

Run first whenever a drive looks wrong:

```shell
bun .cursor/skills/verify-rule-validator/scripts/verify.ts doctor
```

Pass criteria: Bun available; `bun run src/cli.ts --version` equals package version; artifacts dir writable. Fail → fix env/build before driving.

Optional: confirm scratch exists after seed via `path --run-id <RUN_ID>`.

## Drive

Harness: the verify script wraps `bun run <repo>/src/cli.ts` with `cwd` set to the scratch dir.

```shell
bun .cursor/skills/verify-rule-validator/scripts/verify.ts scan --run-id <RUN_ID> --pattern <glob> [--json] [--label <name>]
```

- Prefer `--json` for stable assertions (`errorCount`, `warningCount`, `fileCount`, `violations[]` with `file`, `line`, `column`, `rule`, `severity`).
- Human mode (no `--json`) is for proof of the user-visible report and summary line.
- Patterns are relative to the scratch cwd (e.g. `dirty.ts`, `clean.ts`, `**/*.ts`).
- Read feature recipes under `features/` before improvising. Drive one mapped feature per proof unless the task asks for more.

Helper always writes evidence under `.cursor/skills/verify-rule-validator/artifacts/<RUN_ID>/` even when the CLI exits `1`.

## Evidence

Location: `.cursor/skills/verify-rule-validator/artifacts/<RUN_ID>/`

| File           | Contents                                          |
| -------------- | ------------------------------------------------- |
| `seed.json`    | Scratch path and seeded file list                 |
| `<label>.json` | Command, cwd, exitCode, stdout, stderr, timestamp |
| `<label>.txt`  | Same transcript as plain text                     |

Proof standards:

- Exercise the real CLI entry (`src/cli.ts`), not mocked `scanFiles` unit tests.
- Capture the invoking command **and** the resulting exit code / JSON body (or human summary).
- For mutations of config/files, re-scan and show the second result; do not trust seed alone.
- Side effects to verify: exit code `0` vs `1`, which files appear in `violations` / `fileCount`, stderr for config failures.
- Repo `__fixtures__` and `*.test.ts` are **excluded by default** — proofs that depend on them without empty `excludePatterns` are invalid for the user CLI path.

## Cleanup

```shell
bun .cursor/skills/verify-rule-validator/scripts/verify.ts cleanup --run-id <RUN_ID>
```

Removes only `%TEMP%/rv-verify-<RUN_ID>`. **Keeps** `.cursor/skills/verify-rule-validator/artifacts/<RUN_ID>/`. Never kill by process name; each scan is already short-lived.

## Helpers

Script: `.cursor/skills/verify-rule-validator/scripts/verify.ts`

| Command                                                         | Purpose                              |
| --------------------------------------------------------------- | ------------------------------------ |
| `doctor`                                                        | Read-only health check               |
| `seed --run-id <id>`                                            | Create isolated scratch + seed files |
| `path --run-id <id>`                                            | Print scratch and artifact paths     |
| `scan --run-id <id> --pattern <glob> [--json] [--label <name>]` | Run CLI; write transcript            |
| `cleanup --run-id <id>`                                         | Delete scratch; keep artifacts       |

Feature map: `.cursor/skills/verify-rule-validator/features/`.
