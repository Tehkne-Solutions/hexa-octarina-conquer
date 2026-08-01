param(
    [string]$RuntimeRoot = "client/web/public/assets/runtime",
    [string]$Tag = "pack99-runtime-v1.0.2",
    [string]$ArchiveName = "hoc-pack99-web-full.zip",
    [string]$Repository = "Tehkne-Solutions/hexa-octarina-conquer",
    [switch]$ReplaceExisting
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail([string]$Message) {
    throw "PACK99_RELEASE_ERROR: $Message"
}

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Fail "Comando obrigatório não encontrado: $Name"
    }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ResolvedRuntime = if ([System.IO.Path]::IsPathRooted($RuntimeRoot)) {
    $RuntimeRoot
} else {
    Join-Path $RepoRoot $RuntimeRoot
}

if (-not (Test-Path $ResolvedRuntime -PathType Container)) {
    Fail "Runtime Web não encontrado em $ResolvedRuntime. Execute primeiro a sincronização full do PACK 99."
}

Require-Command "gh"
Require-Command "node"

$RequiredFiles = @(
    "runtime-install.json",
    "pack99/runtime-index.json",
    "registry/assets-runtime.json",
    "registry/canonical-runtime-aliases.json"
)

foreach ($Relative in $RequiredFiles) {
    $Path = Join-Path $ResolvedRuntime $Relative
    if (-not (Test-Path $Path -PathType Leaf)) {
        Fail "Arquivo obrigatório ausente: $Relative"
    }
}

$Install = Get-Content (Join-Path $ResolvedRuntime "runtime-install.json") -Raw | ConvertFrom-Json
$Index = Get-Content (Join-Path $ResolvedRuntime "pack99/runtime-index.json") -Raw | ConvertFrom-Json
$Aliases = Get-Content (Join-Path $ResolvedRuntime "registry/canonical-runtime-aliases.json") -Raw | ConvertFrom-Json

if ($Install.profile -ne "full") { Fail "runtime-install.profile deve ser full" }
if ([int]$Install.assetCount -ne 1037) { Fail "runtime-install.assetCount deve ser 1037" }
if ([int]$Install.unresolvedReferences -ne 0) { Fail "runtime-install.unresolvedReferences deve ser 0" }
if ($Index.runtimeMode -ne "full") { Fail "runtime-index.runtimeMode deve ser full" }
if ([int]$Index.canonicalAssetCount -ne 1037) { Fail "runtime-index.canonicalAssetCount deve ser 1037" }
if (@($Index.assets).Count -lt 1850) { Fail "runtime-index.assets deve conter pelo menos 1850 referências" }
if ($null -ne $Index.fallback) { Fail "runtime-index.fallback deve ser null" }

$RequiredAliases = @(
    "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
    "HERO_RANGER_01_IDLE_BASE_NE_01",
    "UNIT_RECRUIT_01_IDLE_BASE_NW_01",
    "CHAMP_BERSERKER_01_IDLE_BASE_NW_01"
)
foreach ($Id in $RequiredAliases) {
    if (-not $Aliases.aliases.PSObject.Properties[$Id]) {
        Fail "Alias canônico ausente: $Id"
    }
}

$OutputDir = Join-Path $RepoRoot ".cache/pack99/release"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$ArchivePath = Join-Path $OutputDir $ArchiveName
$ChecksumPath = "$ArchivePath.sha256"

Remove-Item $ArchivePath, $ChecksumPath -Force -ErrorAction SilentlyContinue

Write-Host "Compactando runtime integral..."
Compress-Archive -Path (Join-Path $ResolvedRuntime "*") -DestinationPath $ArchivePath -CompressionLevel Optimal

$Hash = (Get-FileHash $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
"$Hash  $ArchiveName" | Set-Content $ChecksumPath -Encoding ascii

Write-Host "Validando archive produzido..."
node -e "const fs=require('node:fs'); const z=require('node:zlib'); console.log('ARCHIVE_BYTES='+fs.statSync(process.argv[1]).size)" $ArchivePath
if ($LASTEXITCODE -ne 0) { Fail "Falha ao validar o archive" }

& gh auth status
if ($LASTEXITCODE -ne 0) { Fail "GitHub CLI não autenticado. Execute gh auth login." }

$ReleaseExists = $false
& gh release view $Tag --repo $Repository *> $null
if ($LASTEXITCODE -eq 0) { $ReleaseExists = $true }

if (-not $ReleaseExists) {
    Write-Host "Criando release $Tag..."
    & gh release create $Tag --repo $Repository --title "HOC PACK 99 — Runtime Web Integral 1.0.2" --notes "Runtime Web integral do PACK 99. 1037 IDs canônicos, zero referências não resolvidas. Tehkné Solutions."
    if ($LASTEXITCODE -ne 0) { Fail "Falha ao criar GitHub Release" }
}

$Clobber = if ($ReplaceExisting) { @("--clobber") } else { @() }
Write-Host "Enviando archive e checksum..."
& gh release upload $Tag $ArchivePath $ChecksumPath --repo $Repository @Clobber
if ($LASTEXITCODE -ne 0) {
    Fail "Falha no upload. Use -ReplaceExisting se os assets já existirem."
}

Write-Host "Validando assets publicados..."
& gh release view $Tag --repo $Repository --json assets --jq ".assets[].name"
if ($LASTEXITCODE -ne 0) { Fail "Não foi possível validar a release publicada" }

Write-Host ""
Write-Host "PACK99_WEB_RELEASE=PASS"
Write-Host "TAG=$Tag"
Write-Host "ARCHIVE=$ArchivePath"
Write-Host "SHA256=$Hash"
Write-Host "NEXT=Solicite um novo deploy manual no Render e execute npm.cmd --prefix .\client\web run verify:production"
Write-Host "Tehkné Solutions"
