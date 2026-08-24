@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title FungoCord - Publicar atualizacao
echo ============================================================
echo   FUNGOCORD - PUBLICAR ATUALIZACAO PARA TODOS OS USUARIOS
echo ============================================================
echo.
where node >nul 2>&1 || (echo [ERRO] Instale o Node.js 24 ou superior. & pause & exit /b 1)
where npm >nul 2>&1 || (echo [ERRO] npm nao encontrado. & pause & exit /b 1)

set /p "APP_VERSION=Nova versao, por exemplo 1.2.0: "
if "%APP_VERSION%"=="" (echo [ERRO] A versao e obrigatoria. & pause & exit /b 1)

if "%GH_TOKEN%"=="" (
  echo Informe um GitHub Personal Access Token com permissao Contents: Read and write.
  for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$p=Read-Host 'Token do GitHub' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}"`) do set "GH_TOKEN=%%T"
)
if "%GH_TOKEN%"=="" (echo [ERRO] Token do GitHub obrigatorio. & pause & exit /b 1)

if "%VITE_SUPABASE_URL%"=="" set /p "VITE_SUPABASE_URL=URL do Supabase Cloud: "
if "%VITE_SUPABASE_PUBLISHABLE_KEY%"=="" set /p "VITE_SUPABASE_PUBLISHABLE_KEY=Chave publica do Supabase: "
if "%VITE_API_URL%"=="" set /p "VITE_API_URL=URL publica da API Vercel: "
if "%VITE_LIVEKIT_URL%"=="" set /p "VITE_LIVEKIT_URL=URL publica do LiveKit: "

if "%VITE_SUPABASE_URL%"=="" (echo [ERRO] URL do Supabase obrigatoria. & pause & exit /b 1)
if "%VITE_SUPABASE_PUBLISHABLE_KEY%"=="" (echo [ERRO] Chave publica obrigatoria. & pause & exit /b 1)
if "%VITE_API_URL%"=="" (echo [ERRO] URL da API obrigatoria. & pause & exit /b 1)
if "%VITE_LIVEKIT_URL%"=="" (echo [ERRO] URL do LiveKit obrigatoria. & pause & exit /b 1)

echo.
echo [1/4] Instalando dependencias e preparando o build...
call npm install || (echo [ERRO] npm install falhou. & pause & exit /b 1)
echo [2/4] Atualizando a versao do aplicativo...
node scripts\definir-versao-update.mjs "%APP_VERSION%" || (echo [ERRO] Versao invalida. & pause & exit /b 1)
echo [3/4] Compilando o instalador NSIS...
echo [4/4] Criando a Release e enviando os arquivos ao GitHub...
call npm run publish:update -w @discord2/desktop || (echo [ERRO] A publicacao falhou. & pause & exit /b 1)

echo.
echo [SUCESSO] A versao %APP_VERSION% foi publicada.
echo Os aplicativos instalados verificarao a atualizacao automaticamente.
start "" "https://github.com/GuilhermeBrightmore/Discord-2/releases"
pause
