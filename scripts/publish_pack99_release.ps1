[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$AssetsRoot = "W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS",
    [string]$Tag = "pack99-runtime-v1.0.1",
    [string]$ArchiveName = "HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip",
    [string]$ExpectedSha256 = "f72cce299fd28c8bb8520320871d90057884bb0ec19dd449f1c3d07e56a71bbe",
    [switch]$SkipWorkflow
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

function Fail([string]$Message) {
    throw $Message
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    Write-Host ("> " + $FilePath + " " + ($Arguments -join " "))
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        Fail "Comando terminou com código $LASTEXITCODE: $FilePath"
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Get-Location).Path
}
if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
    Fail "Repositório não encontrado: $RepoRoot"
}
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".git"))) {
    Fail "A pasta não é um checkout Git: $RepoRoot"
}
if (-not (Test-Path -LiteralPath $AssetsRoot -PathType Container)) {
    Fail "Pasta de assets não encontrada: $AssetsRoot"
}
$AssetsRoot = (Resolve-Path -LiteralPath $AssetsRoot).Path

$archive = Join-Path $AssetsRoot (Join-Path "PACK99-RECOVERED" $ArchiveName)
if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
    Fail "ZIP recuperado não encontrado: $archive"
}

$actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $ExpectedSha256.ToLowerInvariant()) {
    Fail "SHA-256 divergente. Esperado $ExpectedSha256; recebido $actualHash."
}

$archiveBytes = (Get-Item -LiteralPath $archive).Length
if ($archiveBytes -lt 500000000) {
    Fail "O ZIP full parece incompleto: $archiveBytes bytes."
}

$promotionReport = Join-Path $RepoRoot ".cache\pack99\promotion-report.json"
if (-not (Test-Path -LiteralPath $promotionReport -PathType Leaf)) {
    Fail "Relatório de promoção não encontrado: $promotionReport"
}
$promotion = Get-Content -LiteralPath $promotionReport -Raw -Encoding UTF8 | ConvertFrom-Json
if ($promotion.passed -ne $true -or $promotion.expectedAssetIds -ne 1037 -or $promotion.bootstrapAssetIds -ne 0 -or $promotion.bootstrapAliases -ne 0 -or $promotion.proceduralFallbackMode -ne $false) {
    Fail "O relatório local de promoção não está integralmente aprovado."
}

$python = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
    $python = "py"
    $pythonPrefix = @("-3")
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $python = "python"
    $pythonPrefix = @()
} else {
    Fail "Python 3 não foi encontrado no PATH."
}

$integrityReport = Join-Path $AssetsRoot "PACK99-REPORTS\PACK99_ARCHIVE_INTEGRITY_REPORT.json"
$integrityArgs = $pythonPrefix + @(
    (Join-Path $RepoRoot "scripts\audit_pack99_archive.py"),
    $archive,
    "--report", $integrityReport,
    "--summary-only"
)
Invoke-Checked -FilePath $python -Arguments $integrityArgs
$integrity = Get-Content -LiteralPath $integrityReport -Raw -Encoding UTF8 | ConvertFrom-Json
if ($integrity.passed -ne $true -or $integrity.assets -ne 1037 -or $integrity.unresolvedRuntimeReferences -ne 0 -or $integrity.hashedFiles -ne $integrity.fileCount) {
    Fail "A auditoria integral do ZIP não foi aprovada."
}

$repoSlug = (& git -C $RepoRoot remote get-url origin)
if ($LASTEXITCODE -ne 0) { Fail "Não foi possível ler o remote origin." }
if ($repoSlug -match "github\.com[:/](.+?)(?:\.git)?$") {
    $repoSlug = $Matches[1]
} else {
    Fail "Remote origin não pertence ao GitHub: $repoSlug"
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Fail "GitHub CLI não encontrado. Instale com: winget install --id GitHub.cli"
}
Invoke-Checked -FilePath "gh" -Arguments @("auth", "status")

$reportPath = "$archive.report.json"
$hashPath = "$archive.sha256"
if (-not (Test-Path -LiteralPath $hashPath -PathType Leaf)) {
    Set-Content -LiteralPath $hashPath -Encoding UTF8 -NoNewline -Value "$actualHash  $ArchiveName`n"
}

$releaseExists = $true
& gh release view $Tag --repo $repoSlug *> $null
if ($LASTEXITCODE -ne 0) { $releaseExists = $false }

if (-not $releaseExists) {
    Invoke-Checked -FilePath "gh" -Arguments @(
        "release", "create", $Tag,
        "--repo", $repoSlug,
        "--title", "HOC PACK 99 Runtime v1.0.1",
        "--notes", "Runtime integral validado com 1.037 IDs idênticos no Web e Godot. Distribuição oficial da Tehkné Solutions."
    )
}

$uploadFiles = @($archive, $hashPath, $promotionReport, $integrityReport)
if (Test-Path -LiteralPath $reportPath -PathType Leaf) {
    $uploadFiles += $reportPath
}
$summaryPath = Join-Path $AssetsRoot "PACK99-REPORTS\PACK99_LOCAL_PROMOTION_RESULT.md"
if (Test-Path -LiteralPath $summaryPath -PathType Leaf) {
    $uploadFiles += $summaryPath
}

$uploadArgs = @("release", "upload", $Tag, "--repo", $repoSlug, "--clobber") + $uploadFiles
Invoke-Checked -FilePath "gh" -Arguments $uploadArgs

$downloadUrl = "https://github.com/$repoSlug/releases/download/$Tag/$ArchiveName"
Write-Host ""
Write-Host "Release asset publicado: $downloadUrl"
Write-Host "SHA-256: $actualHash"
Write-Host "Bytes: $archiveBytes"
Write-Host "Arquivos auditados: $($integrity.hashedFiles)"

if (-not $SkipWorkflow) {
    Invoke-Checked -FilePath "gh" -Arguments @(
        "workflow", "run", "pack99-release-promote.yml",
        "--repo", $repoSlug,
        "--ref", "main",
        "-f", "tag=$Tag",
        "-f", "asset_name=$ArchiveName",
        "-f", "sha256=$actualHash",
        "-f", "publish_artifacts=true"
    )
}

Write-Host ""
Write-Host "=== RESULTADO PARA COLAR NO CHAT ==="
Write-Host "PACK99_RELEASE_PUBLISHED=YES"
Write-Host "REPOSITORY=$repoSlug"
Write-Host "TAG=$Tag"
Write-Host "ASSET=$ArchiveName"
Write-Host "SHA256=$actualHash"
Write-Host "BYTES=$archiveBytes"
Write-Host "HASHED_FILES=$($integrity.hashedFiles)"
Write-Host "URL=$downloadUrl"
Write-Host "WORKFLOW_DISPATCHED=$(-not $SkipWorkflow)"
Write-Host "Tehkné Solutions"
