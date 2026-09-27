# Post-Mortem: 214381fe-0755-4c4f-8675-99816ca87594

**Date**: 2026-09-26
**Status**: Completed

## Executive Summary

The session raised testability after the Bun function-coverage threshold moved to 95%, then added tests only for line-coverage gaps that can run. Deep-module boundaries, the `is` predicate rename, and the new tests landed. The full suite ended at 245 pass, 0 fail, 100% functions, and 99.68% lines. The lines that remain uncovered cannot complete: `import.meta.main`, a `while (true)` brace, and exhaustive `never` defaults.

## Bead Outcomes

- Closed: none
- Opened: none
- Modified: none

`br diff` returned no tracker diff. `br history` shows one empty backup from 2026-07-27. No open pull requests.

## What Went Well

1. **Reachable versus dead lines** - The user asked for a reason before more tests. The next request was only "add tests for what can run." Dead arms stayed untested, and the coverage report then showed only those lines.
2. **Entry-point tests** - File-io cases went through `preferBunFileIoRule`. They did not import `lib/`.
3. **Safe fs spy** - The non-ENOENT test throws only for a `rv-eacces-` path and forwards every other `fs.access` call. Parallel tests kept the real filesystem.
4. **Full-suite measurement** - `bun test --coverage` on the whole repo confirmed the target lines. A subset run is the wrong signal when the function threshold is global.

## What Could Improve

1. **Windows path error** - The first config test treated a file-as-directory as `ENOTDIR`. On Windows, `fs.access` returns `ENOENT`, `fileExists` returns false, and `loadProjectConfig` resolves.
   - **Impact**: One failed test and a rewrite.
   - **Mitigation**: For a non-ENOENT branch, spy `fs.promises.access`. Throw only for the fixture path. Forward every other call.
2. **Mocked printer** - The column-sort test searched `console.log` for `5:3`. In `src/cli.test.ts`, `printViolations` is mocked and logs only the file name.
   - **Impact**: The assertion saw `-1` for both columns.
   - **Mitigation**: Assert `printViolationsMock` call order: column 3, then column 20.
3. **Hook fail-closed** - `.cursor/hooks/dcg-guard.ps1` often returned no output. The shell blocked until a later retry.
   - **Impact**: Coverage and typecheck commands stalled.
   - **Mitigation**: Retry the same command. Do not change the hook without confirmation.

## Key Decisions

| Decision                                                                          | Rationale                                      | Outcome                                                  |
| --------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Leave `import.meta.main`, the `while (true)` brace, and `never` defaults untested | Those lines do not complete at runtime         | Coverage report lists only those lines                   |
| Spy `fs.access` with a path filter                                                | A real `ENOTDIR` path does not fail on Windows | Config line 59 runs; other tests still use real `access` |
| Assert the `printViolations` mock arguments                                       | The mock does not print `line:column`          | Column sort is checked in call order                     |
| Keep file-io tests on the package entry                                           | Deep-module rule `tests-through-entrypoints`   | Boundary lint stays valid                                |

## Lessons Learned

### Applicable Everywhere

- Measure a global Bun function-coverage threshold with the full test suite. A subset run executes imported files only in part and can fail the threshold.
- On Windows, `fs.access` reports `ENOENT` when an intermediate path component is a file. Test a non-ENOENT branch with a spy that throws only for the fixture path and forwards every other call.
- Do not add a test whose only target is a closing brace after `return` or `throw`, a `while (true)` brace, or an exhaustive `never` default.

### Specific to This Work

- `src/cli.test.ts` mocks `printViolations` to `console.log(file)` only. Sort order belongs on the mock's second argument.
- `type-predicate-name` flags an inline type-predicate arrow on an object property. A named `isX` function assigned to that property is allowed. Call sites stay `is.identifier`.
- File-io tests import `src/packages/file-io/index.ts` only.

## Remediation

### Remediation Hierarchy (mandatory)

The three cross-cutting lessons are short test rules. A hook cannot see "this assertion targets a dead brace." A script would reimplement the coverage reader. A new skill is heavier than the lesson. `cm add` stores them for later `cm context` injection. No always-loaded instruction change.

### Verification

- **Test**: `cm context "bun coverage windows fs.access never default" --json` returns the three new rules. `bun test --coverage` stays at 100% functions and leaves only `src/cli.ts` 68, `src/config.ts` 50, `src/rules/arktype-schema-strings.ts` 134-137, and `src/rules/type-predicate-name.ts` 145-148, 157-160.
- **Bypass mode**: `cm` rules do not run under `--no-verify`. They appear only when a later session loads `cm context`. The coverage command itself has no bypass: the threshold is in `bunfig.toml`.

### Skill Coverage

Skills relevant to this session (`ms suggest --machine --cwd .`): mutation-kill, debug-reprex, distributed-systems-patterns, audit, research.

Skills actually loaded: post-mortem (this request). Earlier in the same thread the user attached setup-ts-deep-modules, typescript-quality, and typescript-best-practices for the refactor. This test pass did not reload them.

Gap: none of the `ms` suggestions match "add tests for reachable lines." mutation-kill is adjacent and was not loaded. Per cm rule `b-muj2lwhz-00nh3y`, `ms suggest` stayed a coverage-gap note.

### Skill Gaps

- mutation-kill describes mutation survivors, not Bun line-coverage braces. The high confidence score was a weak signal.
- No skill states the Windows `fs.access` ENOENT behavior or the mocked `printViolations` shape in this repo. Those facts belong in `cm`, not a new skill, until a second session repeats them.

### Infrastructure Actions (non-rule)

- `dcg-guard.ps1` fail-closed with empty output blocked `bun test` and `bun run typecheck` until retry. Do not edit `.cursor/hooks/dcg-guard.ps1` or `.cursor/hooks.json` in this post-mortem.

## Follow-up Actions

- [ ] Confirm `dcg-guard.ps1` empty output. Run the same `bun test` twice. Expect `{"permission":"allow"}` both times. Do not weaken `failClosed`.
- [x] Legacy post-mortems now live in `docs/post-mortems/`: `post-mortem-2026-03-03-zip-refactor.md`, `post-mortem-2026-03-04-config-exclusions.md`, `post-mortem-2026-03-12-sri-hash-false-positive.md`.
- [ ] No new hook, script, or always-loaded instruction from this session.

```bash
# Dedup check before creating a tracker item:
br search "windows fs.access ENOENT coverage" 2>/dev/null | grep -q "." && echo "SIMILAR ITEM EXISTS — skip" || \
  br create --title="Document Windows fs.access ENOENT for coverage tests" \
    --description="Identified in post-mortem 2026-09-26" \
    --type task --priority p3
```

## Candidate Rules (for cm reflect)

- **Pattern**: "Measure a global Bun function-coverage threshold with the full test suite." (source: this post-mortem)
- **Pattern**: "On Windows, fs.access returns ENOENT when a path component is a file. Spy access, throw only for the fixture path, and forward other calls." (source: this post-mortem)
- **Pattern**: "Do not test a closing brace after return or throw, a while(true) brace, or an exhaustive never default." (source: this post-mortem)

## cm Feedback

[cass: helpful b-muj2lwhz-00nh3y]
[cass: harmful none]

## cm Session Close

```bash
cm mark b-muj2lwhz-00nh3y --helpful --json
```

## Related Threads

- SpecStory: `2026-09-27_00-50-31Z-dependency-cruiser-refactor`
- SpecStory: `2026-09-27_00-15-52Z-test-coverage-improvement`
- Session: `214381fe-0755-4c4f-8675-99816ca87594`
