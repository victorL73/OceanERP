param(
    [string]$ServerUrl = "https://erp.example.com"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$desktop = Join-Path $root "desktop"

Write-Host "OceanERP Windows installer build"
Write-Host "Server URL: $ServerUrl"

Push-Location $desktop
try {
    $env:OCEANERP_WEB_URL = $ServerUrl
    npm install
    npm run dist:win
}
finally {
    Pop-Location
}

