# Post-Mortem: 214381fe-0755-4c4f-8675-99816ca87594

**Date**: 2026-09-26
**Status**: Completed

## Executive Summary

The previous post-mortem named three legacy files and told the user to move them. The user rejected that handoff. The files were then moved with `git mv` into `docs/post-mortems/`, and the empty `documents/` directory was removed.

## Bead Outcomes

- Closed: none
- Opened: none
- Modified: none

`br diff` is not a subcommand of this `br`. No open pull requests.

## What Went Well

1. **Tracked rename** - `git mv` recorded three renames. The files stayed in git history.
2. **Known destinations** - Post-mortems went to `docs/post-mortems/`. No distillation files were in `documents/`.
3. **Empty directory** - `documents/` had no remaining files, so it was removed.
4. **Record update** - The prior post-mortem checklist item was marked done after the move.

## What Could Improve

1. **User handoff for a known move** - The first post-mortem listed the exact source paths and the exact destination, then left the move as a follow-up for the user.
   - **Impact**: One extra user turn. The paths were already known.
   - **Mitigation**: When both paths are known, move the files in that same turn.

## Key Decisions

| Decision                        | Rationale                                                                                               | Outcome                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `git mv` the three post-mortems | The files were tracked. The destination is `docs/post-mortems/`                                         | Git status shows three renames |
| Remove `documents/`             | The directory was empty after the moves                                                                 | The old location is gone       |
| Do not start distillation       | This request was a default post-mortem. Pending count is above 3, so distillation is suggested, not run | Sources stay until `--distill` |

## Lessons Learned

### Applicable Everywhere

- When the source path and the destination path are both known, move the files in the same turn. Do not assign that move to the user.

### Specific to This Work

- Post-mortem files belong in `docs/post-mortems/`. Distillation files belong in `docs/`.
- Use `git mv` for a tracked file. Remove `documents/` only after it is empty.
- A move is not a delete. The post-mortems stayed in the repo.

## Remediation

### Remediation Hierarchy (mandatory)

A hook cannot know that a prose follow-up is a file move. A script would need the skill's path rules. The cause is the post-mortem skill text: the migration guard says to print `mv` commands and halt. That text made the agent ask. The fix is a skill change: run those moves, then continue the post-mortem write. Distillation stays a separate step. An always-loaded instruction is the wrong tier. The same lesson is stored with `cm add` so the next session sees it before the skill is edited.

### Verification

- **Test**: On a later default post-mortem, a file that still sits in `documents/post-mortem-*.md` is moved to `docs/post-mortems/` with no user prompt. `git status` shows a rename.
- **Bypass mode**: `cm` does not run under `--no-verify`. The skill text still says to print the `mv` commands until that paragraph is edited. A session that follows the skill literally will ask again.

### Skill Coverage

Skills relevant to this session (`ms suggest --machine --cwd .`): grilling, teach, cove-question, sync-changelog, qa.

Skills actually loaded: post-mortem.

Gap: none of the `ms` suggestions describe a known file move. The matching rule was already in `cm` (`b-muj1xg8m-exs9ad`: do a small fix, ask only when the new scope is large). It was not applied until the user corrected the handoff.

### Skill Gaps

- The post-mortem migration guard tells the agent to emit `mv` commands for the user. Change that paragraph so the agent runs the moves.
- grilling, teach, cove-question, sync-changelog, and qa did not apply to this turn.

### Infrastructure Actions (non-rule)

- No hook, script, or package change.

## Follow-up Actions

- [ ] Edit the post-mortem skill migration guard so a known `documents/` to `docs/post-mortems/` move is executed, not assigned to the user.
- [ ] No new hook, script, or always-loaded instruction.

```bash
# Dedup check before creating a tracker item:
br search "execute known file move" 2>/dev/null | grep -q "." && echo "SIMILAR ITEM EXISTS — skip" || \
  br create --title="Post-mortem skill should move known legacy files" \
    --description="Identified in post-mortem 2026-09-26" \
    --type task --priority p3
```

## Candidate Rules (for cm reflect)

- **Pattern**: "When the source path and the destination path are both known, move the files in the same turn. Do not assign that move to the user." (source: this post-mortem)

## cm Feedback

[cass: helpful b-muj1xg8m-exs9ad]
[cass: helpful b-muirjrn9-0ind5k]
[cass: harmful none]

## cm Session Close

```bash
cm mark b-muj1xg8m-exs9ad --helpful --json
cm mark b-muirjrn9-0ind5k --helpful --json
```

## Related Threads

- `docs/post-mortems/post-mortem-2026-09-26-reachable-line-coverage-tests.md`
- Session: `214381fe-0755-4c4f-8675-99816ca87594`
