# Post-Mortem: Vet → Expert Review → Implementation

**Date**: 2026-03-03
**Duration**: ~45 min (session start from /clear, commits at 18:08 CST)
**Participants**: Claude Sonnet 4.6 agent + user
**Status**: Completed

## Executive Summary

Three-phase session triggered by `/quality:vet-and-triage`. Phase 1 fixed a biome.json glob bug
(`!*.test.ts` → `!**/*.test.ts`) that allowed test files to be linted. Phase 2 ran
`/review:expert-review` with three parallel expert agents (TypeScript, Legacy, Craftsman), which
surfaced a real production severity-miscounting bug in `countFromDisplay` that existing tests
couldn't catch. Phase 3 implemented all high/medium findings: injectable `excludePatterns` in
`runAstRules`, `scanFiles` overloads for the `json:true` invariant, the severity bug fix, and
direct tests for `exitWithResult` and `printDedupedDisplay`. Coverage improved from 0%→100% on
`ast-scan.ts` and 87%→100% on `index.ts`. A significant debugging detour (8+ iterations) uncovered
a Bun test isolation gap: `mock.module` leaks across files sharing the same process, requiring a
`?fresh` cache-busting import as a workaround.

## What Went Well ✅

1. **Expert agents in parallel** — All three agents ran concurrently and returned independently,
   synthesizing into a single confidence-scored matrix in one pass.
2. **Real bug found by review** — The `countFromDisplay` severity bug (`v.severity` vs
   `v.rule.severity`) was invisible to all 164 existing tests and was only caught by the Craftsman
   agent performing a code-level analysis. The review pipeline earned its cost.
3. **Root cause first** — Both the biome glob fix and the countFromDisplay fix were proven before
   implementation: the biome fix was proven by running biome directly on the test file; the severity
   bug was confirmed by tracing the type mismatch.
4. **Coverage payoff** — `ast-scan.ts` was at 0% (3 completely untested functions). The injectable
   `excludePatterns` change plus new tests got it to 100%, characterising all three functions.
5. **Conflict resolution in expert synthesis** — The TypeScript expert dissented on the test file
   exclusion policy (argued to revert it); the other two agreed it was correct. The synthesis
   correctly identified the 1-vs-2 split, documented both positions, and resolved to a narrow
   compromise (add a `biome-ignore` comment for the single genuine false positive).

## What Could Improve ⚠️

1. **Bun mock.module isolation assumption** — Assumed test files run in isolated workers (Bun
   default claim). In practice, for projects with few test files, Bun runs all files in the same
   process. Eight debugging iterations were spent on this.
   - **Impact**: ~20% of implementation time spent on test isolation instead of features.
   - **Mitigation**: Project-level rule: always add `afterAll(() => mock.restore())` to any
     test file that calls `mock.module`. Document the `?fresh` import pattern for tests that
     import from a path that other test files mock.

2. **`exitWithResult` spy placement** — Initially placed `expect(spy).toHaveBeenCalledWith()`
   AFTER `mockRestore()` in a `finally` block. In Bun, `mockRestore()` clears call history.
   Required a second iteration to move assertions before restore.
   - **Impact**: 2 extra test-debug cycles.
   - **Mitigation**: Rule: always assert before calling `mockRestore()`. Never put assertions in
     `finally` blocks when the spy is restored in the same block.

3. **Low-confidence finding implemented without consensus** — `countFromDisplay` was flagged only
   by the Craftsman agent (1/3 consensus, 3.3/10 confidence) but implemented because Craftsman's
   specific code quote proved a real type-safety violation. The confidence score underrepresented
   the finding's actual risk because two agents didn't read that code path.
   - **Impact**: None — fix was correct. But the decision to implement at 3.3/10 was informal.
   - **Mitigation**: Expert review output format should distinguish "low consensus because only one
     expert looked at this code" from "low consensus because two experts disagreed."

## Key Decisions Made 📌

