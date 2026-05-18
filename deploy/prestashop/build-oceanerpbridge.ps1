param(
    [string]$OutputPath = "$(Split-Path -Parent $PSCommandPath)\oceanerpbridge.zip"
)

$root = Split-Path -Parent $PSCommandPath
$modulePath = Join-Path $root 'oceanerpbridge'

if (-not (Test-Path $modulePath)) {
    throw "Module path not found: $modulePath"
}

if (Test-Path $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
}

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('oceanerpbridge-' + [System.Guid]::NewGuid().ToString('N'))
$temporaryModule = Join-Path $temporaryRoot 'oceanerpbridge'
New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
Copy-Item -Path $modulePath -Destination $temporaryModule -Recurse

try {
    Compress-Archive -Path $temporaryModule -DestinationPath $OutputPath -Force
    Write-Host "Created $OutputPath"
}
finally {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
}
