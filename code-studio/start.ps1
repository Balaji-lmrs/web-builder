param([int]$Port = 4317, [switch]$Rebuild)
$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
$websiteRoot = Split-Path -Parent $studioRoot
Push-Location $studioRoot
try {
  if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'node_modules'))) {
    throw 'Code Studio dependencies are missing. Run npm install inside the code-studio folder first.'
  }
  if ($Rebuild -or -not (Test-Path -LiteralPath (Join-Path $studioRoot 'dist/index.html'))) {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Code Studio build failed.' }
  }
  if ($Rebuild -or -not (Test-Path -LiteralPath (Join-Path $studioRoot 'host-dist/index.html'))) {
    Push-Location $websiteRoot
    try {
      & node node_modules/typescript/lib/tsc.js --noEmit
      if ($LASTEXITCODE -ne 0) { throw 'Website type check failed.' }
      & node node_modules/vite/bin/vite.js build --outDir code-studio/host-dist
      if ($LASTEXITCODE -ne 0) { throw 'Website build failed.' }
    } finally { Pop-Location }
  }
  $env:STUDIO_PORT = "$Port"
  & node server.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Code Studio could not start. Check whether another app is using this port.' }
} finally { Pop-Location }
