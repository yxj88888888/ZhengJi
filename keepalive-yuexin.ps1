$ErrorActionPreference = 'Stop'

$projectDir = 'C:\Users\Administrator\Documents\Codex\golde-page\extracted\golde-page'
$nodeExe = 'C:\Program Files\nodejs\node.exe'
$healthUrl = 'http://127.0.0.1:3000/api/health?format=json'
$keepaliveLog = Join-Path $projectDir 'keepalive-yuexin.log'
$stdoutLog = Join-Path $projectDir 'codex-server.out.log'
$stderrLog = Join-Path $projectDir 'codex-server.err.log'

function Write-KeepaliveLog {
  param([string]$Message)

  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -LiteralPath $keepaliveLog -Value $line -Encoding UTF8
}

function Test-YueXinHealth {
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
    return $response.status -eq 'ok'
  } catch {
    return $false
  }
}

if (Test-YueXinHealth) {
  exit 0
}

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  Write-KeepaliveLog "Port 3000 is occupied, but YueXin health check failed. No process was stopped."
  exit 1
}

if (-not (Test-Path -LiteralPath $nodeExe)) {
  Write-KeepaliveLog "Node executable missing: $nodeExe"
  exit 1
}

Write-KeepaliveLog 'YueXin service is down. Starting server.js.'
Start-Process `
  -FilePath $nodeExe `
  -ArgumentList 'server.js' `
  -WorkingDirectory $projectDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog

for ($attempt = 1; $attempt -le 10; $attempt++) {
  Start-Sleep -Seconds 1
  if (Test-YueXinHealth) {
    Write-KeepaliveLog "YueXin service recovered on attempt $attempt."
    exit 0
  }
}

Write-KeepaliveLog 'YueXin service failed to recover within 10 seconds.'
exit 1
