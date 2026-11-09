# Sushi_House local development helper
param(
  [Parameter(Position=0)]
  [ValidateSet('backend','build-mp','watch-mp','check','open','status','help')]
  [string]$Action = 'help'
)
$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot
$FRONTEND = Join-Path $ROOT 'frontend'
$RUNNER = Join-Path $ROOT '_h5run'
$MP = Join-Path $RUNNER 'dist\build\mp-weixin'
$BACKEND = Join-Path $ROOT 'backend'
$DEVTOOLS = 'D:\Tool\微信web开发者工具\cli.bat'
function Show-Status {
  [pscustomobject]@{ Root=$ROOT; Frontend=(Test-Path -LiteralPath $FRONTEND); Runner=(Test-Path -LiteralPath $RUNNER); MpOutput=(Test-Path -LiteralPath (Join-Path $MP 'project.config.json')); BackendDb=(Test-Path -LiteralPath (Join-Path $ROOT 'database\sushi_house.db')); DevToolsCli=(Test-Path -LiteralPath $DEVTOOLS) } | Format-List
}
function Test-Env {
  $ok = $true
  foreach ($p in @((Join-Path $FRONTEND 'manifest.json'),(Join-Path $RUNNER 'package.json'),(Join-Path $RUNNER 'node_modules'),(Join-Path $MP 'project.config.json'),(Join-Path $BACKEND 'src\server.js'),$DEVTOOLS)) {
    $exists = Test-Path -LiteralPath $p
    '{0} {1}' -f ($(if($exists){'OK  '}else{'MISS'})), $p
    if (-not $exists) { $ok = $false }
  }
  $node = node --version
  "Node $node"
  if ([int]($node.TrimStart('v').Split('.')[0]) -lt 22) { 'Node >= 22 is required'; $ok = $false }
  if (-not $ok) { throw 'environment check failed' }
  'environment OK'
}
switch ($Action) {
  'status' { Show-Status }
  'check' { Test-Env }
  'backend' { Push-Location $BACKEND; try { npm start } finally { Pop-Location } }
  'build-mp' { Push-Location $RUNNER; try { npm run build:mp-weixin } finally { Pop-Location }; if (-not (Test-Path -LiteralPath (Join-Path $MP 'project.config.json'))) { throw 'build finished without project.config.json' }; "built: $MP" }
  'watch-mp' { Push-Location $RUNNER; try { npm run dev:mp-weixin } finally { Pop-Location } }
  'open' { if (-not (Test-Path -LiteralPath $DEVTOOLS)) { throw "missing DevTools CLI: $DEVTOOLS" }; if (-not (Test-Path -LiteralPath (Join-Path $MP 'project.config.json'))) { throw "missing build output: $MP" }; & $DEVTOOLS open --project $MP --lang zh }
  default { 'Commands: status | check | backend | build-mp | watch-mp | open' }
}