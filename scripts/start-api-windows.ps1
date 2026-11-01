$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location (Join-Path $projectRoot 'apps/web')
try {
    & node ../../node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000
    if ($LASTEXITCODE -ne 0) { throw "API exited with code $LASTEXITCODE." }
} finally { Pop-Location }
