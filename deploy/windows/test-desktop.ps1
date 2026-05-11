param(
    [string]$ServerUrl = ""
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
if ($ServerUrl) {
    Write-Host "Server URL pre-remplie: $ServerUrl"
}
else {
    Write-Host "Server URL: saisie au demarrage de l'application"
}

Push-Location $desktop
try {
    if ($ServerUrl) {
        $env:OCEANERP_WEB_URL = $ServerUrl.TrimEnd("/")
    }
    else {
        Remove-Item Env:\OCEANERP_WEB_URL -ErrorAction SilentlyContinue
    }
    & $npm install
    & $npm run dev
}
finally {
    Pop-Location
}
