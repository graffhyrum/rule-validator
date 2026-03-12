# Post-Mortem: fileGuard + bun link discovery

**Date**: 2026-03-05
**Status**: Completed

## Executive Summary

Implemented a `fileGuard` mechanism on the `Rule` interface to suppress `no-raw-response-in-elysia` warnings in files that don't import from elysia. After the implementation passed all tests, deploying revealed that the globally-installed `rule-validator` binary was a stale compiled standalone executable — not connected to the workspace source. Investigation identified the root cause as the package never having been registered via `bun link`. The fix was to run `bun link` in the workspace, which replaced the 113 MB compiled binary with a symlink into `dist/cli.js`. A follow-up check confirmed `stepdown-rule` was already correctly linked.

## Bead Outcomes

- Closed: none
- Opened: none
- Modified: none (no bead tracked this work)

## What Went Well

1. **fileGuard design was minimal and correct** — Adding an optional `(content: string) => boolean` field to `Rule` required no new files, no architectural changes, and the full suite stayed green first run after fixing the test isolation issue.
2. **Test isolation issue caught quickly** — The `ACTUAL_RULES` import in `rules.test.ts` was intercepted by `mock.module` in the full suite, failing the two new tests. The root cause (the file comment itself warned about this pattern) was identified immediately and the guard was inlined.
3. **Binary type diagnosis was direct** — `ls -la` on the installed binary immediately revealed it was 113 MB (compiled) rather than a symlink, pointing to the root cause without any guessing.
4. **`bun link` docs confirmed the fix** — A single context7 query on `bun link` confirmed that `bun link` in the package root creates a bin symlink into `dist/`, meaning `bun run build` alone keeps the global command current thereafter.

## What Could Improve

1. **No prompt covered deployment after implementation**
   - **Impact**: The plan said "verify with `bun test` + `bunx tsc --noEmit`" but said nothing about deploying the built output. The user had to run the tool against `~/.claude/` and observe stale output before the gap was found.
   - **Mitigation**: Plans for CLI tools should include a deployment verification step: confirm that the globally-available binary reflects the build (e.g., check if it's a symlink vs. a compiled binary before signing off).

2. **`bun link` setup not part of project bootstrap record**
   - **Impact**: The stale binary had existed since March 3 — two full sessions ran without noticing it. Any fix to the scanner logic would have been invisible to the real-world invocation.
   - **Mitigation**: Add `bun link` status (symlink vs. compiled binary) to the project bootstrap checklist or MEMORY.md. Projects with `bin` entries should always be linked during initial setup.

3. **First test run showed 26 pass despite 2 new tests being added**
   - **Impact**: Running `bun test src/rules.test.ts` in isolation masked the `mock.module` interference — the isolated run passed and gave false confidence before the full-suite run exposed the failure.
   - **Mitigation**: Always run the full suite (`bun test`) as the verification gate, not just the targeted file. The plan already specified this but the isolated run was done first as a quick check.

## Key Decisions

| Decision                                           | Rationale                                                                                                           | Outcome                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `fileGuard` as optional field on `Rule` interface  | Minimal change — no new abstraction, no AST conversion, rules without it are unaffected                             | Correct; tests green, false positives eliminated     |
| Inline guard in `rules.test.ts` rather than import | File-level comment warned against importing `./rules` due to `mock.module` interference in the full suite           | Correct; full suite went green after inlining        |
| Replace binary via `bun link` rather than re-`cp`  | `bun link` creates a symlink so future `bun run build` is sufficient — `cp` would require manual re-copy every time | Correct; confirmed symlink resolves to `dist/cli.js` |

## Lessons Learned

### Applicable Everywhere

- **After implementing a CLI change, verify the installed binary is symlinked, not compiled.** `ls -la $(which <tool>)` distinguishes a symlink (small, points to dist/) from a compiled binary (large, no arrow). A compiled binary will silently ignore all source changes.
- **`bun link` must be run in every local package that exposes a `bin` entry.** Without it, the global binary is either stale or absent. Run it once during initial project setup; it persists across rebuilds.
- **Run `bun test` (full suite) as the gate, not a targeted file.** Isolated file runs can pass while the full suite fails due to `mock.module` or other cross-file interference.

### Specific to This Work

- **`rules.test.ts` intentionally inlines patterns/functions** to avoid `mock.module` interference from `index.test.ts`. Any new test that needs access to the actual `RULES` array should inline the relevant data rather than importing from `./rules` or `./index`.
- **The `fileGuard` skip is computed once per file in `scanFile`, not per line.** This is the correct architecture — the guard is about file-level context, not line content. Don't move guard evaluation into `checkLineForViolations`.

## Recommendations

### Rule Changes

- Add to project MEMORY.md or CLAUDE.md: after any change to a CLI package, verify `which <binary>` is a symlink before running end-to-end verification. If it's a compiled binary, run `bun link` first.

### Skill Coverage

Skills suggested by `ms suggest`:

- `destructive-command-guard` (0.74)
- `debug` / `debug-error-analysis` (0.73 / 0.73)
- `toon` (0.72)

Skills actually loaded: none explicitly (work was direct implementation from a pre-written plan).

Gap: `debug` was marginally relevant for the binary diagnosis step, but the investigation was short enough that loading it would have added overhead without benefit.

### Automation Opportunities

- A post-build hook that checks `ls -la $(which rule-validator)` and warns if it's not a symlink would catch this class of issue automatically.
- The plan template for CLI tool changes should include a deployment verification step as a standard phase.

## Follow-up Actions

- [ ] Update MEMORY.md with the `bun link` / symlink verification note
- [ ] Consider adding a post-build check or note to project CLAUDE.md

## Related Threads

- `post-mortem-2026-03-04-config-exclusions.md` — prior session that added `ruleExcludes`; same verification gap could have occurred there
  </content>
  </invoke>
