@echo off
setlocal
cd /d "%~dp0"
title FungoCord - Parar servidor local
echo Parando LiveKit e Supabase local...
docker compose -f infra\docker-compose.local.yml down
call npx supabase stop
echo.
echo Servicos em contêiner encerrados. Feche as janelas da API e do Electron.
pause
