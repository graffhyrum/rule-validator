# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Agent Toolkit

### bv — Bead Triage (read-only, use robot flags only)

```bash
bv --robot-triage --format toon | toon -d   # Full triage: priority, health, quick wins
bv --robot-next --format toon | toon -d     # Single top pick
bv --robot-insights --format toon | toon -d # Graph metrics + cycle detection
bv --robot-plan --format toon | toon -d     # Parallel execution tracks
```

Never run bare `bv` — it opens an interactive TUI that blocks the session.

### bd — Beads Issue Tracker

```bash
bd ready --json                             # Next unblocked issue
bd create "<title>" --type bug --priority p0 --label security --json
bd update <id> --status in_progress --json
bd close <id> --reason "Completed" --json
bd list --json
```

### toon — Token-Optimized Output

Pipe any `--robot-*` output through `toon -d` to decode token-efficient format back to JSON.
Add `--format toon` to bv commands; pipe to `toon -d` before passing to tools.

### ms — Skill Discovery

```bash
ms suggest --machine --cwd .               # Load context-relevant skills before starting
ms search "<query>" -m                     # Find skills by intent
ms load "<skill-name>"                     # Load a skill
```

Always run `ms suggest` at session start before implementing anything novel.

### cass — Session Search

```bash
cass search "<query>" --json --limit 5     # Find prior solutions
cass status                                # Index health check
```

Search before implementing to surface prior work from past sessions.

### gh — GitHub CLI

```bash
gh issue list --state open --json number,title,labels
gh pr create --title "<title>" --body "<body>"
gh pr view <number> --json state,reviews,checks
```

### ubs — Security Scanner

```bash
ubs --format=json --diff .                 # Scan only changed files (fast, for pre-commit)
ubs --format=json .                        # Full scan
ubs --staged                               # Scan staged files only
```

Run `ubs --diff` before every commit. Convert critical/high findings to P0/P1 beads.

## TypeScript Coding Rules

### Context-carries-subject pattern

Before creating a zip/pair structure like `{ subject, ctx }`, check whether the
context type already holds a reference to the subject (e.g. `ctx.rule`). If it
does, the outer key is redundant — iterate over contexts and access the subject
via the context instead.

```typescript
// ❌ redundant: ctx.rule === rule
const pairs = rules.map((rule) => ({ rule, ctx: createCtx(rule) }));
for (const { rule, ctx } of pairs) {
	rule.visit(ctx, node);
}

// ✅ context already carries the reference
const contexts = rules.map((rule) => createCtx(rule));
for (const ctx of contexts) {
	ctx.rule.visit(ctx, node);
}
```

Read all imported type files before designing loop structures involving context objects.

### Code quality gate

Run `/simplify` before committing. The `PostToolUse` UBS hook catches security issues;
`/simplify` catches redundancy and quality issues that static analysis misses.

## Bun Test Isolation Rules

Bun shares a single module cache across all test files in a run. `mock.module()` patches
that shared cache, so a mock left open after one file completes will bleed into every
subsequent file that imports the same path.

### Rule 1 — always restore after mock.module

Every test file that calls `mock.module()` must restore the cache in `afterAll`:

```typescript
import { mock, afterAll } from "bun:test";

mock.module("./some-dependency.ts", () => ({ getValue: () => 42 }));

afterAll(() => mock.restore());
```

Omitting `afterAll(() => mock.restore())` causes cross-file contamination whose
symptom is a test that passes in isolation but fails (or vice-versa) when the full
suite runs.

### Rule 2 — use the `?fresh` pattern to access the real module from a mocked path

Inside a file that has already called `mock.module("./foo.ts", ...)`, a normal
`import` of `./foo.ts` returns the mock. To obtain the real (unmocked) module in the
same file, append the `?fresh` query suffix to bust the cache:

```typescript
// The mock is in effect for the bare path:
mock.module("./compiler.ts", () => ({ compile: mockCompile }));

// Retrieve the real module via cache-busting import (type cast required because
// Bun does not expose ?fresh in its TypeScript types):
const real = await (import as (s: string) => Promise<unknown>)(
  "./compiler.ts?fresh"
);
```

The `as (s: string) => Promise<unknown>` cast is required because the TypeScript
compiler rejects string expressions with query suffixes through the normal
`import()` call signature. Cast the result to the expected module type before use.
