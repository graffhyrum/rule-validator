# Post-Mortem: Zip Rules+Contexts Refactor

**Date**: 2026-03-03
**Duration**: ~15 minutes
**Participants**: Claude Sonnet 4.6
**Status**: Completed

## Executive Summary

Worked rule-validator-31v (P1): eliminate `as` casts in runner.ts by importing
`RuleContext`, annotating `createRuleContext`'s return type, and replacing an
indexed `for` loop with a for-of loop. Initial implementation introduced a
redundant `rule` key in a `pairs` object (already available via `ctx.rule`).
The `/simplify` pass caught and removed it. All 59 tests passed throughout.

## What Went Well ✅

1. **Baseline established immediately** — ran `bun test` before touching code;
   confirmed 59/59 pass gave a clear before/after signal.
2. **Small, precise edits** — three targeted `Edit` calls rather than a full
   rewrite; no unintended side effects.
3. **`/simplify` caught real redundancy** — two of three review agents
   independently identified the duplicate `rule` key in `pairs`. The simplify
   pass converted a slightly worse solution into the best one.
4. **Bead lifecycle respected** — `bd update in_progress` → implement → `bd
close` → commit → `bd sync` → push; no steps skipped.
5. **Epic auto-closed** — recognized that rule-validator-psr was now fully
   satisfied and closed it without prompting.

## What Could Improve ⚠️

1. **First implementation left redundancy** — the `pairs = { rule, ctx }`
   design duplicated state that already existed in `ctx.rule`.
   - **Impact**: Needed a full simplify pass to correct it.
   - **Mitigation**: Before creating a zip/pair structure, check whether the
     paired elements already reference each other. If `ctx.rule === rule`, the
     outer `rule` key is noise.

2. **Simplify ran after commit** — the redundant key was committed and pushed
   before simplify caught it, requiring a second commit.
   - **Impact**: Extra commit noise in history.
   - **Mitigation**: Run `/simplify` before committing, or treat simplify as a
     mandatory gate in the session close checklist.

3. **`beads-start` skill not loaded** — the `/beads-start` command drove the
   session, but no dedicated skill was loaded via the Skill tool. The workflow
   was embedded in the system reminder instead.
   - **Impact**: Minor; the reminder was sufficient.
   - **Mitigation**: None needed here; the system reminder carried full context.

## Key Decisions Made 📌

| Decision                                                | Rationale                                      | Outcome                          |
| ------------------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| Use `Edit` (not `Write`) for runner.ts                  | File >50 lines, targeted replacement safer     | No imports dropped, clean diff   |
| Close rule-validator-psr without extra work             | All 29 sub-beads closed; epic was wrapper only | Correct; project board now clean |
| Fix redundancy post-simplify rather than defend `pairs` | Two agents agreed independently                | Cleaner, smaller code            |

## Time Analysis

| Phase                | Notes                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| Triage / bead review | Parallel fetch of bead details + baseline test                        |
| Implementation       | 3 Edit calls, ~2 min                                                  |
| Verification         | `bun test` — 59 pass                                                  |
| Commit + push        | Blocked once by unstaged beads; resolved with second `bd sync`        |
| Simplify             | 3 parallel agents; identified redundancy; 1 Edit fix; re-test; commit |

## Lessons Learned 🎓

### Applicable Everywhere

- **Check self-referential pairs before zipping**: If you're pairing `(a, b)`
  where `b.a === a`, the outer `a` is redundant. Prefer iterating over `[b]`
  and accessing `b.a` directly.
- **Simplify before commit**: Run `/simplify` (or equivalent review) before
  the first commit, not after. It's cheaper to amend than to push a second
  cleanup commit.

### Specific to This Work

- `RuleContext.rule` already holds the rule reference — any structure pairing
  a rule with its context is duplicating state.
- The `traverseSourceFile` callback is a hot path (called per AST node); keep
  loop bodies minimal and avoid unnecessary destructuring.

### For Future Agents/Threads

- **Recommend**: Read both the file being changed _and_ the types it depends on
  (rule.ts) before designing the data structure for the iteration.
- **Suggest**: Load `typescript` skill for type-safety patterns on TypeScript
  refactors; it would surface the "no redundant state" principle earlier.
- **Avoid**: Creating intermediate tuple/pair structures without first
  inspecting whether the component types already cross-reference each other.

## Patterns for Reuse

**Context-carries-subject pattern**: When a context object already holds a
reference to its subject (`ctx.rule`), iterate over contexts and access the
subject via the context — don't zip them into a separate pair.

```typescript
// Anti-pattern: redundant pairing
const pairs = rules.map((rule) => ({ rule, ctx: createCtx(rule) }));
for (const { rule, ctx } of pairs) {
	rule.visit(ctx, node);
}

// Better: context carries the rule
const contexts = rules.map((rule) => createCtx(rule));
for (const ctx of contexts) {
	ctx.rule.visit(ctx, node);
}
```

Applicable whenever a factory function embeds its input into the returned object.

## Recommendations

### "If we could redo this thread..."

1. Read `rule.ts` first to confirm `RuleContext.rule` exists before designing
   the loop structure. One file read would have prevented the redundant `pairs`
   design.
2. Run `/simplify` before committing, not after.

### Rule Change Proposals

- Add to project `AGENTS.md`: _"Before creating zip/pair structures in
  runner.ts or similar visitor loops, verify the context type does not already
  carry a reference to the paired subject."_

### Skills we should have loaded

- **`typescript`** — would surface "no redundant state" and "derive from
  existing references" patterns earlier. Trigger keywords: "eliminate casts",
  "type annotation", "for-of loop".
- **`refactoring-methods`** — stepdown and single-responsibility checks; might
  have flagged the pairs redundancy in planning.

### Skills which didn't help

- None loaded (session was driven by system reminder + beads-start hook). No
  wasted skill context.

### How can we make this work more deterministic?

- **Hook**: Add a pre-commit hook that runs `/simplify` (or at minimum
  `bun check`) before allowing a commit. Currently `/simplify` is optional
  and post-hoc.
- **Template**: When a bead description says "eliminate as casts", auto-load
  the `typescript` skill.

### Proposed workflow for "eliminate as casts" tasks

1. `bd show <id>` — read bead + acceptance criteria
2. Read the target file **and all imported type files**
3. Identify whether context types already carry back-references
4. Make targeted `Edit` calls
5. Run `/simplify` — before committing
6. `bun test` — confirm baseline
7. Commit, `bd close`, `bd sync`, push

## Metrics

- **Goal completion**: 100% (all acceptance criteria met, both beads closed)
- **Time efficiency**: ~0.85 (slight rework needed for the redundant pairs)
- **Quality score**: 8/10 (clean final state, one avoidable extra commit)
- **Reusability**: High (context-carries-subject pattern is broadly applicable)
- **Documentation quality**: Good

## Follow-up Actions

- [ ] Consider adding "read imported type files before designing loop
      structures" to `AGENTS.md` or a project rule
- [ ] Evaluate making `/simplify` a mandatory pre-commit gate (hook or
      checklist entry)
- [ ] Update `typescript` skill description to include "eliminate as casts"
      as a trigger keyword

## Related Threads

- Prior sprint beads (29 closed): established the single-traversal runner
  architecture this bead built on
- rule-validator-psr epic: fully satisfied by this thread
