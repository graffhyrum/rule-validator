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