| Decision                                              | Rationale                                                                               | Outcome                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------- |
| Fix biome glob only, don't revert exclusion policy    | 2/3 expert consensus that test exclusion is correct; only 1 genuine false positive      | Correct; kept linting clean |
| Implement `countFromDisplay` at 1/3 consensus         | Craftsman provided specific code evidence; bug was provably real                        | Fixed real production bug   |
| Use `?fresh` cache-busting import                     | `mock.restore()` alone didn't clear Bun's module cache; fresh import worked empirically | All 172 tests pass          |
| Add `afterAll(() => mock.restore())` to `cli.test.ts` | Defense-in-depth against future file ordering changes                                   | Forward-compatible          |
| Keep `runAstRules` tests in `ast-scan.test.ts`        | Preserves semantic co-location; workaround is documented                                | Clean architecture          |

## Time Analysis

| Phase                        | Estimated | Actual | Notes                                                                    |
| ---------------------------- | --------- | ------ | ------------------------------------------------------------------------ |
| Biome glob diagnosis + fix   | 5m        | 5m     | Perfect: ran vet, read output, traced root cause, one edit               |
| Expert review (3 agents)     | 3m        | ~4m    | Agents ran in parallel; synthesis was the main cost                      |
| Implementation setup (beads) | 2m        | 2m     | 4 beads created in parallel                                              |
| Production code changes      | 10m       | 10m    | 5 changes across 3 files, typecheck on first pass except readonly spread |
| Test writing                 | 10m       | 10m    | New tests for runAstRules, exitWithResult, printDedupedDisplay           |
| Bun mock isolation debugging | 5m        | ~20m   | Unexpected; required 8+ iterations and empirical proof                   |
| Final vet + commit + push    | 5m        | 5m     | Clean on first run                                                       |

## Lessons Learned 🎓

### Applicable Everywhere

- **`afterAll(() => mock.restore())` is mandatory in any file using `mock.module`**. Without it,
  mocks leak into co-located test files when Bun runs tests in the same process.

- **Never assert on a spy after `mockRestore()`**. Call order must be:
  1. call code under test
  2. assert on spy
  3. restore spy

- **Expert review finds bugs invisible to test coverage**. The `countFromDisplay` bug existed in
  production code that had no test coverage (zero calls with `displayViolations` in mock). Static
  code analysis by a capable agent found it where coverage metrics couldn't.

### Specific to Bun's Test Runner

- **Bun v1.3 shares module cache across test files** in the same process (not isolated workers).
  `mock.module("./X")` affects all subsequent files that import from `./X`.

- **`mock.restore()` does not bust the module cache**. After calling `mock.restore()`, a subsequent
  `import("./X")` may still return the cached mocked module. The workaround: append a query string
  (`import("./X?fresh")`) to force Bun to treat it as a new module path, bypassing the cache.

- **The `?fresh` workaround creates a type-blind import**. TypeScript cannot resolve
  `"./X?fresh"`, so a `// @ts-expect-error` or `as any as typeof import("./X")` cast is required.
  Add a comment explaining why the cast exists.

### For Future Agents/Threads

- **The three-expert parallel review pattern is high-value** when the change surface covers 3+
  files or when test coverage gaps are suspected. The cost (3 agent invocations) is justified when
  findings include provable bugs or systematic coverage gaps.

- **When implementing from expert review output**, start with the production code changes (which
  typecheck immediately) before writing tests. Typecheck after each production file change to avoid
  accumulating errors.

## Patterns for Reuse

### Bun Mock Isolation Template

When a test file uses `mock.module`, apply this template:

```typescript
// In contaminating test file (e.g., cli.test.ts)
import { afterAll, ... } from "bun:test";
// ...
mock.module("./some-module.ts", () => ({ fn: mockFn }));
afterAll(() => mock.restore());  // REQUIRED: prevents mock leaking into co-located files

// In a test file that needs the REAL module despite potential contamination:
import { beforeAll, mock, ... } from "bun:test";
type RealFnType = typeof import("./some-module.ts")["fn"];
let realFn: RealFnType;
beforeAll(async () => {
    mock.restore();
    // biome-ignore lint/suspicious/noExplicitAny: ?fresh bypasses contaminated module cache
    const mod = (await import("./some-module.ts?fresh" as any)) as typeof import("./some-module.ts");
    realFn = mod.fn;
});
```

### Expert Review → Implementation Flow

1. `/quality:vet-and-triage` establishes a green baseline
2. `/review:expert-review` with 3 parallel agents produces confidence-scored findings
3. `/review:implement-suggestions high and medium` implements with bead tracking
4. Run vet again to confirm no regressions

