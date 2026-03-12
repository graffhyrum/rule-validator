# Post-Mortem: Bug Sweep & Simplify

**Date**: 2026-03-02
**Duration**: ~10 minutes
**Participants**: Claude Opus 4.6 (primary), 3x Haiku review subagents
**Status**: Completed

## Executive Summary

User requested a random deep-dive exploration of the codebase to find bugs with "fresh eyes." Three real bugs were found and fixed across `cli.ts`, `compiler.ts` (visitor double-visit), and `compiler.ts` (glob exclude broken for absolute paths). A follow-up `/simplify` review by three parallel subagents surfaced two additional cleanup items: dead `context` field in `VisitorOptions` interface, and an array allocation inside a filter loop. All fixes pass 46 tests and typecheck.

## What Went Well

1. **Parallel file reads** - Read 15+ files in 3 batches, building full codebase understanding quickly
2. **Bug detection quality** - All 3 bugs were real, non-trivial, and could cause incorrect behavior in production:
   - Double `printSummaryReport` output (user-visible)
   - `createVisitor` visiting direct children twice (correctness)
   - `getFilesMatchingPattern` silently not excluding `dist/` and `build/` (correctness)
3. **Parallel subagent review** - Three Haiku agents ran concurrently for reuse/quality/efficiency review, completing in ~35s total
4. **Zero regressions** - All 46 tests passed after every change; typecheck clean throughout

## What Could Improve

1. **Test for the visitor bug** - The existing `createVisitor` test only checked that enter/leave were called and that the first/last entries were correct. It didn't verify each node was visited exactly once — which is why the double-visit bug survived.
   - **Impact**: Bug existed undetected since the test was written
   - **Mitigation**: Add a test asserting visit count equals node count

2. **No characterization test before fix** - The bugs were fixed directly without first writing a failing test that captures the bug. A test-first approach would have provided stronger verification.
   - **Impact**: Low (fixes are simple and correct), but process could be tighter
   - **Mitigation**: Follow red-green-refactor even for bug fixes

3. **cli.test.ts duplicates production code** - The test file contains its own copy of `main()` with mocks instead of importing and mocking. This means the test can drift from production code (as it did — the test had the same bug).
   - **Impact**: Tests don't actually verify production `cli.ts` behavior
   - **Mitigation**: Refactor cli.test.ts to import and test the actual `main()` function

## Key Decisions Made

| Decision                                                 | Rationale                                                      | Outcome                 |
| -------------------------------------------------------- | -------------------------------------------------------------- | ----------------------- |
| Fix visitor by simplifying to single recursive `visit()` | Matches `traverseSourceFile` pattern already in codebase       | Clean, correct, minimal |
| Use glob's `ignore` option instead of fixing regex       | Delegates to well-tested library; eliminates hand-rolled regex | Simpler, correct        |
| Keep `createVisitor` despite being unused                | It's exported public API with tests; consumers may use it      | Conservative, safe      |
| Skip extension list "duplication" finding                | Lists serve different purposes (JS+TS vs TS-only)              | Correct judgment        |

## Time Analysis

| Phase                | Estimated | Actual | Notes                                        |
| -------------------- | --------- | ------ | -------------------------------------------- |
| Codebase exploration | -         | ~3 min | 3 rounds of parallel reads, 15+ files        |
| Bug identification   | -         | ~1 min | Found during reading, traced execution flows |
| Bug fixes            | -         | ~2 min | 3 bugs + test updates                        |
| Simplify review      | -         | ~2 min | 3 parallel Haiku agents                      |
| Simplify fixes       | -         | ~1 min | 2 items fixed                                |
| Verification         | -         | ~1 min | Tests + typecheck after each change          |

## Lessons Learned

### Applicable Everywhere

