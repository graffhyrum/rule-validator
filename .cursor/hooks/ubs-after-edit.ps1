# afterFileEdit: scan changed files after agent edits. Never block.
$input = [Console]::In.ReadToEnd()
try {
  $output = & ubs --diff --format=json . 2>$null
} catch {
  exit 0
}
if ([string]::IsNullOrWhiteSpace($output)) {
  exit 0
}
try {
  $json = $output | ConvertFrom-Json
  $critical = 0
  $high = 0
  if ($json.scanners) {
    foreach ($s in $json.scanners) {
      if ($null -ne $s.critical) { $critical += [int]$s.critical }
      if ($null -ne $s.high) { $high += [int]$s.high }
    }
  }
  if ($critical -gt 0 -or $high -gt 0) {
    [Console]::Error.WriteLine("⚠️ ubs: $critical critical, $high high findings in changed files. Fix before continuing.")
    [Console]::Error.WriteLine($output)
  }
} catch {
  exit 0
}
exit 0
