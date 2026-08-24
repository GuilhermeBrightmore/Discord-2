@echo off
setlocal
cd /d "%~dp0"
title FungoCord - Migrar Supabase Cloud
where node >nul 2>&1 || (echo [ERRO] Instale o Node.js 24 ou superior. & pause & exit /b 1)
set /p "PROJECT_REF=Project Ref do Supabase: "
if "%PROJECT_REF%"=="" (echo [ERRO] Project Ref obrigatorio. & pause & exit /b 1)
call npx supabase login || (echo [ERRO] Login cancelado. & pause & exit /b 1)
call npx supabase link --project-ref "%PROJECT_REF%" || (echo [ERRO] Nao foi possivel vincular o projeto. & pause & exit /b 1)

echo.
echo O banco deste projeto Supabase ja foi usado em alguma tentativa anterior?
echo [1] Sim, ele pode estar completo ou parcialmente configurado
echo [2] Nao, este e um banco novo e vazio
choice /c 12 /n /m "Escolha 1 ou 2: "
if errorlevel 2 goto push_migrations

echo.
echo [AJUSTE] Permitindo que o esquema inicial seguro complete o banco...
call npx supabase migration repair 20260823000000 --status reverted || (echo [ERRO] Nao foi possivel reparar o historico. & pause & exit /b 1)

:push_migrations
echo.
echo [ENVIO] Aplicando somente as migracoes pendentes...
call npx supabase db push || (echo [ERRO] A migracao falhou. & pause & exit /b 1)
echo [SUCESSO] Estrutura, funcoes e politicas RLS enviadas ao Supabase.
pause
