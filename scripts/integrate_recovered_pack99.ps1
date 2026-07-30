[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PartsDirectory,

    [string]$RepoRoot = "",

    [string]$BaseName = "HOC_PACK_99_FINAL_RUNTIME_RECOVERED(1)",

    [string]$ExpectedSha256 = "1d0fbbeda1f50bd61830b28f562fdcf434570b4db0920e47e30612f2c134d56f",

    [switch]$SkipCore
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

function Fail([string]$Message) {
    throw $Message
}

function Resolve-Python {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return @{ Command = "py"; Prefix = @("-3") }
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return @{ Command = "python"; Prefix = @() }
    }
    Fail "Python 3 não foi encontrado no PATH."
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    Write-Host ("> " + $FilePath + " " + ($Arguments -join " "))
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        Fail "Comando terminou com código ${LASTEXITCODE}: $FilePath"
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Get-Location).Path
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$PartsDirectory = (Resolve-Path -LiteralPath $PartsDirectory).Path

if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".git") -PathType Container)) {
    Fail "A pasta não é um checkout Git: $RepoRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot "scripts\sync_pack99.py") -PathType Leaf)) {
    Fail "scripts\sync_pack99.py não foi encontrado em $RepoRoot"
}

$parts = @(
    (Join-Path $PartsDirectory "$BaseName.z01"),
    (Join-Path $PartsDirectory "$BaseName.z02"),
    (Join-Path $PartsDirectory "$BaseName.z03"),
    (Join-Path $PartsDirectory "$BaseName.z04"),
    (Join-Path $PartsDirectory "$BaseName.z05"),
    (Join-Path $PartsDirectory "$BaseName.zip")
)

foreach ($part in $parts) {
    if (-not (Test-Path -LiteralPath $part -PathType Leaf)) {
        Fail "Parte ausente: $part"
    }
}

$cacheRoot = Join-Path $RepoRoot ".cache\pack99\recovered-source"
New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null
$archive = Join-Path $cacheRoot "HOC_PACK_99_FINAL_RUNTIME_RECOVERED.zip"
$tempArchive = "$archive.part"
Remove-Item -LiteralPath $tempArchive -Force -ErrorAction SilentlyContinue

Write-Host "============================================================"
Write-Host " HOC PACK 99 - RECONSTRUÇÃO E INTEGRAÇÃO DA FONTE RECUPERADA"
Write-Host " Tehkné Solutions"
Write-Host "============================================================"
Write-Host "Partes: $PartsDirectory"
Write-Host "Destino: $archive"
Write-Host ""

$output = [System.IO.File]::Open($tempArchive, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
try {
    foreach ($part in $parts) {
        Write-Host "Anexando $(Split-Path -Leaf $part)..."
        $input = [System.IO.File]::OpenRead($part)
        try {
            $input.CopyTo($output)
        } finally {
            $input.Dispose()
        }
    }
} finally {
    $output.Dispose()
}
Move-Item -LiteralPath $tempArchive -Destination $archive -Force

$actualSha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
    Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
    Fail "SHA-256 divergente. Esperado $ExpectedSha256; recebido $actualSha256."
}

$archiveBytes = (Get-Item -LiteralPath $archive).Length
Write-Host "Arquivo reconstruído e validado."
Write-Host "SHA-256: $actualSha256"
Write-Host "Bytes: $archiveBytes"
Write-Host ""

$python = Resolve-Python
$syncScript = Join-Path $RepoRoot "scripts\sync_pack99.py"

if (-not $SkipCore) {
    Invoke-Checked -FilePath $python.Command -Arguments ($python.Prefix + @(
        $syncScript,
        "--source", $archive,
        "--expected-sha256", $actualSha256,
        "--repo", $RepoRoot,
        "--target", "all",
        "--profile", "core",
        "--clean",
        "--report", (Join-Path $cacheRoot "sync-core-report.json")
    ))
}

Invoke-Checked -FilePath $python.Command -Arguments ($python.Prefix + @(
    $syncScript,
    "--source", $archive,
    "--expected-sha256", $actualSha256,
    "--repo", $RepoRoot,
    "--target", "all",
    "--profile", "full",
    "--clean",
    "--report", (Join-Path $cacheRoot "sync-full-report.json")
))

Write-Host ""
Write-Host "=== RESULTADO PARA COLAR NO CHAT ==="
Write-Host "PACK99_RECOVERED_SOURCE=VALIDATED"
Write-Host "PACK99_SOURCE_SHA256=$actualSha256"
Write-Host "PACK99_SOURCE_BYTES=$archiveBytes"
Write-Host "PACK99_CORE_SYNC=$(-not $SkipCore)"
Write-Host "PACK99_FULL_SYNC=YES"
Write-Host "PACK99_TARGETS=WEB,GODOT"
Write-Host "PACK99_NEXT_STEP=RUNTIME_VISUAL_VALIDATION"
Write-Host "Tehkné Solutions"
