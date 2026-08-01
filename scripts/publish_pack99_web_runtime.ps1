param(
    [string]$RuntimeRoot = "client/web/public/assets/runtime",
    [string]$Tag = "pack99-runtime-v1.0.2",
    [string]$ArchiveName = "hoc-pack99-web-full.zip",
    [string]$Repository = "Tehkne-Solutions/hexa-octarina-conquer",
    [switch]$ReplaceExisting
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Keep this source file ASCII-safe for Windows PowerShell 5.1. Build the
# official signature at runtime so the accented character is preserved.
$Signature = "Tehkn$([char]0x00E9) Solutions"

function Fail([string]$Message) {
    throw "PACK99_RELEASE_ERROR: $Message"
}

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Fail "Required command not found: $Name"
    }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ResolvedRuntime = if ([System.IO.Path]::IsPathRooted($RuntimeRoot)) {
    $RuntimeRoot
} else {
    Join-Path $RepoRoot $RuntimeRoot
}

if (-not (Test-Path $ResolvedRuntime -PathType Container)) {
    Fail "Web runtime not found at $ResolvedRuntime. Run the full PACK 99 synchronization first."
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
        Fail "Required file missing: $Relative"
    }
}

$Install = Get-Content (Join-Path $ResolvedRuntime "runtime-install.json") -Raw | ConvertFrom-Json
$Index = Get-Content (Join-Path $ResolvedRuntime "pack99/runtime-index.json") -Raw | ConvertFrom-Json
$Aliases = Get-Content (Join-Path $ResolvedRuntime "registry/canonical-runtime-aliases.json") -Raw | ConvertFrom-Json

if ($Install.profile -ne "full") { Fail "runtime-install.profile must be full" }
if ([int]$Install.assetCount -ne 1037) { Fail "runtime-install.assetCount must be 1037" }
if ([int]$Install.unresolvedReferences -ne 0) { Fail "runtime-install.unresolvedReferences must be 0" }
if ($Index.runtimeMode -ne "full") { Fail "runtime-index.runtimeMode must be full" }
if ([int]$Index.canonicalAssetCount -ne 1037) { Fail "runtime-index.canonicalAssetCount must be 1037" }
if (@($Index.assets).Count -lt 1850) { Fail "runtime-index.assets must contain at least 1850 references" }
if ($null -ne $Index.fallback) { Fail "runtime-index.fallback must be null" }

$RequiredAliases = @(
    "HERO_GUARDIAN_01_IDLE_BASE_SW_01",
    "HERO_RANGER_01_IDLE_BASE_NE_01",
    "UNIT_RECRUIT_01_IDLE_BASE_NW_01",
    "CHAMP_BERSERKER_01_IDLE_BASE_NW_01"
)
foreach ($Id in $RequiredAliases) {
    if (-not $Aliases.aliases.PSObject.Properties[$Id]) {
        Fail "Canonical alias missing: $Id"
    }
}

$OutputDir = Join-Path $RepoRoot ".cache/pack99/release"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$ArchivePath = Join-Path $OutputDir $ArchiveName
$ChecksumPath = "$ArchivePath.sha256"

Remove-Item $ArchivePath, $ChecksumPath -Force -ErrorAction SilentlyContinue

Write-Host "Compressing full Web runtime..."
Compress-Archive -Path (Join-Path $ResolvedRuntime "*") -DestinationPath $ArchivePath -CompressionLevel Optimal

$Hash = (Get-FileHash $ArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
"$Hash  $ArchiveName" | Set-Content $ChecksumPath -Encoding ascii

Write-Host "Validating produced archive..."
node -e "const fs=require('node:fs'); const size=fs.statSync(process.argv[1]).size; if(size<=0) process.exit(2); console.log('ARCHIVE_BYTES='+size)" $ArchivePath
if ($LASTEXITCODE -ne 0) { Fail "Archive validation failed" }

& gh auth status
if ($LASTEXITCODE -ne 0) { Fail "GitHub CLI is not authenticated. Run gh auth login." }

$ReleaseExists = $false
& gh release view $Tag --repo $Repository *> $null
if ($LASTEXITCODE -eq 0) { $ReleaseExists = $true }

if (-not $ReleaseExists) {
    Write-Host "Creating release $Tag..."
    $Notes = "Full PACK 99 Web runtime. 1037 canonical IDs, zero unresolved references. $Signature."
    & gh release create $Tag --repo $Repository --title "HOC PACK 99 - Full Web Runtime 1.0.2" --notes $Notes
    if ($LASTEXITCODE -ne 0) { Fail "GitHub Release creation failed" }
}

$UploadArgs = @("release", "upload", $Tag, $ArchivePath, $ChecksumPath, "--repo", $Repository)
if ($ReplaceExisting) { $UploadArgs += "--clobber" }

Write-Host "Uploading archive and checksum..."
& gh @UploadArgs
if ($LASTEXITCODE -ne 0) {
    Fail "Upload failed. Use -ReplaceExisting if the assets already exist."
}

Write-Host "Validating published assets..."
& gh release view $Tag --repo $Repository --json assets --jq ".assets[].name"
if ($LASTEXITCODE -ne 0) { Fail "Published release validation failed" }

Write-Host ""
Write-Host "PACK99_WEB_RELEASE=PASS"
Write-Host "TAG=$Tag"
Write-Host "ARCHIVE=$ArchivePath"
Write-Host "SHA256=$Hash"
Write-Host "NEXT=Request a manual Render deploy and run npm.cmd --prefix .\client\web run verify:production"
Write-Host $Signature
