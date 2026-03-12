# Post-Mortem: Beads Sprint — 12 Issues to Zero

**Date**: 2026-03-03
**Duration**: ~2 hours (estimated from commit timestamps and context usage)
**Participants**: Claude Opus 4.6 agent + user
**Status**: Completed

## Executive Summary

Cleared all 12 open beads issues in a single session covering CLI overhaul (commander integration, --help/--version/--json flags), AST rule engine CLI integration, output formatting improvements (picocolors, source context, carets, rule names), and several bug fixes (column indexing, self-exclusion, message tone). After implementation, resolved 17 TypeScript errors surfaced by `bun fastvet`, fixed biome lint violations, and performed a 3-agent `/simplify` review that yielded 8 additional improvements including parallel scan execution and single-pass AST traversal.

## What Went Well

1. **Parallel worktree dispatch** — Two independent beads (5rj: CLI flags, qnt: message tone) were dispatched to worktree-isolated subagents concurrently, halving wall-clock time for those tasks.
2. **Bead triage via `bv --robot-triage`** — Provided a dependency-aware priority ranking that correctly identified the CLI flags bead as the top unblocking pick (unblocked 2 downstream beads).
3. **Incremental batching** — Grouped related beads (output formatting: sku, lqf, z06, ndd, qgo) into a single editing pass on `src/index.ts`, avoiding merge conflicts.
4. **`/simplify` post-pass** — The 3-agent review caught the single-pass traversal optimization (8x reduction in AST walks per file) that was invisible during implementation.
5. **Full vet pipeline as quality gate** — `bun fastvet` (build + typecheck + biome + custom-hooks + test:coverage) caught 17 real errors that would have shipped.

## What Could Improve

1. **Worktree merge friction** — The CLI worktree diff failed to apply because `cli.ts` had pre-existing uncommitted changes. Fell back to manual `cp`.
   - **Impact**: ~5 minutes wasted diagnosing and working around.
   - **Mitigation**: Commit or stash all changes before dispatching worktree subagents. Add a pre-dispatch hook to verify clean state.

2. **AST rule false positive not caught by unit tests** — `template-literals-only` flagged numeric addition (`errorCount + warningCount`) because it only checked for `PlusToken`, not for string operands. Only caught by self-scan custom hook.
   - **Impact**: Required a fix pass and re-run of the full pipeline.
   - **Mitigation**: Integration test fixtures (`known-good.ts`) should include numeric addition as a negative case. Added `hasStringOperand` guard.

3. **Dynamic imports in hot path** — `await import("node:fs")` and `await import("glob")` inside `scanFiles`/`createAnalyzer` were present from the original code and survived through the full implementation. Only caught by the efficiency review agent.
   - **Impact**: Minor runtime overhead, but signals a code smell.
   - **Mitigation**: Static analysis rule or convention: "no dynamic imports for stable dependencies."

4. **Dual violation type systems** — `Violation` (regex engine) and `FoundViolation` (AST engine) produce the same `JsonViolation` output but through completely separate serialization paths. `printAstViolations` had to fabricate a fake `pattern: /./g` to bridge the gap.
   - **Impact**: Code duplication, fragile adapter.
   - **Mitigation**: Introduced `PrintableViolation` interface during `/simplify`. Long-term: unify into a single violation model.

5. **No parallel execution of regex + AST scans** — Both scans were awaited sequentially despite being independent. Only caught by efficiency agent.
   - **Impact**: Doubled CLI latency on every invocation.
   - **Mitigation**: Fixed with `Promise.all`. Should have been obvious during implementation.

## Key Decisions Made

| Decision                              | Rationale                                            | Outcome                                    |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| Use `commander` for CLI               | Standard, well-tested, minimal API                   | Clean --help/--version/--json with 8 lines |
| Batch output beads into one pass      | All touch `printViolations` in `index.ts`            | No merge conflicts, consistent style       |
| Inline AST integration (not subagent) | Touched `cli.ts` which was just modified by worktree | Avoided diff conflicts                     |
| Extract `AST_RULES` to shared module  | Duplicated in ast-scan.ts and integration.test.ts    | Single source of truth                     |
| Single-pass traversal refactor        | 8 full AST walks per file → 1                        | O(nodes) instead of O(rules × nodes)       |

## Time Analysis

| Phase                       | Estimated | Actual    | Notes                                            |
| --------------------------- | --------- | --------- | ------------------------------------------------ |
| Triage + baseline           | 10m       | 10m       | `bv --robot-triage` + `bun test`                 |
| Parallel dispatch (2 beads) | 15m       | 20m       | Worktree merge friction                          |
| AST integration (1 bead)    | 15m       | 20m       | `createAnalyzer` filtering fix needed            |
| Output formatting (5 beads) | 20m       | 15m       | Batched effectively                              |
| Remaining beads (4)         | 15m       | 15m       | Straightforward                                  |
| Debug / fastvet fix         | 20m       | 30m       | 17 TS errors + biome + self-scan false positives |
| /simplify review            | 15m       | 20m       | 3 agents + 8 fixes + re-verify                   |
| **Total**                   | **~110m** | **~130m** | 85% accuracy                                     |

