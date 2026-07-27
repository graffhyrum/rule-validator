#!/usr/bin/env bash
# afterFileEdit: scan changed files after agent edits. Never block.
cat >/dev/null || true
output=$(ubs --diff --format=json . 2>/dev/null || true)
if [[ -z "${output// }" ]]; then
  exit 0
fi
critical=$(printf '%s' "$output" | jq '[.scanners[]?.critical // 0] | add // 0' 2>/dev/null || echo 0)
high=$(printf '%s' "$output" | jq '[.scanners[]?.high // 0] | add // 0' 2>/dev/null || echo 0)
if [[ "${critical:-0}" -gt 0 || "${high:-0}" -gt 0 ]]; then
  printf '⚠️ ubs: %s critical, %s high findings in changed files. Fix before continuing.\n' "$critical" "$high" >&2
  printf '%s\n' "$output" >&2
fi
exit 0
