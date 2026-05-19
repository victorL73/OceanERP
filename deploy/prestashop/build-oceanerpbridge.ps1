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
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $archive = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem -LiteralPath $temporaryModule -Recurse -File | ForEach-Object {
            $relativePath = $_.FullName.Substring($temporaryRoot.Length).TrimStart(
                [System.IO.Path]::DirectorySeparatorChar,
                [System.IO.Path]::AltDirectorySeparatorChar
            )
            $entryName = $relativePath.Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive,
                $_.FullName,
                $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
    finally {
        $archive.Dispose()
    }

    Write-Host "Created $OutputPath"
}
finally {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
}
