@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title FungoCord - Publicar no GitHub
echo ============================================================
echo   FUNGOCORD - SUBSTITUIR CONTEUDO DO REPOSITORIO NO GITHUB
echo ============================================================
echo.
where git >nul 2>&1 || (echo [ERRO] Instale o Git para Windows. & pause & exit /b 1)

if not exist ".git" git init

set "REPO_URL=%~1"
if "%REPO_URL%"=="" (
  for /f "delims=" %%U in ('git remote get-url origin 2^>nul') do set "REPO_URL=%%U"
)
if "%REPO_URL%"=="" set /p "REPO_URL=Cole a URL do repositorio GitHub: "
if "%REPO_URL%"=="" (echo [ERRO] URL obrigatoria. & pause & exit /b 1)

git remote get-url origin >nul 2>&1
if errorlevel 1 (git remote add origin "%REPO_URL%") else (git remote set-url origin "%REPO_URL%")

set "REMOTE_FILE=%TEMP%\discord2_remote_%RANDOM%.txt"
git ls-remote --heads origin >"%REMOTE_FILE%" 2>nul
if errorlevel 1 (del "%REMOTE_FILE%" >nul 2>&1 & echo [ERRO] Nao foi possivel acessar o repositorio. Verifique a URL e sua autenticacao. & pause & exit /b 1)
for %%F in ("%REMOTE_FILE%") do set "REMOTE_SIZE=%%~zF"

set "REMOTE_BRANCH=main"
for /f "tokens=2" %%B in ('git ls-remote --symref origin HEAD 2^>nul ^| findstr /b "ref:"') do set "REMOTE_REF=%%B"
if defined REMOTE_REF set "REMOTE_BRANCH=!REMOTE_REF:refs/heads/=!"

if not "%REMOTE_SIZE%"=="0" (
  echo [ATENCAO] O repositorio remoto ja possui conteudo.
  echo O historico e todos os arquivos da branch !REMOTE_BRANCH! serao substituidos por este projeto.
  choice /C SN /N /M "Continuar com a substituicao? [S/N]: "
  if errorlevel 2 (del "%REMOTE_FILE%" >nul 2>&1 & echo Operacao cancelada. & pause & exit /b 0)
) else (
  echo [OK] O repositorio remoto esta vazio.
)
del "%REMOTE_FILE%" >nul 2>&1

git config user.name >nul 2>&1 || git config user.name "FungoCord Publisher"
git config user.email >nul 2>&1 || git config user.email "fungocord@users.noreply.github.com"
git add -A || (echo [ERRO] Nao foi possivel preparar os arquivos. & pause & exit /b 1)
git commit --allow-empty -m "Publicar FungoCord centralizado" || (echo [ERRO] Nao foi possivel criar o commit. & pause & exit /b 1)
git branch -M "!REMOTE_BRANCH!"
echo.
echo Enviando e substituindo a branch remota !REMOTE_BRANCH!...
git push --force origin "HEAD:!REMOTE_BRANCH!" || (echo [ERRO] O envio falhou. Use Git Credential Manager ou gh auth login. & pause & exit /b 1)
echo.
echo [SUCESSO] Repositorio atualizado: %REPO_URL%
pause
