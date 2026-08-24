@echo off
setlocal
cd /d "%~dp0"
title FungoCord - Publicar API na Vercel
where node >nul 2>&1 || (echo [ERRO] Instale o Node.js 24 ou superior. & pause & exit /b 1)
echo Publicando a API especializada na Vercel...
echo Confirme antes que as variaveis SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
echo SUPABASE_SERVICE_ROLE_KEY, LIVEKIT_URL, LIVEKIT_API_KEY,
echo LIVEKIT_API_SECRET e PUBLIC_LIVEKIT_URL estejam cadastradas no projeto.
echo.
call npx vercel --cwd apps\api --prod
if errorlevel 1 (echo [ERRO] Publicacao interrompida. & pause & exit /b 1)
echo [SUCESSO] API publicada.
pause
