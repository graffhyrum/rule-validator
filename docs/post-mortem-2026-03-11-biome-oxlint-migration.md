# Post-Mortem: Biome → oxlint + oxfmt Migration

**Date**: 2026-03-11
**Status**: Completed

## Executive Summary

Migrated the rule-validator project from `@biomejs/biome` to `oxlint` + `oxfmt` as planned, then ran a `/simplify-review` pass on the changed code. The migration itself was clean — all 188 tests passed, zero lint violations, format clean. One notable wrinkle: the plan's version constraints for oxlint and oxfmt were stale (no `^0.17.1` or `^0.3.2` exist on npm; actual releases are `1.53.0` and `0.38.0`). The simplify pass caught a missing `.toBe(true)` assertion (silent no-op test), stale test data (`no-any-types` in test RULES but absent from `src/rules.ts`), and a missing test suite for the new `no-raw-locator-in-spec` rule. Expert review found several more issues, all triaged and either fixed or beaded.

## Bead Outcomes

- Closed: none (migration was inline-plan work)
- Opened:
  - `rule-validator-fsb` — Find oxlint/tsconfig equivalents for 17 unmapped Biome rules (P3)
  - `rule-validator-uaj` — Dual rule system (RULES + AST_RULES) no shared interface or dedup (P3)
- Modified: none

## What Went Well

1. **Pre-flight audit before config finalization** — Running `bunx oxlint .` with the empty default config before writing `.oxlintrc.json` confirmed only 1 benign default warning (in a test file, covered by ignorePatterns). This eliminated surprise regressions post-config.

2. **Empirical verification over expert opinion** — The expert review flagged `eslint/no-nested-ternary` and `typescript/no-non-null-assertion` as incorrect prefixes. Rather than accepting this, we ran test configs against a temp file and confirmed both prefixes work correctly in oxlint 1.53.0. Two false expert findings dismissed in ~30 seconds.

3. **Simplify pass caught real bugs** — The missing `.toBe(true)` on the `no-raw-locator-in-spec` fileGuard positive test was a silent no-op that would never fail. The simplify pass caught it before it could provide false confidence in CI.

4. **Separation of commits by concern** — The session had pre-existing uncommitted src changes (fileGuard feature) alongside the migration changes. These were committed separately with accurate messages, preserving legible git history.

