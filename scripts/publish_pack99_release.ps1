[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$SourceArchive = "",
    [string]$AssetsRoot = "W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS",
    [string]$Tag = "pack99-runtime-v1.0.2",
    [string]$ExpectedSourceSha256 = "5efd54e05cd2a01aa764ad652423d4ceaca0030fb9aca3d233ede3144a3b86e0",
    [string]$ProductionUrl = "https://hexa-octarina-conquer.onrender.com",
    [int]$ProductionAttempts = 30,
    [switch]$SkipProductionGate
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

$PackId = "HOC_PACK_99_FINAL_RUNTIME"
$Signature = "Tehkné Solutions"
$SourceArchiveName = "HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip"
$WebArchiveName = "hoc-pack99-web-full.zip"
$GodotArchiveName = "hoc-pack99-godot-full.zip"

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
        Fail "Comando terminou com código ${LASTEXITCODE}: $FilePath"
    }
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

function Resolve-SourceArchive {
    param(
        [string]$ExplicitPath,
        [string]$Root,
        [string]$Assets
    )

    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
        $candidates += $ExplicitPath
    }
    if (-not [string]::IsNullOrWhiteSpace($Assets)) {
        $candidates += (Join-Path $Assets (Join-Path "PACK99-RECOVERED" $SourceArchiveName))
        $candidates += (Join-Path $Assets $SourceArchiveName)
    }
    $candidates += (Join-Path $Root $SourceArchiveName)
    $candidates += (Join-Path (Split-Path -Parent $Root) $SourceArchiveName)

    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    Fail ("ZIP recuperado 1.0.2 não encontrado. Informe -SourceArchive com o caminho de " + $SourceArchiveName)
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

$requiredFiles = @(
    "scripts\sync_pack99.py",
    "scripts\build_pack99_runtime_index.py",
    "scripts\validate_pack99_promotion.py",
    "scripts\package_pack99_runtime_release.py",
    ".github\workflows\pack99-production-gate.yml"
)
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $relativePath) -PathType Leaf)) {
        Fail "Arquivo obrigatório ausente: $relativePath"
    }
}

$archive = Resolve-SourceArchive -ExplicitPath $SourceArchive -Root $RepoRoot -Assets $AssetsRoot
$actualSourceHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSourceHash -ne $ExpectedSourceSha256.ToLowerInvariant()) {
    Fail "SHA-256 da fonte divergente. Esperado $ExpectedSourceSha256; recebido $actualSourceHash."
}
$sourceBytes = (Get-Item -LiteralPath $archive).Length
if ($sourceBytes -ne 583070593) {
    Fail "Tamanho da fonte divergente. Esperado 583070593; recebido $sourceBytes bytes."
}

$python = Resolve-Python
$pythonCommand = $python.Command
$pythonPrefix = $python.Prefix
$cacheRoot = Join-Path $RepoRoot ".cache\pack99\local-release-1.0.2"
$releaseRoot = Join-Path $cacheRoot "release"
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null

$coreReport = Join-Path $cacheRoot "sync-core-report.json"
$fullReport = Join-Path $cacheRoot "sync-full-report.json"
$promotionReport = Join-Path $releaseRoot "promotion-report.json"
$sourceReport = Join-Path $releaseRoot "source-reassembly-report.json"
$webArchive = Join-Path $releaseRoot $WebArchiveName
$godotArchive = Join-Path $releaseRoot $GodotArchiveName

Write-Host "============================================================"
Write-Host " HOC PACK 99 - PROMOÇÃO E PUBLICAÇÃO INTEGRAL 1.0.2"
Write-Host " $Signature"
Write-Host "============================================================"
Write-Host "Fonte: $archive"
Write-Host "SHA-256: $actualSourceHash"
Write-Host "Bytes: $sourceBytes"
Write-Host ""

$syncScript = Join-Path $RepoRoot "scripts\sync_pack99.py"
$commonSync = @($syncScript, "--source", $archive, "--expected-sha256", $actualSourceHash, "--target", "all", "--clean")
Invoke-Checked -FilePath $pythonCommand -Arguments ($pythonPrefix + $commonSync + @("--profile", "core", "--report", $coreReport))
Invoke-Checked -FilePath $pythonCommand -Arguments ($pythonPrefix + $commonSync + @("--profile", "full", "--report", $fullReport))

$indexScript = Join-Path $RepoRoot "scripts\build_pack99_runtime_index.py"
Invoke-Checked -FilePath $pythonCommand -Arguments ($pythonPrefix + @(
    $indexScript,
    "--runtime-root", (Join-Path $RepoRoot "client\web\public\assets\runtime"),
    "--target", "web"
))
Invoke-Checked -FilePath $pythonCommand -Arguments ($pythonPrefix + @(
    $indexScript,
    "--runtime-root", (Join-Path $RepoRoot "client\godot\assets\runtime"),
    "--target", "godot"
))

$promotionScript = Join-Path $RepoRoot "scripts\validate_pack99_promotion.py"
Invoke-Checked -FilePath $pythonCommand -Arguments ($pythonPrefix + @($promotionScript, "--report", $promotionReport))
$promotion = Get-Content -LiteralPath $promotionReport -Raw -Encoding UTF8 | ConvertFrom-Json
if ($promotion.passed -ne $true -or $promotion.expectedAssetIds -ne 1037 -or $promotion.bootstrapAssetIds -ne 0 -or $promotion.bootstrapAliases -ne 0 -or $promotion.proceduralFallbackMode -ne $false) {
    Fail "O relatório de promoção não aprovou o runtime integral."
}

