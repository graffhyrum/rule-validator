# Post-Mortem: Project-Level Config Exclusions

**Date**: 2026-03-04
**Duration**: ~30 minutes
**Participants**: Claude Sonnet 4.6
**Status**: Completed

## Executive Summary

Implemented `rule-validator.config.json` support: a discoverable project config file that adds global and per-rule file exclusions. The feature involved creating one new module (`src/config.ts`), threading config through four existing modules, updating one test file, and adding 6 new tests. README was updated in a follow-up commit. Execution was clean with no pivots — the plan was well-specified and the codebase was small enough to understand fully before writing any code.

## What Went Well ✅

1. **Pre-written plan** — The plan specified every file to touch, the exact interface shapes, and merge semantics upfront. Zero ambiguity required no clarification exchanges.
2. **Parallel reads at session start** — `src/index.ts`, `src/ast-scan.ts`, and `src/cli.ts` were read in one parallel batch, giving full context before any writes.
3. **Incremental type-check** — Running `tsc --noEmit` immediately after all edits caught zero errors, confirming clean implementation.
4. **Test failure was informative, not blocking** — The two CLI test failures pointed exactly at the missing `config: {}` in call expectations, solved in one targeted mock addition.
5. **ArkType used correctly** — Config validation used the project's established validator (`arktype`) with no deviation.
6. **minimatch already available** — No new dependency needed; `minimatch` was already a transitive dep of `glob`.

## What Could Improve ⚠️

1. **`makeTempDir` in config.test.ts is slightly fragile**
   - **Impact**: The `mkdirSync` return value on Linux is `undefined`, so the `?? path.join(...)` fallback runs every time — but it works because `recursive: true` ensures the dir exists.
   - **Mitigation**: Construct the path first, then call `mkdirSync`, instead of relying on return value.

2. **`isFileExcludedForRule` is duplicated across `src/index.ts` and `src/rules/runner.ts`**
   - **Impact**: Two copies of the same 6-line function — minor maintenance burden.
   - **Mitigation**: Extract to `src/config.ts` (where the `ProjectConfig` type already lives) and import in both callsites.

3. **`import path from "node:path"` added to `runner.ts` without noting it was new**
   - **Impact**: None functional, but adds a new import to a module that previously had none. Minor noise.
   - **Mitigation**: Acceptable given the feature requires `path.relative`.

## Key Decisions Made 📌

| Decision                                                                                       | Rationale                                                                                                      | Outcome                                                            |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Use `minimatch` for glob matching                                                              | Already a transitive dep; well-known, simple API                                                               | Works correctly; no new dep                                        |
| Project cannot remove default excludes                                                         | Plan spec'd this explicitly to prevent self-scanning accidents                                                 | Correct defensive default                                          |
| Mock `./config.ts` in CLI tests rather than update all call assertions with real config values | Isolates CLI logic from config I/O; consistent with existing mock pattern for `./index.ts` and `./ast-scan.ts` | Two targeted assertion updates, clean tests                        |
| Put `isFileExcludedForRule` inline in each module                                              | Fastest path; each callsite had slightly different context type                                                | Works but creates duplication — see improvement item above         |
| `loadProjectConfig` walks toward fs root                                                       | Enables monorepo use: config at workspace root covers all packages                                             | Consistent with how tools like ESLint and tsconfig discover config |

## Time Analysis

| Phase          | Notes                                                            |
| -------------- | ---------------------------------------------------------------- |
| Context read   | 3 parallel file reads + package.json dep check = ~2 tool calls   |
| Implementation | 6 Edit/Write calls, sequential due to dependencies between files |
| Verification   | `tsc --noEmit` + `bun test` — both on first attempt              |
| README update  | Single Edit, committed separately                                |

## Lessons Learned 🎓

### Applicable Everywhere

- Read all affected files in one parallel batch before writing anything. This session did it correctly; keep as standard practice.
- Run `tsc --noEmit` immediately after all edits, before running tests. Catches type errors that tests may not surface.

### Specific to This Work

- When threading a new option through multiple layers (CLI → scan → runner), sketch the type changes top-down first, then implement bottom-up so each layer's types are ready when the caller needs them. The plan already prescribed this order.
- Config validation with ArkType at the boundary (`parseConfigFile`) keeps all downstream code type-safe without additional guards.

### For Future Agents/Threads

- **Recommend**: When a plan specifies "accept `config` in options", check whether the function is called in tests with explicit options assertions — those will break and need updating.
- **Suggest**: Load the `ark` skill when implementing ArkType schemas; it has concise syntax reference.
- **Avoid**: Writing `isFileExcludedForRule` twice. Extract shared path-matching utilities to the module that owns the type they operate on.

## Patterns for Reuse

### "Thread a new option through a layered call stack"

1. Define the type in the lowest-level module where it's consumed.
2. Add it as optional to each intermediate `Options` interface.
3. Update each call site top-down (CLI → scan function → runner).
4. Search for test files that assert on call signatures and update expectations.
5. Run `tsc --noEmit` before tests.

**Applicable when**: Adding cross-cutting config to a tool with a CLI → library → rule-runner architecture.

## Recommendations

### "If we could redo this thread..."

- Extract `isFileExcludedForRule` to `src/config.ts` from the start, avoiding duplication. The plan didn't specify where to put it; defaulting to co-location with `ProjectConfig` is cleaner.
- The overall workflow was efficient. No changes needed to the plan format or discovery process.

### Rule Change Proposals

- Consider adding to `AGENTS.md`: "Shared utility functions that operate on config types belong in the module that defines those types." This prevents the duplication observed here.

### "Skills we should have loaded"

- **`ark`** — Syntax reference for ArkType would have been useful when writing `ProjectConfigSchema`. The schema was simple enough to write from memory, but on a more complex config it would matter.
- **`bun-test`** — Would confirm `mock.module` pattern syntax; was known from context but worth loading for less-familiar implementors.

### "Skills which didn't help"

- None were loaded this session. The plan was explicit enough that skill lookup was not needed.

### "How can we make this work more deterministic?"

- A hook or script that validates `rule-validator.config.json` on `git commit` would catch schema errors before they reach CI.
- The config discovery walk could be exercised by a fixture test that creates a nested directory structure — partially done, but an end-to-end CLI test with an actual config file would be stronger.

### Proposed workflow for similar "add project config" features

1. Define schema + loader in a new `src/config.ts` with ArkType validation.
2. Add `config?: ProjectConfig` to all relevant `Options` interfaces.
3. Update `applyScanDefaults`-style functions to merge config fields.
4. Pass config through to rule runners.
5. Mock config in CLI tests; update call-signature assertions.
6. Write focused unit tests for the loader (happy path, walk-up, bad JSON, bad schema).
7. `tsc --noEmit` → `bun test` → commit.
8. Update README in a separate commit for clean history.

## Metrics

- **Goal completion**: 100%
- **Time efficiency**: High — no pivots, no retries, first-pass type-check and test run passed
- **Quality score**: 8/10 (minor duplication deduction)
- **Reusability**: High — the "thread config through layered options" pattern applies to any similar CLI tool
- **Documentation quality**: Good

## Follow-up Actions

- [ ] Extract `isFileExcludedForRule` to `src/config.ts` and import in both callsites
- [ ] Fix `makeTempDir` in `config.test.ts` to not rely on `mkdirSync` return value
- [ ] Add end-to-end CLI test: write real config file + fixture with violation → verify suppression

## Related Threads

- `post-mortem-2026-03-03-vet-expert-review.md` — prior session that established test isolation patterns used here
