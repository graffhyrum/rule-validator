#!/usr/bin/env bash
# beforeShellExecution: adapt Cursor {command} → dcg test --robot → Cursor permission JSON
set -euo pipefail
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.command // empty')
if [[ -z "$cmd" ]]; then
  printf '%s\n' '{"permission":"allow"}'
  exit 0
fi
result=$(dcg test --format json --robot -- "$cmd" 2>/dev/null || true)
decision=$(printf '%s' "$result" | jq -r '.decision // "allow"')
if [[ "$decision" == "deny" ]]; then
  reason=$(printf '%s' "$result" | jq -r '.reason // "Blocked by dcg"')
  rule=$(printf '%s' "$result" | jq -r '.rule_id // "dcg"')
  msg=$(printf 'dcg blocked (%s): %s' "$rule" "$reason")
  jq -n --arg m "$msg" '{permission:"deny", user_message:$m, agent_message:$m}'
  exit 0
fi
printf '%s\n' '{"permission":"allow"}'
exit 0
