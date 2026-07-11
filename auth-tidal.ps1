$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $Root 'binlossless'
$Auth = Join-Path $ApiDir 'tidalapi-auth.exe'
if (-not (Test-Path $Auth)) { throw "Missing portable tidalapi auth tool: $Auth" }
Write-Host 'Starting TIDAL authentication through EbbLabs/python-tidal.' -ForegroundColor Cyan
Push-Location $ApiDir
try { & $Auth } finally { Pop-Location }
if (Test-Path (Join-Path $ApiDir 'token.json')) {
    Write-Host 'tidalapi session saved in the portable folder.' -ForegroundColor Green
} else {
    Write-Host 'No token.json was created; authentication did not complete.' -ForegroundColor Yellow
}