$packageScript = Join-Path $RepoRoot "scripts\package_pack99_runtime_release.py"
Invoke-Checked -FilePath $pythonCommand -Arguments ($pythonPrefix + @(
    $packageScript,
    "--runtime-root", (Join-Path $RepoRoot "client\web\public\assets\runtime"),
    "--target", "web",
    "--output", $webArchive
))
Invoke-Checked -FilePath $pythonCommand -Arguments ($pythonPrefix + @(
    $packageScript,
    "--runtime-root", (Join-Path $RepoRoot "client\godot\assets\runtime"),
    "--target", "godot",
    "--output", $godotArchive
))

$webReportPath = "$webArchive.report.json"
$godotReportPath = "$godotArchive.report.json"
$webReport = Get-Content -LiteralPath $webReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
$godotReport = Get-Content -LiteralPath $godotReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($report in @($webReport, $godotReport)) {
    if ($report.passed -ne $true -or $report.packId -ne $PackId -or $report.profile -ne "full" -or $report.canonicalAssetCount -ne 1037 -or $report.materializedAssetCount -lt 1850) {
        Fail "Um dos archives finais não atingiu o contrato full."
    }
}

$sourcePayload = [ordered]@{
    project = "Hexa Octarina Conquer"
    packId = $PackId
    provider = "local-validated-source"
    artifact = (Split-Path -Leaf $archive)
    bytes = $sourceBytes
    sha256 = $actualSourceHash
    passed = $true
    signature = $Signature
}
$sourcePayload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $sourceReport -Encoding UTF8

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Fail "GitHub CLI não encontrado. Instale com: winget install --id GitHub.cli"
}
Invoke-Checked -FilePath "gh" -Arguments @("auth", "status")

$repoRemote = (& git -C $RepoRoot remote get-url origin)
if ($LASTEXITCODE -ne 0) { Fail "Não foi possível ler o remote origin." }
if ($repoRemote -match "github\.com[:/](.+?)(?:\.git)?$") {
    $repoSlug = $Matches[1]
} else {
    Fail "Remote origin não pertence ao GitHub: $repoRemote"
}

$releaseExists = $true
& gh release view $Tag --repo $repoSlug *> $null
if ($LASTEXITCODE -ne 0) { $releaseExists = $false }
if (-not $releaseExists) {
    Invoke-Checked -FilePath "gh" -Arguments @(
        "release", "create", $Tag,
        "--repo", $repoSlug,
        "--target", "main",
        "--title", "HOC PACK 99 — Runtime Integral 1.0.2",
        "--notes", "Runtime integral validado com 1.037 IDs canônicos, ao menos 1.850 referências físicas e paridade Web/Godot. Tehkné Solutions."
    )
}

$uploadFiles = @(
    $webArchive,
    "$webArchive.sha256",
    $webReportPath,
    $godotArchive,
    "$godotArchive.sha256",
    $godotReportPath,
    $promotionReport,
    $sourceReport
)
Invoke-Checked -FilePath "gh" -Arguments (@("release", "upload", $Tag, "--repo", $repoSlug, "--clobber") + $uploadFiles)

$releaseBase = "https://github.com/$repoSlug/releases/download/$Tag"
Write-Host ""
Write-Host "Release publicada: https://github.com/$repoSlug/releases/tag/$Tag"
Write-Host "Web: $releaseBase/$WebArchiveName"
Write-Host "Godot: $releaseBase/$GodotArchiveName"
Write-Host "Web SHA-256: $($webReport.sha256)"
Write-Host "Godot SHA-256: $($godotReport.sha256)"

$gateDispatched = $false
if (-not $SkipProductionGate) {
    Invoke-Checked -FilePath "gh" -Arguments @(
        "workflow", "run", "pack99-production-gate.yml",
        "--repo", $repoSlug,
        "--ref", "main",
        "-f", "production_url=$ProductionUrl",
        "-f", "attempts=$ProductionAttempts",
        "-f", "trigger_deploy_hook=true"
    )
    $gateDispatched = $true
}

Write-Host ""
Write-Host "=== RESULTADO PARA COLAR NO CHAT ==="
Write-Host "PACK99_RELEASE_PUBLISHED=YES"
Write-Host "REPOSITORY=$repoSlug"
Write-Host "TAG=$Tag"
Write-Host "SOURCE_SHA256=$actualSourceHash"
Write-Host "WEB_ASSET=$WebArchiveName"
Write-Host "WEB_SHA256=$($webReport.sha256)"
Write-Host "GODOT_ASSET=$GodotArchiveName"
Write-Host "GODOT_SHA256=$($godotReport.sha256)"
Write-Host "CANONICAL_IDS=$($webReport.canonicalAssetCount)"
Write-Host "MATERIALIZED_ENTRIES=$($webReport.materializedAssetCount)"
Write-Host "PRODUCTION_GATE_DISPATCHED=$gateDispatched"
Write-Host "PRODUCTION_URL=$ProductionUrl"
Write-Host $Signature
