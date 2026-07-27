[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$AssetsRoot = "W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS",
    [string]$ArchivePath = "",
    [string]$Tag = "pack01-terrain-core-v1.1.0"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$ExpectedName = "HOC_PACK_01_TERRAIN_CORE_VALIDATED_1.1.0.zip"
$ExpectedSha = "5cd1fc0844e2d17eefd1e010a62090526d60e74a2090047027a3e511949d0dad"
$ExpectedBytes = 73072823

function Invoke-Checked {
    param([scriptblock]$Command, [string]$Label)
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label falhou com código $LASTEXITCODE."
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Get-Location).Path
}
if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    throw "Repositório não encontrado: $RepoRoot"
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
Set-Location -LiteralPath $RepoRoot

if ([string]::IsNullOrWhiteSpace($ArchivePath)) {
    $candidates = @(
        (Join-Path $AssetsRoot $ExpectedName),
        (Join-Path $AssetsRoot "PACK01-VALIDATED\$ExpectedName"),
        (Join-Path $RepoRoot $ExpectedName)
    )
    $ArchivePath = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if ([string]::IsNullOrWhiteSpace($ArchivePath) -or -not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
    throw "Arquivo $ExpectedName não encontrado. Informe -ArchivePath ou copie o candidato para $AssetsRoot."
}
$ArchivePath = (Resolve-Path -LiteralPath $ArchivePath).Path

$file = Get-Item -LiteralPath $ArchivePath
if ($file.Length -ne $ExpectedBytes) {
    throw "Tamanho divergente: esperado $ExpectedBytes, recebido $($file.Length)."
}
$actualSha = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha -ne $ExpectedSha) {
    throw "SHA-256 divergente: esperado $ExpectedSha, recebido $actualSha."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) não está instalado."
}
Invoke-Checked { gh auth status } "Autenticação do GitHub CLI"

$cacheDir = Join-Path $RepoRoot ".cache\progressive-pack01"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
$auditReport = Join-Path $cacheDir "pack01-audit.json"
Invoke-Checked { python scripts/audit_progressive_pack.py $ArchivePath --report $auditReport } "Auditoria do PACK 01"

$releaseExists = $false
& gh release view $Tag --repo Tehkne-Solutions/hexa-octarina-conquer *> $null
if ($LASTEXITCODE -eq 0) { $releaseExists = $true }

if (-not $releaseExists) {
    Invoke-Checked {
        gh release create $Tag `
            --repo Tehkne-Solutions/hexa-octarina-conquer `
            --title "PACK 01 Terrain Core v1.1.0" `
            --notes "Release progressiva do PACK 01 Terrain Core, incluindo o overlay A01 Grass Flat Premium validado. Assinatura: Tehkné Solutions."
    } "Criação da release"
}

Invoke-Checked {
    gh release upload $Tag $ArchivePath $auditReport `
        --repo Tehkne-Solutions/hexa-octarina-conquer `
        --clobber
} "Upload dos assets da release"

Invoke-Checked {
    gh workflow run progressive-pack01-promote.yml `
        --repo Tehkne-Solutions/hexa-octarina-conquer `
        -f tag=$Tag `
        -f asset_name=$ExpectedName
} "Disparo do workflow de promoção"

$releaseUrl = (& gh release view $Tag --repo Tehkne-Solutions/hexa-octarina-conquer --json url --jq .url).Trim()

Write-Host ""
Write-Host "=== RESULTADO PARA COLAR NO CHAT ==="
Write-Host "PACK01_RELEASE_PUBLISHED=YES"
Write-Host "REPOSITORY=Tehkne-Solutions/hexa-octarina-conquer"
Write-Host "TAG=$Tag"
Write-Host "ASSET=$ExpectedName"
Write-Host "SHA256=$actualSha"
Write-Host "BYTES=$($file.Length)"
Write-Host "ASSET_COUNT=103"
Write-Host "URL=$releaseUrl"
Write-Host "WORKFLOW_DISPATCHED=True"
Write-Host "SIGNATURE=Tehkné Solutions"
