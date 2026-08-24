$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Get-LanAddress {
  if ($env:DISCORD2_LAN_IP) { return $env:DISCORD2_LAN_IP }
  $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | Sort-Object RouteMetric, InterfaceMetric | Select-Object -First 1
  if ($route) {
    $address = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1
    if ($address) { return $address.IPAddress }
  }
  $fallback = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1
  if (!$fallback) { throw "Nenhum endereco IPv4 de rede foi encontrado." }
  return $fallback.IPAddress
}

Write-Host "[1/5] Iniciando Supabase local..." -ForegroundColor Cyan
& npx supabase start
if ($LASTEXITCODE -ne 0) { throw "O Supabase local nao iniciou. Confirme se o Docker Desktop esta aberto." }
& npx supabase migration up --local
if ($LASTEXITCODE -ne 0) { throw "As migracoes locais nao foram aplicadas." }

Write-Host "[2/5] Lendo as chaves locais..." -ForegroundColor Cyan
$rawStatus = & npx supabase status -o env
$values = @{}
foreach ($line in $rawStatus) {
  if ($line -match '^([A-Z0-9_]+)="?(.*?)"?$') { $values[$matches[1]] = $matches[2].TrimEnd('"') }
}
$publishable = $values["PUBLISHABLE_KEY"]
if (!$publishable) { $publishable = $values["ANON_KEY"] }
$serviceRole = $values["SERVICE_ROLE_KEY"]
if (!$publishable -or !$serviceRole) { throw "Nao foi possivel obter as chaves do Supabase CLI." }

$lanIp = Get-LanAddress
$supabaseUrl = "http://${lanIp}:54321"
$apiUrl = "http://${lanIp}:8787"
$livekitUrl = "ws://${lanIp}:7880"

Write-Host "[3/5] Preparando configuracao para $lanIp..." -ForegroundColor Cyan
$serverEnv = @"
SUPABASE_URL=$supabaseUrl
SUPABASE_PUBLISHABLE_KEY=$publishable
SUPABASE_SERVICE_ROLE_KEY=$serviceRole
LIVEKIT_URL=$livekitUrl
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret-local-discord2
PUBLIC_LIVEKIT_URL=$livekitUrl
PORT=8787
ALLOWED_ORIGINS=*
"@
$desktopEnv = @"
VITE_SUPABASE_URL=$supabaseUrl
VITE_SUPABASE_PUBLISHABLE_KEY=$publishable
VITE_API_URL=$apiUrl
VITE_LIVEKIT_URL=$livekitUrl
"@
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $root ".env.local"), $serverEnv, $utf8)
[IO.File]::WriteAllText((Join-Path $root "apps/desktop/.env.local"), $desktopEnv, $utf8)
$livekitTemplate = [IO.File]::ReadAllText((Join-Path $root "infra/livekit.local.template.yaml")).Replace("__LAN_IP__", $lanIp)
[IO.File]::WriteAllText((Join-Path $root "infra/livekit.local.runtime.yaml"), $livekitTemplate, $utf8)

Write-Host "[4/5] Iniciando LiveKit SFU..." -ForegroundColor Cyan
& docker compose -f infra/docker-compose.local.yml up -d
if ($LASTEXITCODE -ne 0) { throw "O servidor LiveKit nao iniciou." }

Write-Host "[5/5] Abrindo API e aplicativo..." -ForegroundColor Cyan
$serverCommand = "Set-Location '$root'; npm run dev:server"
$desktopCommand = "Set-Location '$root'; npm run dev:desktop"
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $serverCommand
Start-Sleep -Seconds 2
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $desktopCommand

Write-Host ""
Write-Host "FungoCord esta disponivel na rede local:" -ForegroundColor Green
Write-Host "  API:       $apiUrl"
Write-Host "  Supabase:  $supabaseUrl"
Write-Host "  LiveKit:   $livekitUrl"
Write-Host ""
Write-Host "Outros dispositivos devem estar na mesma rede. Mantenha as duas janelas abertas."
