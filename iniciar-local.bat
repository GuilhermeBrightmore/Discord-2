@echo off
setlocal
cd /d "%~dp0"
title FungoCord - Hospedagem local

echo ============================================================
echo   FUNGOCORD - SERVIDOR LOCAL EM TODAS AS INTERFACES (0.0.0.0)
echo ============================================================
echo.

where node >nul 2>&1 || (echo [ERRO] Instale o Node.js 24 ou superior. & pause & exit /b 1)
where npm >nul 2>&1 || (echo [ERRO] npm nao encontrado. & pause & exit /b 1)
where docker >nul 2>&1 || (echo [ERRO] Instale e abra o Docker Desktop. & pause & exit /b 1)
docker info >nul 2>&1 || (echo [ERRO] O Docker Desktop nao esta em execucao. & pause & exit /b 1)

if not exist "node_modules" (
  echo [INFO] Instalando dependencias pela primeira vez...
  call npm install || (echo [ERRO] Falha ao instalar dependencias. & pause & exit /b 1)
)

net session >nul 2>&1
if %errorlevel%==0 (
  netsh advfirewall firewall show rule name="FungoCord API Local" >nul 2>&1
  if errorlevel 1 netsh advfirewall firewall add rule name="FungoCord API Local" dir=in action=allow protocol=TCP localport=8787,54321,7880,7881 profile=private >nul
  netsh advfirewall firewall show rule name="FungoCord Midia Local" >nul 2>&1
  if errorlevel 1 netsh advfirewall firewall add rule name="FungoCord Midia Local" dir=in action=allow protocol=UDP localport=7882 profile=private >nul
) else (
  echo [AVISO] Execute como Administrador para liberar as portas no Firewall.
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\preparar-local.ps1"
if errorlevel 1 (echo. & echo [ERRO] Nao foi possivel iniciar o ambiente local. & pause & exit /b 1)
echo.
pause
