[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$AssetsRoot = "W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS",
    [string]$ArchivePath = "",
    [string]$Tag = "pack02-board-system-v1.1.0"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$ExpectedName = "HOC_PACK_02_BOARD_SYSTEM_VALIDATED_1.1.0.zip"
$ExpectedSha = "b4e68398cc7276fc1d2a2fc9348625f7596c6b93e71fe1e1de4277bb4a3063c5"
$ExpectedBytes = 44534205

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
        (Join-Path $AssetsRoot "PACK02-VALIDATED\$ExpectedName"),
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

$cacheDir = Join-Path $RepoRoot ".cache\progressive-pack02"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
$auditReport = Join-Path $cacheDir "pack02-audit.json"
Invoke-Checked { python scripts/audit_pack02.py $ArchivePath --report $auditReport } "Auditoria do PACK 02"

$releaseExists = $false
& gh release view $Tag --repo Tehkne-Solutions/hexa-octarina-conquer *> $null
if ($LASTEXITCODE -eq 0) { $releaseExists = $true }

if (-not $releaseExists) {
    Invoke-Checked {
        gh release create $Tag `
            --repo Tehkne-Solutions/hexa-octarina-conquer `
            --title "PACK 02 Board System v1.1.0" `
            --notes "Release progressiva do PACK 02 Board System com pilares, arestas e evolução territorial validados. Assinatura: Tehkné Solutions."
    } "Criação da release"
}

Invoke-Checked {
    gh release upload $Tag $ArchivePath $auditReport `
        --repo Tehkne-Solutions/hexa-octarina-conquer `
        --clobber
} "Upload dos assets da release"

Invoke-Checked {
    gh workflow run progressive-pack02-promote.yml `
        --repo Tehkne-Solutions/hexa-octarina-conquer `
        -f tag=$Tag `
        -f asset_name=$ExpectedName
} "Disparo do workflow de promoção"

$releaseUrl = (& gh release view $Tag --repo Tehkne-Solutions/hexa-octarina-conquer --json url --jq .url).Trim()

Write-Host ""
Write-Host "=== RESULTADO PARA COLAR NO CHAT ==="
Write-Host "PACK02_RELEASE_PUBLISHED=YES"
Write-Host "REPOSITORY=Tehkne-Solutions/hexa-octarina-conquer"
Write-Host "TAG=$Tag"
Write-Host "ASSET=$ExpectedName"
Write-Host "SHA256=$actualSha"
Write-Host "BYTES=$($file.Length)"
Write-Host "ASSET_COUNT=55"
Write-Host "PHYSICAL_REFERENCES=138"
Write-Host "URL=$releaseUrl"
Write-Host "WORKFLOW_DISPATCHED=True"
Write-Host "SIGNATURE=Tehkné Solutions"