This flow is repeatable on any session where the primary task produced non-trivial changes.

## Recommendations

### "If we could redo this thread..."

The thread was efficient except for the Bun mock isolation detour. A single project-level rule
(always add `afterAll(() => mock.restore())` to files using `mock.module`) would have prevented
the entire debugging sequence. The user's prompt was well-formed; no changes needed there.

### Rule Change Proposals

Add to project conventions (AGENTS.md or similar):

```
## Bun Test Isolation

- Every test file that calls `mock.module()` MUST have `afterAll(() => mock.restore())`.
- Test files that need real implementations of modules mocked by other files must use the
  `?fresh` cache-busting import pattern. See docs/post-mortem-2026-03-03-vet-expert-review.md.
- Never assert on a spy AFTER `mockRestore()` — restore is the final cleanup, not an assertion gate.
```

### "Skills we should have loaded"

- **`testing-patterns`** — Would have immediately surfaced the Bun mock isolation pattern
  and the "assert-before-restore" rule. Its description (`TDD, shift-left testing`) doesn't
  overlap with "bun mock isolation" or "mockRestore spy call order" — description should add
  keywords like "mock module cleanup", "spy restore", "test file isolation".

- **`bun`** — Would have surfaced Bun-specific behavior around `mock.module` scoping. The
  user prompt contained "bun test" but the skill description (`Bun JavaScript runtime`) likely
  didn't match because the issue was about the TEST RUNNER behavior specifically, not the runtime.
  Add "test isolation", "mock.module", "module cache" to the bun skill description.

### "Skills which didn't help"

- **`biome-linter-triage`** — Was not loaded; the biome issue was simple enough that the
  glob root-cause was identified from the error output alone. No triage needed.

### "How can we make this work more deterministic?"

1. **Pre-commit hook**: run `bun test` before any commit. Would surface mock contamination
   issues earlier and prevent them from being pushed.

2. **Lint rule**: add a custom biome rule or stepdown-rule that flags test files using
   `mock.module` without a matching `afterAll(() => mock.restore())`. This would make the
   isolation requirement enforceable.

3. **Coverage threshold**: add a coverage threshold to `bun test --coverage` so the pipeline
   fails if any file drops below N%. Would have caught `ast-scan.ts` at 0% automatically in
   a prior session.

### Proposed Workflow

For quality maintenance sessions on this project:

```
1. bun run vet                    → baseline green?
2. /review:expert-review          → any hidden bugs or coverage gaps?
3. /review:implement-suggestions high  → fix high-confidence issues
4. bun run vet                    → confirm green
5. /review:implement-suggestions medium  → fix medium-confidence issues
6. bun run vet                    → confirm green
7. git add + bd sync + git commit + git push
```

Split high and medium into separate passes to limit scope per commit.

## Metrics

- **Goal completion**: 100% — all 5 high/medium findings implemented and passing
- **Time efficiency**: 0.67 — vet+review+implementation could be ~30 min; Bun debugging added ~20 min
- **Quality score**: 9/10 — fixed a real production bug, significant coverage improvement, clean vet
- **Reusability**: high — the vet→review→implement pattern is applicable to every session
- **Documentation quality**: excellent — both the expert synthesis and this post-mortem are thorough

## Follow-up Actions

- [ ] Add `afterAll(() => mock.restore())` rule to project AGENTS.md or test conventions doc
- [ ] Consider adding coverage threshold to `test:coverage` script (e.g., `--coverage-threshold 90`)
- [ ] The remaining `cli.ts` uncovered lines (39-42, 109-111) are the self-execution guard and
      `countFromJsonViolations` — add tests in a future session
- [ ] Update `testing-patterns` skill description to include "mock.module", "spy restore",
      "bun test isolation" keywords
- [ ] Update `bun` skill description to include "test isolation", "mock.module scoping",
      "module cache" keywords

## Related Threads

- `post-mortem-2026-03-03-beads-sprint.md` — previous session that built the CLI; established the
  test file mocking pattern that this session cleaned up
- `post-mortem-2026-03-02-bug-sweep.md` — established the `bun fastvet` pipeline used throughout
