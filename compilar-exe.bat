@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title FungoCord - Compilar EXE
echo ============================================================
echo   FUNGOCORD - GERADOR DE INSTALADOR E EXECUTAVEL PORTATIL
echo ============================================================
echo Somente este computador precisa ter Node.js. O usuario final nao.
echo.
where node >nul 2>&1 || (echo [ERRO] Instale o Node.js 24 ou superior. & pause & exit /b 1)
where npm >nul 2>&1 || (echo [ERRO] npm nao encontrado. & pause & exit /b 1)

if "%VITE_SUPABASE_URL%"=="" set /p "VITE_SUPABASE_URL=URL do Supabase Cloud: "
if "%VITE_SUPABASE_PUBLISHABLE_KEY%"=="" set /p "VITE_SUPABASE_PUBLISHABLE_KEY=Chave publica do Supabase: "
if "%VITE_API_URL%"=="" set /p "VITE_API_URL=URL publica da API Vercel: "
if "%VITE_LIVEKIT_URL%"=="" set /p "VITE_LIVEKIT_URL=URL publica do LiveKit: "

if "%VITE_SUPABASE_URL%"=="" (echo [ERRO] URL do Supabase obrigatoria. & pause & exit /b 1)
if "%VITE_SUPABASE_PUBLISHABLE_KEY%"=="" (echo [ERRO] Chave publica obrigatoria. & pause & exit /b 1)
if "%VITE_API_URL%"=="" (echo [ERRO] URL da API obrigatoria. & pause & exit /b 1)
if "%VITE_LIVEKIT_URL%"=="" (echo [ERRO] URL do LiveKit obrigatoria. & pause & exit /b 1)

echo.
echo [1/2] Instalando dependencias...
call npm install || (echo [ERRO] npm install falhou. & pause & exit /b 1)
echo [2/2] Compilando Electron para Windows...
call npm run build:desktop || (echo [ERRO] A compilacao falhou. & pause & exit /b 1)
echo.
echo Pronto. Os arquivos estao em apps\desktop\release\
start "" "%~dp0apps\desktop\release"
pause