## Lessons Learned

### Applicable Everywhere

- **Run the full vet pipeline before declaring done** — `bun test` passing is necessary but not sufficient. Typecheck, lint, and custom hooks catch orthogonal issues.
- **Parallel `Promise.all` for independent async work** — Trivial to implement, easy to miss when writing sequential code. Should be a default pattern check.
- **Single-pass visitor pattern** — When N rules each need a full tree traversal, fan out at the node level, not the rule level. This is a general principle for any multi-rule/multi-check system.

### Specific to This Work

- **Fixture files need exclusion from typecheck** — Test fixtures intentionally contain invalid code (`any`, missing types, `document`). Must be excluded from `tsconfig.json` and `tsconfig.types.json`.
- **String concatenation detection requires operand type checking** — A `PlusToken` alone is ambiguous; must verify at least one operand is a string literal.
- **Dual violation models create adapter tax** — Every new consumer of violations must bridge between `Violation` and `FoundViolation`. `PrintableViolation` is a step toward unification.

### For Future Agents/Threads

- **Recommend**: Load `testing-patterns` skill before dispatching subagents for test-adjacent work.
- **Suggest**: A pre-dispatch checklist hook that verifies `git status` is clean before worktree creation.
- **Avoid**: Dispatching worktree subagents when the files they'll touch have uncommitted changes.

## Patterns for Reuse

### Bead Batching by File Scope

When multiple beads all modify the same file, batch them into a single editing pass:

1. Read the file once
2. Apply all changes in dependency order
3. Run tests once after all changes

This avoids merge conflicts and reduces test iteration cycles.

### 3-Agent Simplify Review

The reuse/quality/efficiency split produces complementary findings with minimal overlap:

- Reuse agent finds duplicate logic and shared constants
- Quality agent finds type system smells and abstraction leaks
- Efficiency agent finds concurrency and traversal optimizations

Run this after any session that touches 5+ files.

## Recommendations

### "If we could redo this thread..."

1. **Commit before worktree dispatch** — Would have avoided the `cp` workaround entirely.
2. **Run `bun fastvet` between phases** — Instead of implementing all 12 beads then discovering 17 errors, catch issues incrementally after each batch.
3. **Add numeric addition to `known-good.ts` fixture** — Would have caught the `template-literals-only` false positive during integration testing, not during self-scan.

### Rule Change Proposals

- Add to project CLAUDE.md: "Always run `bun fastvet` after completing a batch of changes, not just at the end."
- Add to project CLAUDE.md: "When dispatching worktree subagents, verify `git status` shows no uncommitted changes to files in the subagent's scope."

### "Skills we should have loaded"

- `biome` skill — Would have flagged the cognitive complexity and max-params issues earlier during implementation rather than during the fix phase.
- `typescript` skill — Loaded implicitly via rules, but explicit loading might have caught the dynamic import anti-pattern sooner.

### "Skills which didn't help"

- `beads-start` — The triage data was useful, but the skill's extensive subagent dispatch protocol (s2p snapshots, cass search, skill assignment per subagent) was mostly skipped in favor of direct implementation. The overhead of the full protocol isn't justified for a batch of small beads.

### "How can we make this work more deterministic?"

1. **Hook: pre-worktree-dispatch** — Verify clean git status for target files before creating worktrees.
2. **Hook: post-bead-batch** — Auto-run `bun fastvet` after closing N beads.
3. **Template: AST rule** — Scaffold for new AST rules that includes both positive and negative fixture entries, preventing false positive gaps.

### Proposed Workflows

**Bead Sprint Workflow:**

1. `bv --robot-triage` → identify batches by file scope
2. `git stash` or commit any WIP
3. Dispatch independent beads to worktree subagents
4. Batch dependent beads by shared file into sequential passes
5. `bun fastvet` after each batch
6. `/simplify` after all beads closed
7. Final `bun fastvet` + commit + push

## Metrics

- **Goal completion**: 100% — All 12 beads closed, pipeline green
- **Time efficiency**: 85% (110m estimated vs 130m actual)
- **Quality score**: 8/10 — All tests pass, but required 2 fix passes after initial implementation
- **Reusability**: High — Parallel scan, single-pass traversal, `PrintableViolation`, shared `AST_RULES` are all reusable patterns
- **Documentation quality**: Good — Post-mortem captures patterns; fixture files serve as living documentation

## Follow-up Actions

- [ ] Add pre-worktree-dispatch clean-state check (hook or convention)
- [ ] Add numeric addition case to `known-good.ts` fixture
- [ ] Consider unifying `Violation` and `FoundViolation` into single type
- [ ] Evaluate adding `bun fastvet` as post-bead-close hook
- [ ] Update `beads-start` skill to reduce ceremony for small bead batches

## Related Threads

- Previous session: Bug sweep that created the 12 beads worked in this session
- `docs/post-mortem-2026-03-02-bug-sweep.md` — The audit that generated most of the beads
- `docs/post-mortem-2026-03-02-fresh-eyes-audit.md` — Earlier audit pass
