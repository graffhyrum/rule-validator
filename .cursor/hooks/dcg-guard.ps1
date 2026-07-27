# beforeShellExecution: adapt Cursor {command} → dcg test --robot → Cursor permission JSON
$input = [Console]::In.ReadToEnd()
try {
  $payload = $input | ConvertFrom-Json
  $cmd = $payload.command
} catch {
  Write-Output '{"permission":"allow"}'
  exit 0
}
if ([string]::IsNullOrWhiteSpace($cmd)) {
  Write-Output '{"permission":"allow"}'
  exit 0
}
try {
  $resultRaw = & dcg test --format json --robot -- $cmd 2>$null
  $result = $resultRaw | ConvertFrom-Json
  $decision = if ($result.decision) { $result.decision } else { "allow" }
  if ($decision -eq "deny") {
    $reason = if ($result.reason) { $result.reason } else { "Blocked by dcg" }
    $rule = if ($result.rule_id) { $result.rule_id } else { "dcg" }
    $msg = "dcg blocked ($rule): $reason"
    $out = @{
      permission = "deny"
      user_message = $msg
      agent_message = $msg
    } | ConvertTo-Json -Compress
    Write-Output $out
    exit 0
  }
} catch {
  Write-Output '{"permission":"allow"}'
  exit 0
}
Write-Output '{"permission":"allow"}'
exit 0
