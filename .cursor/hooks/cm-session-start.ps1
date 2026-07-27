# sessionStart: inject cm context as additional_context
$input = [Console]::In.ReadToEnd()
$session_id = ""
try {
  $payload = $input | ConvertFrom-Json
  if ($payload.session_id) { $session_id = [string]$payload.session_id }
} catch {}
$task = if ($env:CURSOR_CM_TASK) { $env:CURSOR_CM_TASK } else { "session start" }
$ctx = ""
$cm = Get-Command cm -ErrorAction SilentlyContinue
if ($cm) {
  try {
    if ($session_id) {
      $ctx = & cm context $task --format markdown --session $session_id 2>$null | Out-String
    } else {
      $ctx = & cm context $task --format markdown 2>$null | Out-String
    }
  } catch {
    $ctx = ""
  }
}
@{ additional_context = $ctx } | ConvertTo-Json -Compress
exit 0
