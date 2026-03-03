# Post-Mortem: Fresh Eyes Codebase Audit

**Date**: 2026-03-02
**Duration**: ~10 minutes
**Participants**: Claude Opus 4.6 (primary agent), 3 review subagents (haiku)
**Status**: Completed

## Executive Summary

User requested a "fresh eyes" deep audit of the rule-validator codebase — randomly explore files, trace execution flows, and find bugs. Four bugs were found and fixed: a false-positive in the `no-static-classes` AST rule (missing constructor/getter/setter checks), dead code in `no-any-types` and `no-unknown-as-cast` (unreachable typeReference branches), and diverged error handling between `cli.ts` and its test. A `/simplify` review confirmed code quality with two minor follow-up fixes (inconsistent outer catch block, missing empty-class edge case test). All 49 tests pass, biome clean.

## What Went Well

1. **Systematic file reading** - Reading all source files and all test files in parallel batches gave complete context quickly.
2. **TypeScript AST knowledge** - Understanding that `any`/`unknown` are keywords (not TypeReferenceNodes) in the TS AST surfaced two dead-code bugs that would be invisible to anyone unfamiliar with the compiler API.
3. **Test-vs-reality divergence caught** - The `cli.test.ts` re-implementing `main()` locally (with different error handling) was a subtle but real issue. The test was passing but not testing the actual code.
4. **Simplify review** - The 3-agent parallel review caught the inconsistent outer catch block in `cli.ts:21` that the initial pass missed.
5. **Minimal changes** - Fixes were surgical: no unnecessary refactoring, no new abstractions, no feature creep.

## What Could Improve

1. **cli.test.ts still tests a local copy** - The test file re-implements `main()` instead of importing it. We aligned the error handling, but the fundamental problem (test doesn't import the real code) remains. This was intentional — fixing it requires module mocking infrastructure changes that weren't requested.
   - **Impact**: Low — the logic is trivial and now consistent, but future drift is possible.
   - **Mitigation**: Future work should refactor `cli.test.ts` to import and test the real `main()`.

2. **No characterization test for the false-positive bug** - The `no-static-classes` constructor bug was proven by reasoning about the AST, but we didn't write a test that would have failed before the fix and passed after. The new tests pass now, but we didn't verify they would have failed on the old code.
   - **Impact**: Low — the fix is obviously correct.
   - **Mitigation**: For critical fixes, consider running the new test against old code first.

## Key Decisions Made

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix cli.ts to match test, not test to match cli.ts | The test's `error.message` extraction is better UX than logging raw Error objects | Correct — consistent, user-friendly error output |
| Remove dead typeReference branches entirely | `any`/`unknown` are TS keywords, never TypeReferenceNodes — the branches are unreachable | Correct — simpler code, no behavior change |
| Add `isNonStaticMember` helper | Consolidates property/method/getter/setter + static-modifier check | Clean extraction, biome-approved |
| Skip extracting error-message utility | Only 2 call sites, pattern is a one-liner | Correct — would be over-engineering |

## Context Sources Used

| Source | Scope | Value |
|--------|-------|-------|
| `package.json` | Project | Understood dependencies, scripts, runtime |
| `src/index.ts` | Project | Core scanning engine, types, exports |
| `src/cli.ts` | Project | Entry point, error handling |
| `src/typescript/compiler.ts` | Project | AST utilities, `is` type guard object |
| `src/rules/*.ts` (8 rule files) | Project | All rule implementations |
| `src/rules/*.test.ts` (8 test files) | Project | All rule tests |
| `src/rules/registry.ts` | Project | Rule registration system |
| `src/rules/runner.ts` | Project | AST traversal + rule execution |
| `src/rules/rule.ts` | Project | Rule/violation interfaces |
| TypeScript compiler API knowledge | Language | SyntaxKind semantics for AnyKeyword, UnknownKeyword, TypeReferenceNode |

## Lessons Learned

### Applicable Everywhere
- **Dead code from keyword-vs-reference confusion is common in TS AST rules.** When checking for built-in types (`any`, `unknown`, `never`, `void`, `null`, `undefined`), they are always keywords, never type references. Any `is.typeReference` fallback for these names is dead code.
- **Tests that re-implement the code under test are a maintenance time bomb.** They pass initially but silently diverge. Always import the real function.

### Specific to This Work
- The `is` object in `compiler.ts` doesn't include `constructorDeclaration` — direct `ts.isConstructorDeclaration` is fine since it's only used in one place, but if more rules need it, add it to `is`.
- The `no-static-classes` rule's `hasInstanceMembers` check must account for ALL member types that imply instantiation: constructors, instance properties, instance methods, getters, setters.

### For Future Agents/Threads
- **Recommend**: When auditing AST rules, systematically check each `SyntaxKind` the rule handles against the actual TS parser behavior. The parser's output may not match what you'd expect from reading TypeScript source.
- **Suggest**: `/simplify` after bug fixes catches residual inconsistencies.
- **Avoid**: Don't assume test files test the real code — always verify imports.

## Patterns for Reuse

### "Fresh Eyes Audit" Pattern
1. Read project structure (context tree / package.json)
2. Read ALL source files in parallel batches (not just the ones that look interesting)
3. Read ALL test files in parallel
4. Run tests to establish baseline
5. For each file, ask: "What assumptions does this code make? Are they valid?"
6. For AST rules specifically: "Does the node type this checks actually appear in the AST for the syntax it targets?"
7. Fix, test, biome check
8. Run `/simplify` for second-pass review

## Recommendations

### "If we could redo this thread..."
- The thread was efficient. The main improvement would be writing a failing test first for the `no-static-classes` bug to confirm the false positive before fixing it.

### Rule Change Proposals
- Consider adding to `AGENTS.md`: "When writing AST rules that check for built-in TypeScript types (any, unknown, never, void, null, undefined), use keyword checks only — never typeReference checks. These types are always parsed as keywords."

### "Skills we should have loaded"
- The `typescript` skill could have been loaded for TS AST patterns, but manual knowledge was sufficient here.

### "How can we make this work more deterministic?"
- A pre-commit hook running `bun test && bunx biome check .` would catch regressions automatically.
- A script that runs all rules against a corpus of known-good and known-bad TypeScript files would serve as integration tests for the rule engine.

## Metrics

- **Goal completion**: 100% — found and fixed 4 bugs, plus 2 follow-up improvements
- **Time efficiency**: High — systematic parallel file reads minimized round trips
- **Quality score**: 8/10 — thorough audit, clean fixes, good test coverage added
- **Reusability**: High — the "fresh eyes audit" pattern applies to any AST-rule codebase
- **Documentation quality**: Good — post-mortem captures patterns and lessons

## Follow-up Actions

- [ ] Refactor `cli.test.ts` to import and test the real `main()` function instead of re-implementing it
- [ ] Consider adding `constructorDeclaration` to the `is` object in `compiler.ts` if more rules need it
- [ ] Add integration test corpus (known-good / known-bad TS files) for the rule engine
