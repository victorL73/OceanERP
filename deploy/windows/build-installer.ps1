param(
    [string]$ServerUrl = "https://erp.example.com"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$desktop = Join-Path $root "desktop"
$configDir = Join-Path $desktop "config"
$configFile = Join-Path $configDir "default-server.json"

function Resolve-Npm {
    $command = Get-Command npm -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $programFilesNpm = "C:\Program Files\nodejs\npm.cmd"
    if (Test-Path $programFilesNpm) {
        return $programFilesNpm
    }

    throw "npm est introuvable. Installe Node.js LTS puis rouvre PowerShell : winget install OpenJS.NodeJS.LTS"
}

$npm = Resolve-Npm

Write-Host "OceanERP Windows installer build"
Write-Host "Server URL: $ServerUrl"

New-Item -ItemType Directory -Force -Path $configDir | Out-Null
@{
    serverUrl = $ServerUrl.TrimEnd("/")
} | ConvertTo-Json | Set-Content -Path $configFile -Encoding UTF8

Push-Location $desktop
try {
    $env:OCEANERP_WEB_URL = $ServerUrl
    & $npm install
    & $npm run dist:win
}
finally {
    Pop-Location
}