- **Double-call bugs hide in orchestrator functions**: When function A calls function B, and B internally calls C, the caller of A might also call C directly — creating a double-call. This pattern is common in CLI entry points.
- **Absolute vs relative path mismatch**: Any code that uses `{ absolute: true }` in glob but then filters with relative-path-anchored patterns will silently fail. Always test exclude logic with absolute paths.
- **Visitor pattern correctness**: Tree visitors that mix explicit child handling with recursive `visit()` calls are prone to double-visiting. The simplest correct pattern is: `enter(node); forEachChild(node, visit); leave(node)`.

### Specific to This Work

- The project has two parallel rule systems: regex-based (`src/rules.ts`) and AST-based (`src/rules/*.ts`). They share rule names but run independently via different code paths (`checkLineForViolations` vs `runRules`).
- `VisitorOptions<T>` had a `context` field that was entirely dead — the context was passed as a function argument instead. Interface fields that duplicate function parameters are a smell.

### For Future Agents/Threads

- **Recommend**: When fixing visitor/traversal bugs, count visits per node in tests to verify exactly-once semantics
- **Suggest**: `/legacy` or `/seam` skills could help refactor `cli.test.ts` which duplicates production code
- **Avoid**: Don't trust that glob exclude patterns work with absolute paths without testing

## Patterns for Reuse

### "Fresh Eyes" Bug Sweep Pattern

1. Get full project tree structure
2. Read ALL source files (not just the ones you think matter)
3. Trace execution flows from entry points (CLI -> scanFiles -> checkLine -> RULES)
4. Look for: double calls, path assumption mismatches, dead interface fields, visitor correctness
5. Fix bugs, then run `/simplify` for cleanup pass
6. Verify with tests + typecheck after each change

## Recommendations

### "If we could redo this thread..."

- Load `/testing-patterns` skill before starting — would have prompted writing failing tests first
- The exploration phase was efficient; no changes needed there

### Rule Change Proposals

- Consider adding to `AGENTS.md`: "When fixing bugs, write a failing test first that demonstrates the bug before applying the fix"
- Consider adding: "CLI test files should import and test actual production functions, not duplicate them with mocks"

### "Skills we should have loaded"

- `/testing-patterns` — would have prompted red-green-refactor discipline
- `/debug` — relevant for systematic bug finding, but keyword overlap with "explore and find bugs" is low
- **Trigger improvement**: `/debug` skill description should include keywords like "find bugs", "code review", "fresh eyes", "audit"

### "Skills which didn't help"

- No irrelevant skills were loaded. The `/simplify` skill was effective and well-triggered.

### "How can we make this work more deterministic?"

- A pre-commit hook running `bun test && bun run typecheck` would catch regressions automatically
- A custom `/audit` skill combining "explore + find bugs + simplify" would standardize this workflow

### Proposed workflows

For "find and fix bugs" tasks:

1. `mcp__contextplus__get_context_tree` for overview
2. Parallel read of all source files (batch by dependency layers)
3. Trace execution from entry points
4. Document bugs found with file:line references
5. Write failing test for each bug (red)
6. Fix each bug (green)
7. Run `/simplify` for cleanup (refactor)
8. Final `bun test && bun run typecheck`

## Metrics

- **Goal completion**: 100% — found and fixed real bugs, cleaned up code
- **Time efficiency**: High — ~10 minutes for full sweep of 20+ file project
- **Quality score**: 8/10 — bugs found and fixed correctly, but no failing tests written first
- **Reusability**: High — the sweep pattern works for any TypeScript project
- **Documentation quality**: Good — bugs explained clearly with root cause

## Follow-up Actions

- [ ] Refactor `cli.test.ts` to test actual production `main()` instead of duplicated copy
- [ ] Add visitor count test to `compiler.test.ts` verifying exactly-once visit semantics
- [ ] Consider `/debug` skill description update to trigger on "find bugs" / "audit" prompts
- [ ] Consider custom `/audit` skill combining explore + bug-find + simplify

## Related Threads

- No prior threads in this session
- Beads `rule-validator-ea0` (no-static-classes test failing) and `rule-validator-mnl` (no-toBeInstanceOf test failing) are open bugs that were not in scope for this sweep
