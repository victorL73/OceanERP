param(
    [string]$ServerUrl = ""
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
if ($ServerUrl) {
    Write-Host "Server URL pre-remplie: $ServerUrl"
}
else {
    Write-Host "Server URL: saisie au demarrage de l'application"
}

New-Item -ItemType Directory -Force -Path $configDir | Out-Null
if ($ServerUrl) {
    @{
        serverUrl = $ServerUrl.TrimEnd("/")
    } | ConvertTo-Json | Set-Content -Path $configFile -Encoding UTF8
}
elseif (Test-Path $configFile) {
    Remove-Item -Path $configFile -Force
}

Push-Location $desktop
try {
    if ($ServerUrl) {
        $env:OCEANERP_WEB_URL = $ServerUrl
    }
    else {
        Remove-Item Env:\OCEANERP_WEB_URL -ErrorAction SilentlyContinue
    }
    & $npm install
    & $npm run dist:win
}
finally {
    Pop-Location
}
