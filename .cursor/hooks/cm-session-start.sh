#!/usr/bin/env bash
# sessionStart: inject cm context as additional_context
set -euo pipefail
input=$(cat)
session_id=$(printf '%s' "$input" | jq -r '.session_id // empty')
task="${CURSOR_CM_TASK:-session start}"
ctx=""
if command -v cm >/dev/null 2>&1; then
  if [[ -n "$session_id" ]]; then
    ctx=$(cm context "$task" --format markdown --session "$session_id" 2>/dev/null || true)
  else
    ctx=$(cm context "$task" --format markdown 2>/dev/null || true)
  fi
fi
jq -n --arg ctx "$ctx" '{additional_context: $ctx}'
exit 0
