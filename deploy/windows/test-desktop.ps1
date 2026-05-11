param(
    [string]$ServerUrl = "http://192.168.68.70:8080"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$desktop = Join-Path $root "desktop"

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

Write-Host "OceanERP desktop test"
Write-Host "Server URL: $ServerUrl"

Push-Location $desktop
try {
    $env:OCEANERP_WEB_URL = $ServerUrl.TrimEnd("/")
    & $npm install
    & $npm run dev
}
finally {
    Pop-Location
}