5. **bunx prefix discovery for compound scripts** — When `bun run check` failed with "oxlint: command not found", diagnosing that bash (not bun's shell) runs `&&`-chained scripts was quick and the fix (`bunx` prefix) was clean.

## What Could Improve

1. **Stale version constraints in plan**
   - **Impact**: `bun add -d oxlint oxfmt` failed on first attempt because the plan specified `^0.17.1` / `^0.3.2` which don't exist on npm; actual versions are `1.53.0` / `0.38.0`. Required a retry with bare `bun add -d oxlint oxfmt` to get latest.
   - **Mitigation**: Plans that specify npm package versions should note them as "pinned at plan time — verify before install" or omit version constraints and let the package manager resolve latest.

2. **Test coverage gap for new rules not caught before commit**
   - **Impact**: `no-raw-locator-in-spec` was added to `src/rules.ts` in a previous session but had no entry in `rules.test.ts`. The simplify-review pass caught it, but it should have been caught earlier.
   - **Mitigation**: The inline-RULES pattern in `rules.test.ts` drifts silently from `src/rules.ts`. A count-parity assertion (`expect(RULES.length).toBe(EXPECTED_COUNT)`) in the test file would surface additions immediately.

3. **`bun run` script resolution for compound commands**
   - **Impact**: The `check` and `fix` scripts used bare `oxlint`/`oxfmt` (not `bunx`). `bun run` with `&&` chains through bash, which lacks `node_modules/.bin` on PATH. Took one failed attempt to diagnose.
   - **Mitigation**: When migrating tool scripts, use `bunx <tool>` or `./node_modules/.bin/<tool>` to guarantee resolution regardless of shell. Add this to the project's Distilled Rules.

4. **`ignoreTypeValues` option specified in plan was a no-op**
   - **Impact**: The plan called for `"no-unused-vars": ["warn", { "ignoreTypeValues": true }]`. oxlint doesn't recognize `ignoreTypeValues` — it's silently ignored. The intent (suppressing false positives on `import type`) turned out to be moot since oxlint handles those correctly without the option. But the no-op config creates false confidence.
   - **Mitigation**: When migrating rule options from one linter to another, empirically test that the option is recognized (e.g., test with a file that triggers the false positive scenario). The migration plan should include a verification step for option parity.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Demote `prefer-template` from error → warn | oxlint's autofix for prefer-template is WIP; auto-fixing incomplete makes the rule destructive | Correct — safe to enforce without auto-applying |
| Use `eslint/no-nested-ternary` prefix | Explicit namespace avoids collision with `unicorn/no-nested-ternary` (different semantics) | Verified working — expert review was wrong about this |
| `erasableSyntaxOnly: true` instead of `style/noEnum` | Covers more banned syntax (enums, parameter properties, `import =` aliases) at the compiler layer | Clean — no violations in codebase |
| Create two follow-up beads vs. fixing inline | Dual rule system and 17 unmapped rules are architectural decisions requiring more analysis | Appropriate — both are P3, non-blocking |
| Drop `"plugins": null` → `[]` | `null` is not the documented oxlint form for the plugins array | Correct — schema conformance |

## Lessons Learned

### Applicable Everywhere

- **Verify tool option parity empirically when migrating linters** — never assume an option from Tool A maps to the same option name/behavior in Tool B. Write a 2-line test file and confirm the option changes behavior before shipping config.
- **Expert review AI findings need empirical confirmation for tool-API claims** — the expert flagged two working oxlint rule prefixes as broken. For any "this API call is wrong" finding, verify against the live tool before accepting.
- **Compound shell scripts need `bunx` prefix in bun projects** — `bun run` delegates `&&`-chained scripts to bash, which doesn't inherit `node_modules/.bin`. Use `bunx <tool>` unconditionally for dev-dep binaries in package.json scripts.

### Specific to This Work

- **Inline test RULES in rules.test.ts drift silently** — The isolation pattern (inlining to avoid `mock.module` interception) is necessary but brittle. A count-parity guard or explicit "sync checklist" comment in the test file would surface additions before review.
- **`no-raw-response-in-elysia` pattern depends on `fileGuard` for correctness** — the regex is intentionally broad; the `fileGuard` does the real discrimination. When `fileSkippedRules` is absent in direct `checkLineForViolations` calls, this rule fires false positives. Document this coupling in the rule definition.

## Recommendations

### Rule Changes

Add to `CLAUDE.md` Distilled Rules:
- **`bunx` required in package.json scripts for dev-dep binaries** — `bun run` delegates `&&`-chains to bash without `node_modules/.bin` on PATH; `bunx <tool>` resolves from the project's local install unconditionally.
- **Verify linter option parity empirically** — when porting a linter config, test each custom option against a live fixture file before committing the config.

### Skill Coverage

Skills suggested by `ms suggest`:
- `caching-patterns` — not relevant this session
- `elysia` — not relevant this session

Skills actually loaded:
- (none explicitly loaded; the migration was inline-plan work)

Gap: `oxlint` / linter-migration skill would have been useful — no existing skill covers oxlint config or rule-mapping patterns.

### Automation Opportunities

- A pre-commit check that verifies `RULES.length` in `src/rules.ts` matches the inline array in `src/rules.test.ts` would prevent silent test drift.
- The `fastvet` script runs `bun fix` (mutating formatter) before tests — in CI this mutates sources mid-check. Consider `bun check` (read-only) in CI and `bun fix` only in local pre-commit.

## Follow-up Actions

- [ ] Add count-parity guard to `rules.test.ts` to prevent silent drift from `src/rules.ts`
- [ ] Add `bunx` prefix distilled rule to CLAUDE.md
- [ ] Evaluate 17 unmapped Biome rules → `rule-validator-fsb`
- [ ] Resolve dual RULES/AST_RULES system → `rule-validator-uaj`

## Candidate Rules (for cm reflect)

- **Pattern**: "In package.json scripts, use `bunx <tool>` for dev-dep binaries — `bun run` with `&&` chains through bash which lacks `node_modules/.bin` on PATH" (source: this post-mortem)
- **Pattern**: "Verify linter option names empirically against the live tool before shipping config — options don't map 1:1 across linters and unrecognized options are silently ignored" (source: this post-mortem)

## Related Threads

- Prior session: fileGuard feature (committed as `4bc7d0c feat: add fileGuard support`)
- Prior session: config exclusions (`documents/post-mortem-2026-03-04-config-exclusions.md`)
- Follow-up: `rule-validator-fsb`, `rule-validator-uaj`
